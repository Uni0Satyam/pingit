import { NextRequest } from "next/server";
import mongoose, { Types } from "mongoose";
import connectDB from "@/lib/db";
import Chatbot, { IChatbotSettings } from "@/models/chatbot.model";
import User from "@/models/user.model";
import Subscription, {
  ensureFreeSubscription,
} from "@/models/subscription.model";
import { ApiResponse } from "@/lib/apiResponse";
import { getSession } from "@/app/utils/getSession";
import {
  getEffectivePlan,
  normalizeAllowedDomains,
  PLAN_ENTITLEMENTS,
} from "@/lib/planEntitlements";


/**
 * Resolves the account belonging to the active Supabase Auth session.
 */
export async function resolveUser() {
  const session = await getSession();
  const rawUser = session?.user;
  const targetId = rawUser?.id;
  if (!targetId) return null;

  // Lookup by Supabase Auth user ID.
  let user = await User.findOne({ userId: targetId });
  if (user) {
    await ensureFreeSubscription(user._id);
    return user;
  }

  // Auto-sync the MongoDB account for the authenticated Supabase user.
  if (!user && rawUser && rawUser.id === targetId) {
    const email = rawUser.email;
    const name = rawUser.userProfile?.firstName
      ? `${rawUser.userProfile.firstName} ${rawUser.userProfile.lastName || ""}`.trim()
      : undefined;

    if (email) {
      user = await User.findOneAndUpdate(
        { userId: targetId },
        {
          $set: {
            email: email.toLowerCase(),
            ...(name ? { name } : {}),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (user) {
        await ensureFreeSubscription(user._id);
      }
    }
  }

  return user;
}

/**
 * POST /api/chatbot
 * Creates a new chatbot for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      businessName,
      businessEmail,
      knowledgeBase = "",
      status = "draft",
      settings,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return ApiResponse.error("Chatbot name is required", 400);
    }

    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      return ApiResponse.error("Business name is required", 400);
    }

    if (!businessEmail || typeof businessEmail !== "string" || !businessEmail.trim()) {
      return ApiResponse.error("Business email is required", 400);
    }
    if (typeof knowledgeBase !== "string") {
      return ApiResponse.error("Knowledge base must be text", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(businessEmail.trim())) {
      return ApiResponse.error("Invalid business email format", 400);
    }

    if (status && !["draft", "active", "disabled"].includes(status)) {
      return ApiResponse.error("Status must be 'draft', 'active', or 'disabled'", 400);
    }

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error(
        "Authentication is required to create a chatbot",
        401,
      );
    }

    const subscription = await Subscription.findOne({ userId: user._id });
    if (!subscription) {
      return ApiResponse.error("Subscription account was not found", 404);
    }
    const plan = getEffectivePlan(subscription);
    const knowledgeLimit = PLAN_ENTITLEMENTS[plan].maxKnowledgeBaseBytes;
    if (
      knowledgeLimit !== null &&
      Buffer.byteLength(knowledgeBase, "utf8") > knowledgeLimit
    ) {
      return ApiResponse.error("The Free plan knowledge base limit is 2 MB", 413);
    }
    const chatbotLimit = PLAN_ENTITLEMENTS[plan].maxChatbots;
    const storedCount = await Subscription.collection.findOne(
      { userId: user._id },
      { projection: { chatbotCount: 1 } },
    );
    if (storedCount?.chatbotCount === undefined) {
      const currentCount = await Chatbot.countDocuments({ userId: user._id });
      await Subscription.updateOne(
        { userId: user._id, chatbotCount: { $exists: false } },
        { $set: { chatbotCount: currentCount } },
      );
    }

    const requestedMode = settings?.chatMode;
    if (requestedMode !== undefined && requestedMode !== "standard" && requestedMode !== "smart") {
      return ApiResponse.error("Chat mode must be Standard or Smart", 400);
    }
    if (requestedMode === "smart" && !PLAN_ENTITLEMENTS[plan].modes.includes("smart")) {
      return ApiResponse.error("Smart mode requires the Pro plan or above", 403);
    }
    const chatbotSettings: IChatbotSettings = {
      welcomeMessage: settings?.welcomeMessage ?? "Hi! How can I help you?",
      primaryColor: settings?.primaryColor ?? "#2563eb",
      systemPrompt: settings?.systemPrompt ?? "",
      chatMode: requestedMode ?? "standard",
    };

    const mongoSession = await mongoose.startSession();
    try {
      const chatbot = await mongoSession.withTransaction(async () => {
        const accountPlanFilter = {
          userId: user._id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
        const filter =
          chatbotLimit === null
            ? accountPlanFilter
            : { ...accountPlanFilter, chatbotCount: { $lt: chatbotLimit } };
        const reserved = await Subscription.findOneAndUpdate(
          filter,
          { $inc: { chatbotCount: 1 } },
          { new: true, session: mongoSession },
        );
        if (!reserved) {
          throw new Error("CHATBOT_PLAN_LIMIT_REACHED");
        }
        const [createdChatbot] = await Chatbot.create(
          [
            {
              userId: user._id,
              name: name.trim(),
              businessName: businessName.trim(),
              businessEmail: businessEmail.trim().toLowerCase(),
              knowledgeBase: knowledgeBase.trim(),
              status,
              settings: chatbotSettings,
            },
          ],
          { session: mongoSession },
        );
        return createdChatbot;
      });
      if (!chatbot) {
        throw new Error("Chatbot creation transaction completed without a chatbot");
      }
      return ApiResponse.success(chatbot, 201, "Chatbot created successfully");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "CHATBOT_PLAN_LIMIT_REACHED"
      ) {
        return ApiResponse.error(
          "The Free plan includes one chatbot. Upgrade to Premium to create more.",
          403,
        );
      }
      throw error;
    } finally {
      await mongoSession.endSession();
    }
  } catch (error: unknown) {
    console.error("API Route Error [POST /api/chatbot]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to create chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

/**
 * GET /api/chatbot
 * Retrieves a single chatbot (if ?id=... is provided) or lists all chatbots for the user.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatbotId = searchParams.get("id");
    await connectDB();
    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to access chatbots", 401);
    }

    // 1. Single chatbot by ID
    if (chatbotId) {
      if (!Types.ObjectId.isValid(chatbotId)) {
        return ApiResponse.error("Invalid chatbot ID format", 400);
      }

      const chatbot = await Chatbot.findOne({
        _id: chatbotId,
        userId: user._id,
      });
      if (!chatbot) {
        return ApiResponse.error("Chatbot not found", 404);
      }

      return ApiResponse.success(chatbot, 200, "Chatbot fetched successfully");
    }

    // 2. List all chatbots for user
    const chatbots = await Chatbot.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(chatbots, 200, "Chatbots fetched successfully");
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/chatbot]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch chatbot(s)",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

/**
 * PUT /api/chatbot
 * Updates an existing chatbot (id passed via query param or body).
 */
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    const chatbotId = searchParams.get("id") || body.id || body._id;

    if (!chatbotId || !Types.ObjectId.isValid(chatbotId)) {
      return ApiResponse.error("A valid chatbot ID is required", 400);
    }

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to update chatbots", 401);
    }
    const existingChatbot = await Chatbot.findOne({
      _id: chatbotId,
      userId: user._id,
    });
    if (!existingChatbot) {
      return ApiResponse.error("Chatbot not found", 404);
    }

    // Build update payload
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
      const effectivePlan = getEffectivePlan(subscription);
      const domainLimit = PLAN_ENTITLEMENTS[effectivePlan].maxAllowedDomains;
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
      { _id: chatbotId, userId: user._id },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    return ApiResponse.success(updatedChatbot, 200, "Chatbot updated successfully");
  } catch (error: unknown) {
    console.error("API Route Error [PUT /api/chatbot]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to update chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

/**
 * DELETE /api/chatbot
 * Deletes a chatbot by ID (passed via query param or body).
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let chatbotId = searchParams.get("id");

    if (!chatbotId) {
      try {
        const body = await req.json();
        chatbotId = body.id || body._id;
      } catch {
        // Body is optional if passed as query param
      }
    }

    if (!chatbotId || !Types.ObjectId.isValid(chatbotId)) {
      return ApiResponse.error("A valid chatbot ID is required", 400);
    }

    await connectDB();

    const user = await resolveUser();
    if (!user) {
      return ApiResponse.error("Authentication is required to delete chatbots", 401);
    }
    const existingChatbot = await Chatbot.findOne({
      _id: chatbotId,
      userId: user._id,
    });
    if (!existingChatbot) {
      return ApiResponse.error("Chatbot not found", 404);
    }

    const deleted = await Chatbot.findOneAndDelete({
      _id: chatbotId,
      userId: user._id,
    });
    if (!deleted) {
      return ApiResponse.error("Chatbot not found", 404);
    }
    await Subscription.updateOne(
      { userId: user._id, chatbotCount: { $gt: 0 } },
      { $inc: { chatbotCount: -1 } },
    );

    return ApiResponse.success({ id: chatbotId }, 200, "Chatbot deleted successfully");
  } catch (error: unknown) {
    console.error("API Route Error [DELETE /api/chatbot]:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to delete chatbot",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
