import { getSession } from "@/app/utils/getSession";
import { ApiResponse } from "@/lib/apiResponse";
import connectDB from "@/lib/db";
import Chatbot from "@/models/chatbot.model";
import Conversation from "@/models/conversation.model";
import Message from "@/models/message.model";
import User from "@/models/user.model";
import Subscription from "@/models/subscription.model";
import { getEffectivePlan, PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import { connection, NextRequest } from "next/server";

const DEFAULT_LIMIT = 50;
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
    if (!PLAN_ENTITLEMENTS[plan].conversations) {
      return ApiResponse.error(
        "Conversation history is available on Premium. Upgrade to view conversations.",
        403,
      );
    }

    const conversations = await Conversation.find({ userId: user._id })
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .lean();
    const conversationIds = conversations.map((item) => item._id);
    const chatbotIds = [
      ...new Set(conversations.map((item) => item.chatbotId.toString())),
    ];

    const [chatbots, latestMessages] = await Promise.all([
      chatbotIds.length
        ? Chatbot.find({
            _id: { $in: chatbotIds },
            userId: user._id,
          })
            .select("_id name")
            .lean()
        : [],
      conversationIds.length
        ? Message.find({ conversationId: { $in: conversationIds } })
            .sort({ sentAt: -1 })
            .select("conversationId content sentAt")
            .lean()
        : [],
    ]);

    const chatbotNames = new Map(
      chatbots.map((chatbot) => [chatbot._id.toString(), chatbot.name]),
    );
    const messageByConversation = new Map<
      string,
      { content: string; sentAt: Date }
    >();
    for (const message of latestMessages) {
      const id = message.conversationId.toString();
      if (!messageByConversation.has(id)) {
        messageByConversation.set(id, {
          content: message.content,
          sentAt: message.sentAt,
        });
      }
    }

    return ApiResponse.success(
      {
        conversations: conversations.map((item) => {
          const id = item._id.toString();
          const latestMessage = messageByConversation.get(id);
          return {
            id,
            chatbotId: item.chatbotId.toString(),
            chatbotName:
              chatbotNames.get(item.chatbotId.toString()) ?? "Deleted chatbot",
            visitorId: item.visitorId,
            status: item.status,
            startedAt: item.startedAt.toISOString(),
            lastMessageAt: item.lastMessageAt.toISOString(),
            lastMessage: latestMessage?.content ?? "",
            lastMessageSentAt:
              latestMessage?.sentAt.toISOString() ?? item.lastMessageAt.toISOString(),
          };
        }),
        limit,
      },
      200,
      "Conversations fetched successfully",
    );
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/conversations]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch conversations",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
