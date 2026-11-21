import { getSession } from "@/app/utils/getSession";
import { ApiResponse } from "@/lib/apiResponse";
import connectDB from "@/lib/db";
import Chatbot from "@/models/chatbot.model";
import Conversation from "@/models/conversation.model";
import Message from "@/models/message.model";
import User from "@/models/user.model";
import Subscription from "@/models/subscription.model";
import { getEffectivePlan, PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import { Types } from "mongoose";
import { connection, NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  await connection();
  try {
    const session = await getSession();
    const userId = session?.user?.id;
    if (!userId) {
      return ApiResponse.error("Authentication required", 401);
    }

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return ApiResponse.error("Invalid conversation ID", 400);
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

    const conversation = await Conversation.findOne({
      _id: id,
      userId: user._id,
    }).lean();
    if (!conversation) {
      return ApiResponse.error("Conversation not found", 404);
    }

    const [chatbot, messages] = await Promise.all([
      Chatbot.findOne({
        _id: conversation.chatbotId,
        userId: user._id,
      })
        .select("_id name")
        .lean(),
      Message.find({ conversationId: conversation._id })
        .sort({ sentAt: 1, _id: 1 })
        .limit(500)
        .lean(),
    ]);

    return ApiResponse.success(
      {
        conversation: {
          id: conversation._id.toString(),
          chatbotId: conversation.chatbotId.toString(),
          chatbotName: chatbot?.name ?? "Deleted chatbot",
          visitorId: conversation.visitorId,
          status: conversation.status,
          startedAt: conversation.startedAt.toISOString(),
          lastMessageAt: conversation.lastMessageAt.toISOString(),
        },
        messages: messages.map((message) => ({
          id: message._id.toString(),
          role: message.role,
          content: message.content,
          sentAt: message.sentAt.toISOString(),
        })),
        hasMoreMessages: messages.length === 500,
      },
      200,
      "Conversation fetched successfully",
    );
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/conversations/[id]]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch conversation",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
