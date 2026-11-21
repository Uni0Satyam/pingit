import { NextRequest } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Chatbot from "@/models/chatbot.model";
import Subscription from "@/models/subscription.model";
import { ApiResponse } from "@/lib/apiResponse";
import { resolveUser } from "@/app/api/chatbot/route";
import {
  getEffectivePlan,
  normalizeAllowedDomains,
  PLAN_ENTITLEMENTS,
} from "@/lib/planEntitlements";



type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/chatbot/[id]
 * Fetches a single chatbot by its MongoDB ID.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      return ApiResponse.error("Invalid chatbot ID format", 400);
    }

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to access chatbots", 401);
    }

    const chatbot = await Chatbot.findOne({ _id: id, userId: user._id });
    if (!chatbot) {
      return ApiResponse.error("Chatbot not found", 404);
    }

    return ApiResponse.success(chatbot, 200, "Chatbot fetched successfully");
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/chatbot/[id]]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

/**
 * PUT /api/chatbot/[id] or PATCH /api/chatbot/[id]
 * Updates a chatbot by its ID.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      return ApiResponse.error("Invalid chatbot ID format", 400);
    }

    const body = await req.json();

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to update chatbots", 401);
    }
    const existingChatbot = await Chatbot.findOne({ _id: id, userId: user._id });
    if (!existingChatbot) {
      return ApiResponse.error("Chatbot not found", 404);
    }

    // Verify ownership
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) return ApiResponse.error("Chatbot name cannot be empty", 400);
      updateData.name = body.name.trim();
    }

    if (body.businessName !== undefined) {
      if (!body.businessName.trim()) return ApiResponse.error("Business name cannot be empty", 400);
      updateData.businessName = body.businessName.trim();
    }

    if (body.businessEmail !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.businessEmail.trim())) {
        return ApiResponse.error("Invalid business email format", 400);
      }
      updateData.businessEmail = body.businessEmail.trim().toLowerCase();
    }

    if (body.knowledgeBase !== undefined) {
      if (typeof body.knowledgeBase !== "string") {
        return ApiResponse.error("Knowledge base must be text", 400);
      }
      const subscription = await Subscription.findOne({ userId: user._id });
      if (!subscription) {
        return ApiResponse.error("Subscription account was not found", 404);
      }
      const knowledgeLimit = PLAN_ENTITLEMENTS[getEffectivePlan(subscription)].maxKnowledgeBaseBytes;
      if (
        knowledgeLimit !== null &&
        Buffer.byteLength(body.knowledgeBase, "utf8") > knowledgeLimit
      ) {
        return ApiResponse.error("The Free plan knowledge base limit is 2 MB", 413);
      }
      updateData.knowledgeBase = body.knowledgeBase;
    }

    if (body.allowedDomains !== undefined) {
      const normalized = normalizeAllowedDomains(body.allowedDomains);
      if ("error" in normalized) {
        return ApiResponse.error(normalized.error, 400);
      }
      const subscription = await Subscription.findOne({ userId: user._id });
      if (!subscription) {
        return ApiResponse.error("Subscription account was not found", 404);
      }
      const domainLimit =
        PLAN_ENTITLEMENTS[getEffectivePlan(subscription)].maxAllowedDomains;
      if (domainLimit !== null && normalized.domains.length > domainLimit) {
        return ApiResponse.error(
          `The Free plan allows ${domainLimit} website domain. Upgrade to Premium for more.`,
          403,
        );
      }
      updateData.allowedDomains = normalized.domains;
    }

    if (body.status !== undefined) {
      if (!["draft", "active", "disabled"].includes(body.status)) {
        return ApiResponse.error("Status must be 'draft', 'active', or 'disabled'", 400);
      }
      updateData.status = body.status;
    }

    if (body.settings !== undefined) {
      const requestedMode = body.settings.chatMode ?? existingChatbot.settings.chatMode ?? "standard";
      if (requestedMode !== "standard" && requestedMode !== "smart") {
        return ApiResponse.error("Chat mode must be Standard or Smart", 400);
      }
      const subscription = await Subscription.findOne({ userId: user._id });
      if (!subscription) {
        return ApiResponse.error("Subscription account was not found", 404);
      }
      if (
        requestedMode === "smart" &&
        !PLAN_ENTITLEMENTS[getEffectivePlan(subscription)].modes.includes("smart")
      ) {
        return ApiResponse.error("Smart mode requires the Pro plan or above", 403);
      }
      updateData.settings = {
        welcomeMessage: body.settings.welcomeMessage ?? existingChatbot.settings.welcomeMessage,
        primaryColor: body.settings.primaryColor ?? existingChatbot.settings.primaryColor,
        systemPrompt: body.settings.systemPrompt ?? existingChatbot.settings.systemPrompt,
        chatMode: requestedMode,
      };
    }

    const updatedChatbot = await Chatbot.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    return ApiResponse.success(updatedChatbot, 200, "Chatbot updated successfully");
  } catch (error: unknown) {
    console.error("API Route Error [PUT /api/chatbot/[id]]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to update chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

export const PATCH = PUT;

/**
 * DELETE /api/chatbot/[id]
 * Deletes a chatbot by its ID.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      return ApiResponse.error("Invalid chatbot ID format", 400);
    }

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to delete chatbots", 401);
    }
    const existingChatbot = await Chatbot.findOne({ _id: id, userId: user._id });
    if (!existingChatbot) {
      return ApiResponse.error("Chatbot not found", 404);
    }

    const deleted = await Chatbot.findOneAndDelete({ _id: id, userId: user._id });
    if (!deleted) {
      return ApiResponse.error("Chatbot not found", 404);
    }
    await Subscription.updateOne(
      { userId: user._id, chatbotCount: { $gt: 0 } },
      { $inc: { chatbotCount: -1 } },
    );

    return ApiResponse.success({ id }, 200, "Chatbot deleted successfully");
  } catch (error: unknown) {
    console.error("API Route Error [DELETE /api/chatbot/[id]]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to delete chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
