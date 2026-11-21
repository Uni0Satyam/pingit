import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import { calculateUsageCost } from "@/lib/usageCost";
import {
  getEffectivePlan,
  normalizeDomain,
  PLAN_ENTITLEMENTS,
} from "@/lib/planEntitlements";
import { checkChatRateLimit } from "@/models/rateLimit.model";
import Chatbot from "@/models/chatbot.model";
import Conversation from "@/models/conversation.model";
import Message from "@/models/message.model";
import Subscription, {
  consumeCredits,
  downgradeExpiredCanceledSubscription,
  ensureFreeSubscription,
  refreshMonthlyCredits,
  refundCredits,
  type CreditAllocation,
} from "@/models/subscription.model";
import UsageRecord from "@/models/usageRecord.model";

const STANDARD_MODEL = "gemini-3.5-flash-lite";
const SMART_MODEL = "gemini-3.8-flash";
const MAX_OUTPUT_TOKENS = 512;

function withCors(response: NextResponse, origin: string | null) {
  response.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  if (origin) response.headers.append("Vary", "Origin");
  return response;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    "unknown"
  );
}

async function sendCreditThresholdEmail(
  email: string,
  planName: string,
  percentage: 80 | 100,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BILLING_ALERT_FROM;
  if (!apiKey || !from) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${planName} credits ${percentage}% used`,
      text:
        percentage === 100
          ? "Your included credits are used. Add a 1,000-credit top-up to keep your chatbot answering."
          : "Your workspace has used 80% of its included monthly credits. Review usage or add a top-up in Billing.",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Credit alert email failed with status ${response.status}`);
  }
}

async function dispatchCreditAlerts(input: {
  subscription: {
    _id: Types.ObjectId;
    plan: string;
    creditPeriodStart: Date;
    monthlyCreditAllowance: number;
    creditsUsedThisPeriod: number;
  };
  email: string;
}) {
  const { subscription, email } = input;
  if (!subscription.monthlyCreditAllowance || !email) return;
  const usageRatio = subscription.creditsUsedThisPeriod / subscription.monthlyCreditAllowance;
  const thresholds = ([80, 100] as const).filter((threshold) => usageRatio >= threshold / 100);
  if (!process.env.RESEND_API_KEY || !process.env.BILLING_ALERT_FROM) return;
  for (const threshold of thresholds) {
    const marker = threshold === 80 ? "warning80PeriodStart" : "warning100PeriodStart";
    const claimed = await Subscription.findOneAndUpdate(
      {
        _id: subscription._id,
        $or: [
          { [marker]: { $ne: subscription.creditPeriodStart } },
          { [marker]: { $exists: false } },
        ],
      },
      { $set: { [marker]: subscription.creditPeriodStart } },
      { new: true },
    );
    if (!claimed) continue;
    try {
      await sendCreditThresholdEmail(
        email,
        subscription.plan[0].toUpperCase() + subscription.plan.slice(1),
        threshold,
      );
    } catch (error: unknown) {
      console.error("Could not send billing usage email:", error);
    }
  }
}

