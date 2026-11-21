import { getSession } from "@/app/utils/getSession";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import Chatbot from "@/models/chatbot.model";
import User from "@/models/user.model";
import UsageRecord from "@/models/usageRecord.model";
import Subscription from "@/models/subscription.model";
import { getEffectivePlan, PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import { connection, NextRequest } from "next/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) {
      return ApiResponse.error("Authentication required", 401);
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return ApiResponse.error(
        `Limit must be an integer between 1 and ${MAX_LIMIT}`,
        400,
      );
    }

    await connectDB();
    const user = await User.findOne({ userId }).select("_id").lean();
    if (!user) {
      return ApiResponse.error("Account not found", 404);
    }
    const subscription = await Subscription.findOne({ userId: user._id });
    const plan = subscription ? getEffectivePlan(subscription) : "free";
    if (!PLAN_ENTITLEMENTS[plan].analytics) {
      return ApiResponse.error(
        "Usage analytics are available on Premium. Upgrade to view analytics.",
        403,
      );
    }

    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);

    const [records, [summary], trendRows] = await Promise.all([
      UsageRecord.find({ userId: user._id })
        .sort({ occurredAt: -1 })
        .limit(limit)
        .lean(),
      UsageRecord.aggregate<{
        totalRecords: number;
        totalUnits: number;
        totalCredits: number;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
        costCurrency: string | null;
      }>([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalUnits: { $sum: "$units" },
            totalCredits: { $sum: "$creditsCharged" },
            inputTokens: { $sum: { $ifNull: ["$inputTokens", 0] } },
            outputTokens: { $sum: { $ifNull: ["$outputTokens", 0] } },
            totalCost: { $sum: { $ifNull: ["$costAmount", 0] } },
            costCurrencies: { $addToSet: "$costCurrency" },
          },
        },
        {
          $project: {
            _id: 0,
            totalRecords: 1,
            totalUnits: 1,
            totalCredits: 1,
            inputTokens: 1,
            outputTokens: 1,
            totalCost: 1,
            costCurrency: {
              $cond: [
                { $eq: [{ $size: "$costCurrencies" }, 1] },
                { $arrayElemAt: ["$costCurrencies", 0] },
                null,
              ],
            },
          },
        },
      ]),
      UsageRecord.aggregate<{
        date: string;
        requests: number;
        credits: number;
        tokens: number;
      }>([
        {
          $match: {
            userId: user._id,
            occurredAt: { $gte: trendStart },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$occurredAt",
                timezone: "UTC",
              },
            },
            requests: { $sum: 1 },
            credits: { $sum: "$creditsCharged" },
            tokens: {
              $sum: {
                $add: [
                  { $ifNull: ["$inputTokens", 0] },
                  { $ifNull: ["$outputTokens", 0] },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            requests: 1,
            credits: 1,
            tokens: 1,
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);
    const trendByDate = new Map(trendRows.map((day) => [day.date, day]));
    const dailyTrend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(trendStart);
      date.setUTCDate(trendStart.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const day = trendByDate.get(dateKey);
      return {
        date: dateKey,
        requests: day?.requests ?? 0,
        credits: day?.credits ?? 0,
        tokens: day?.tokens ?? 0,
      };
    });
    const chatbotIds = [...new Set(records.map((record) => record.chatbotId.toString()))];
    const chatbots = chatbotIds.length
      ? await Chatbot.find({ _id: { $in: chatbotIds } })
          .select("_id name")
          .lean()
      : [];
    const chatbotNames = new Map(
      chatbots.map((chatbot) => [chatbot._id.toString(), chatbot.name]),
    );

    return ApiResponse.success(
      {
        summary: summary ?? {
          totalRecords: 0,
          totalUnits: 0,
          totalCredits: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          costCurrency: null,
        },
        records: records.map((record) => ({
          id: record._id.toString(),
          chatbotId: record.chatbotId.toString(),
          chatbotName:
            chatbotNames.get(record.chatbotId.toString()) ?? "Deleted chatbot",
          units: record.units,
          unitType: record.unitType,
          creditsCharged: record.creditsCharged,
          occurredAt: record.occurredAt.toISOString(),
          provider: record.provider ?? null,
          model: record.model ?? null,
          inputTokens: record.inputTokens ?? 0,
          outputTokens: record.outputTokens ?? 0,
          costAmount: record.costAmount ?? null,
          costCurrency: record.costCurrency ?? null,
        })),
        dailyTrend,
        limit,
      },
      200,
      "Usage records fetched successfully",
    );
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/usage-record]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch usage records",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