function getText(value: unknown) {
  if (!Array.isArray(value)) return "";
  const parts = value.flatMap((item) => {
    if (typeof item !== "object" || item === null || !("parts" in item)) return [];
    const content = item.parts;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) =>
      typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
        ? [part.text]
        : [],
    );
  });
  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  let corsOrigin: string | null = null;
  let subscriptionId: Types.ObjectId | null = null;
  let reservedCredits = 0;
  let reservedAllocation: CreditAllocation | null = null;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return withCors(ApiResponse.error("A valid chat request is required", 400), corsOrigin);
    }

    const { messageHistory, userId, chatbotId, visitorId } = body as Record<string, unknown>;
    if (
      !Array.isArray(messageHistory) ||
      messageHistory.length === 0 ||
      typeof userId !== "string" ||
      !userId ||
      typeof chatbotId !== "string" ||
      !Types.ObjectId.isValid(chatbotId)
    ) {
      return withCors(
        ApiResponse.error("Message history, user ID, and a valid chatbot ID are required", 400),
        corsOrigin,
      );
    }
    if (
      visitorId !== undefined &&
      (typeof visitorId !== "string" || !visitorId.trim() || visitorId.length > 200)
    ) {
      return withCors(ApiResponse.error("Invalid visitor ID", 400), corsOrigin);
    }
    const latestUserMessage = getText([messageHistory.at(-1)]).trim();
    if (!latestUserMessage || latestUserMessage.length > 8_000) {
      return withCors(
        ApiResponse.error("A non-empty visitor message under 8,000 characters is required", 400),
        corsOrigin,
      );
    }

    const incomingOrigin = request.headers.get("origin");
    let requestDomain: string | null = null;
    if (incomingOrigin) {
      requestDomain = normalizeDomain(incomingOrigin);
      if (!requestDomain) {
        return withCors(ApiResponse.error("Invalid request origin", 403), corsOrigin);
      }
      corsOrigin = new URL(incomingOrigin).origin;
    }

    await connectDB();
    const chatbot = await Chatbot.findById(chatbotId).populate<{
      userId: { _id: Types.ObjectId; userId: string; email: string } | null;
    }>("userId", "userId email");
    if (!chatbot || chatbot.userId?.userId !== userId) {
      return withCors(ApiResponse.error("Chatbot not found for this user", 404), corsOrigin);
    }
    if (chatbot.status === "paused") {
      return withCors(
        ApiResponse.error("This chatbot was paused after 30 days without visitor traffic. Re-enable it from the dashboard.", 403),
        corsOrigin,
      );
    }

    let subscription = await ensureFreeSubscription(chatbot.userId._id);
    subscription =
      (await downgradeExpiredCanceledSubscription(subscription._id)) ?? subscription;
    subscription = await refreshMonthlyCredits(subscription);
    subscriptionId = subscription._id;
    const plan = getEffectivePlan(subscription);
    if (plan === "free") {
      const visitorKey = typeof visitorId === "string" ? visitorId.trim() : "legacy";
      const rateLimit = await checkChatRateLimit(
        hash(getClientIp(request)),
        hash(`${chatbot._id}:${visitorKey}`),
      );
      if (!rateLimit.allowed) {
        return withCors(
          ApiResponse.error("Too many chat requests. Please wait a minute and try again.", 429),
          corsOrigin,
        );
      }
      const firstBot = await Chatbot.findOne({ userId: chatbot.userId._id })
        .sort({ createdAt: 1, _id: 1 })
        .select("_id");
      if (firstBot && !firstBot._id.equals(chatbot._id)) {
        return withCors(
          ApiResponse.error("The Free plan includes one chatbot. Upgrade this workspace to use additional bots.", 403),
          corsOrigin,
        );
      }
    }

    if (
      plan !== "free" &&
      subscription.currentPeriodEnd <= new Date() &&
      subscription.status !== "past_due"
    ) {
      return withCors(ApiResponse.error("Subscription billing period has expired", 402), corsOrigin);
    }

    const allowedDomains = chatbot.allowedDomains ?? [];
    const domainLimit = PLAN_ENTITLEMENTS[plan].maxAllowedDomains;
    const effectiveDomains = domainLimit === null ? allowedDomains : allowedDomains.slice(0, domainLimit);
    if (
      (plan === "free" && effectiveDomains.length === 0) ||
      (effectiveDomains.length > 0 && (!requestDomain || !effectiveDomains.includes(requestDomain)))
    ) {
      return withCors(
        ApiResponse.error(
          plan === "free" && effectiveDomains.length === 0
            ? "Add your website domain in the chatbot Embed settings before using the free widget."
            : "This chatbot is not enabled for this website domain.",
          403,
        ),
        corsOrigin,
      );
    }

    const mode = chatbot.settings.chatMode ?? "standard";
    if (!PLAN_ENTITLEMENTS[plan].modes.includes(mode)) {
      return withCors(
        ApiResponse.error("Smart mode requires the Pro plan or above. Switch this chatbot to Standard mode or upgrade the workspace.", 403),
        corsOrigin,
      );
    }
    const model = mode === "smart" ? SMART_MODEL : STANDARD_MODEL;
    const creditCharge = mode === "smart" ? 4 : 1;
    await Chatbot.updateOne({ _id: chatbot._id }, { $set: { lastTrafficAt: new Date() } });
    const reservation = await consumeCredits(
      subscription._id,
      creditCharge,
      PLAN_ENTITLEMENTS[plan].dailyCreditCap,
    );
    if (!reservation) {
      return withCors(
        ApiResponse.error(
          plan === "free" && subscription.dailyCreditsUsed >= 20
            ? "The Free daily cap of 20 credits has been reached. It resets at midnight UTC."
            : "This chatbot is out of credits. Replies resume when the monthly allowance resets or the workspace adds a top-up.",
          402,
        ),
        corsOrigin,
      );
    }
    reservedCredits = creditCharge;
    reservedAllocation = reservation.allocation;

    const prompt = `You are a professional customer support assistant for ${chatbot.businessName || "this business"}.
Use only the business information below. Do not invent policies, prices, or promises. If the answer is not supported by the information, reply exactly: "Please contact support: ${chatbot.businessEmail}".

BUSINESS INFORMATION
${chatbot.knowledgeBase || "No additional knowledge provided."}
${chatbot.settings.systemPrompt ? `\nADDITIONAL INSTRUCTIONS\n${chatbot.settings.systemPrompt}` : ""}

RECENT CONVERSATION
${getText(messageHistory.slice(-8, -1))}

CUSTOMER QUESTION
${latestUserMessage}`;

    const encoder = new TextEncoder();
    let clientDisconnected = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          if (!clientDisconnected) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        };

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const chunks = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config: {
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          let botReply = "";
          let inputTokens: number | undefined;
          let outputTokens: number | undefined;
          for await (const chunk of chunks) {
            const delta = chunk.text ?? "";
            if (delta) {
              botReply += delta;
              emit({ type: "delta", text: delta });
            }
            if (chunk.usageMetadata?.promptTokenCount !== undefined) {
              inputTokens = chunk.usageMetadata.promptTokenCount;
            }
            if (chunk.usageMetadata?.candidatesTokenCount !== undefined) {
              outputTokens = chunk.usageMetadata.candidatesTokenCount;
            }
          }

          botReply = botReply.trim() || `Please contact support: ${chatbot.businessEmail}`;
          emit({ type: "replace", text: botReply });
          const finalInputTokens = inputTokens ?? Math.ceil(prompt.length / 4);
          const finalOutputTokens = outputTokens ?? Math.ceil(botReply.length / 4);
          const usageCost = calculateUsageCost(finalInputTokens, finalOutputTokens, model);
          const occurredAt = new Date();
          const conversationVisitorId =
            typeof visitorId === "string" ? visitorId.trim() : `legacy-${crypto.randomUUID()}`;
          const usageRecord = await UsageRecord.create({
            userId: chatbot.userId._id,
            chatbotId: chatbot._id,
            units: 1,
            unitType: "request",
            creditsCharged: creditCharge,
            inputTokens: finalInputTokens,
            outputTokens: finalOutputTokens,
            provider: "google",
            model,
            ...(usageCost ? { costAmount: usageCost.amountUsd, costCurrency: "USD" } : {}),
            metadata: {
              mode,
              creditRule: mode === "smart" ? "4 credits per Smart reply" : "1 credit per Standard reply",
              ...(usageCost
                ? {
                    inputRateUsdPerMillion: String(usageCost.inputRateUsdPerMillion),
                    outputRateUsdPerMillion: String(usageCost.outputRateUsdPerMillion),
                    infrastructureUsdPerRequest: String(usageCost.infrastructureUsdPerRequest),
                  }
                : {}),
            },
            occurredAt,
          });

          let conversationId: Types.ObjectId | null = null;
          const visitorMessageAt = occurredAt;
          const assistantMessageAt = new Date();
          try {
            const conversation = await Conversation.findOneAndUpdate(
              { chatbotId: chatbot._id, visitorId: conversationVisitorId, status: "open" },
              {
                $set: { lastMessageAt: occurredAt },
                $setOnInsert: {
                  userId: chatbot.userId._id,
                  chatbotId: chatbot._id,
                  visitorId: conversationVisitorId,
                  startedAt: occurredAt,
                  status: "open",
                },
              },
              { new: true, upsert: true, setDefaultsOnInsert: true },
            );
            conversationId = conversation._id;
            await Message.create([
              { conversationId: conversation._id, role: "visitor", content: latestUserMessage, sentAt: visitorMessageAt },
              { conversationId: conversation._id, role: "assistant", content: botReply, sentAt: assistantMessageAt },
            ]);
          } catch (error: unknown) {
            if (conversationId) {
              await Message.deleteMany({
                conversationId,
                sentAt: { $in: [visitorMessageAt, assistantMessageAt] },
              });
            }
            await UsageRecord.deleteOne({ _id: usageRecord._id });
            throw error;
          }

          reservedCredits = 0;
          reservedAllocation = null;
          const refreshed = await Subscription.findById(subscription._id);
          if (refreshed) {
            try {
              await dispatchCreditAlerts({ subscription: refreshed, email: chatbot.userId.email });
            } catch (error: unknown) {
              console.error("Could not dispatch billing usage alerts:", error);
            }
          }
          const availableCredits =
            (refreshed?.creditBalance ?? 0) + (refreshed?.prepaidCreditBalance ?? 0);
          emit({
            type: "done",
            usage: {
              mode,
              creditsCharged: creditCharge,
              creditsRemaining: availableCredits,
            },
            brandingRemovalActive:
              (subscription.brandingRemovalActive &&
                (!subscription.brandingRemovalEndsAt || subscription.brandingRemovalEndsAt > new Date())) ||
              PLAN_ENTITLEMENTS[plan].brandingRemovalIncluded,
          });
        } catch (error: unknown) {
          if (reservedCredits > 0 && reservedAllocation) {
            try {
              await refundCredits(subscription._id, reservedAllocation);
              reservedCredits = 0;
              reservedAllocation = null;
            } catch (refundError: unknown) {
              console.error("Failed to refund reserved chat credits:", refundError);
            }
          }
          console.error("API Route Error [/api/chat stream]:", error);
          emit({ type: "error", message: "Chat processing failed. Please try again." });
        } finally {
          if (!clientDisconnected) controller.close();
        }
      },
      cancel() {
        clientDisconnected = true;
      },
    });

    const response = new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
    return withCors(response, corsOrigin);
  } catch (error: unknown) {
    if (subscriptionId && reservedCredits > 0 && reservedAllocation) {
      try {
        await refundCredits(subscriptionId, reservedAllocation);
      } catch (refundError: unknown) {
        console.error("Failed to refund reserved chat credits:", refundError);
      }
    }
    console.error("API Route Error [/api/chat]:", error);
    return withCors(ApiResponse.error("Chat processing failed. Please try again.", 500), corsOrigin);
  }
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }), null);
}
