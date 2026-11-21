import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import { getPlanCredits } from "@/lib/planEntitlements";
import {
  getRazorpayPlanDetails,
  isRazorpayBrandingPlan,
} from "@/lib/razorpayPayments";
import BillingWebhookEvent from "@/models/billingWebhookEvent.model";
import Subscription, {
  addOneMonth,
  ensureFreeSubscription,
} from "@/models/subscription.model";
import User from "@/models/user.model";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isValidSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function getEntity(payload: JsonRecord, key: string) {
  const eventPayload = getRecord(payload.payload);
  const typedPayload = eventPayload ? getRecord(eventPayload[key]) : null;
  return typedPayload ? getRecord(typedPayload.entity) : null;
}

function isDuplicateKeyError(error: unknown) {
  return isRecord(error) && error.code === 11000;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!webhookSecret || !signature || !eventId) {
    return ApiResponse.error("Missing Razorpay webhook configuration or signature", 400);
  }

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, signature, webhookSecret)) {
    return ApiResponse.error("Invalid Razorpay webhook signature", 401);
  }

  let payload: JsonRecord & { event: string };
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed) || typeof parsed.event !== "string") {
      return ApiResponse.error("Invalid Razorpay webhook payload", 400);
    }
    payload = parsed as JsonRecord & { event: string };
  } catch {
    return ApiResponse.error("Invalid Razorpay webhook JSON", 400);
  }

  try {
    await connectDB();
    const storedEventId = `razorpay:${eventId}`;
    if (await BillingWebhookEvent.exists({ eventId: storedEventId })) {
      return ApiResponse.success({ received: true, duplicate: true });
    }

    if (payload.event === "payment_link.paid") {
      const link = getEntity(payload, "payment_link");
      const notes = link ? getRecord(link.notes) : null;
      const appUserId = notes ? getString(notes.app_user_id) : null;
      const purchaseType = notes ? getString(notes.purchase_type) : null;
      const credits = notes ? Number(notes.credits) : NaN;
      const amountPaid = link?.amount_paid;
      if (
        purchaseType !== "credit_recharge" ||
        !appUserId ||
        !Types.ObjectId.isValid(appUserId) ||
        !Number.isSafeInteger(credits) ||
        credits < 1_000 ||
        credits % 1_000 !== 0 ||
        typeof amountPaid !== "number" ||
        amountPaid !== (credits / 1_000) * 399 * 100
      ) {
        return ApiResponse.error("Razorpay top-up metadata or paid amount is invalid", 400);
      }
      const user = await User.findById(appUserId).select("_id");
      if (!user) return ApiResponse.error("Top-up account was not found", 404);
      await ensureFreeSubscription(user._id);
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await BillingWebhookEvent.create(
            [{ eventId: storedEventId, eventType: payload.event as string, processedAt: new Date() }],
            { session },
          );
          const updated = await Subscription.findOneAndUpdate(
            { userId: user._id },
            { $inc: { prepaidCreditBalance: credits } },
            { new: true, session, runValidators: true },
          );
          if (!updated) throw new Error("Could not apply the purchased top-up");
        });
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) {
          return ApiResponse.success({ received: true, duplicate: true });
        }
        throw error;
      } finally {
        await session.endSession();
      }
      return ApiResponse.success({ received: true, creditsAdded: credits });
    }

    if (!payload.event.startsWith("subscription.")) {
      return ApiResponse.success({ received: true, ignored: true });
    }
    const entity = getEntity(payload, "subscription");
    if (!entity) return ApiResponse.error("Subscription event payload is missing its entity", 400);
    const providerSubscriptionId = getString(entity.id);
    if (!providerSubscriptionId) return ApiResponse.error("Subscription ID is missing", 400);
    const notes = getRecord(entity.notes);
    const planId = getString(entity.plan_id);

    let subscription = await Subscription.findOne({
      billingProvider: "razorpay",
      $or: [
        { billingProviderSubscriptionId: providerSubscriptionId },
        { brandingAddonProviderSubscriptionId: providerSubscriptionId },
      ],
    });
    if (!subscription) {
      const appUserId = notes ? getString(notes.app_user_id) : null;
      if (!appUserId || !Types.ObjectId.isValid(appUserId)) {
        return ApiResponse.error("Subscription is not linked to an account", 400);
      }
      const user = await User.findById(appUserId).select("_id");
      if (!user) return ApiResponse.error("Subscription account was not found", 404);
      subscription = await ensureFreeSubscription(user._id);
    }

    const isBrandingAddon =
      (planId && isRazorpayBrandingPlan(planId)) ||
      subscription.brandingAddonProviderSubscriptionId === providerSubscriptionId ||
      notes?.purchase_type === "branding_addon";
    if (isBrandingAddon) {
      const currentEnd = getDate(entity.current_end) ??
        (payload.event === "subscription.activated" || payload.event === "subscription.charged"
          ? addOneMonth(new Date())
          : new Date());
      const pastDue = payload.event === "subscription.halted" ||
        (payload.event === "subscription.pending" && subscription.brandingRemovalActive);
      const canceled = ["subscription.cancelled", "subscription.completed"].includes(payload.event);
      const active = ["subscription.activated", "subscription.charged", "subscription.resumed"].includes(payload.event);
      await Subscription.updateOne(
        { _id: subscription._id },
        {
          $set: {
            brandingAddonProviderSubscriptionId: providerSubscriptionId,
            brandingRemovalActive:
              active || pastDue || (canceled && currentEnd > new Date()),
            brandingRemovalEndsAt: pastDue
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              : currentEnd,
            brandingRemovalCancelAtPeriodEnd:
              canceled || entity.cancel_at_cycle_end === true,
          },
        },
      );
      try {
        await BillingWebhookEvent.create({ eventId: storedEventId, eventType: payload.event, processedAt: new Date() });
      } catch (error: unknown) {
        if (!isDuplicateKeyError(error)) throw error;
      }
      return ApiResponse.success({ received: true, brandingRemovalActive: !canceled });
    }

    const planDetails = planId ? getRazorpayPlanDetails(planId) : null;
    const plan = planDetails?.plan ?? (notes ? getString(notes.plan) : null);
    if (plan !== "starter" && plan !== "pro" && plan !== "business") {
      return ApiResponse.error("Subscription plan does not map to a configured India plan", 400);
    }
    const interval = planDetails?.interval ??
      (notes?.billing_interval === "annual" ? "annual" : "monthly");
    const eventAt = getDate(payload.created_at) ?? new Date();
    if (subscription.billingProviderUpdatedAt && eventAt < subscription.billingProviderUpdatedAt) {
      await BillingWebhookEvent.create({ eventId: storedEventId, eventType: payload.event, processedAt: new Date() });
      return ApiResponse.success({ received: true, stale: true });
    }

    const event = payload.event;
    const active = ["subscription.activated", "subscription.charged", "subscription.resumed"].includes(event);
    const pastDue =
      event === "subscription.halted" ||
      (event === "subscription.pending" && subscription.status !== "incomplete");
    const incomplete = event === "subscription.pending" && subscription.status === "incomplete";
    const canceled = event === "subscription.cancelled" || event === "subscription.completed";
    const paused = event === "subscription.paused";
    const currentStart = getDate(entity.current_start) ?? subscription.currentPeriodStart;
    const currentEnd = getDate(entity.current_end) ?? subscription.currentPeriodEnd;
    const resetAllowance = active && (
      plan !== subscription.plan ||
      currentStart > subscription.currentPeriodStart ||
      currentEnd > subscription.currentPeriodEnd ||
      subscription.status === "incomplete"
    );
    const allowance = getPlanCredits(plan, "india");
    const update: Record<string, unknown> = {
      billingProvider: "razorpay",
      billingProviderSubscriptionId: providerSubscriptionId,
      billingProviderProductId: planId ?? subscription.billingProviderProductId,
      billingProviderUpdatedAt: eventAt,
      plan,
      pricingRegion: "india",
      pricingCurrency: "INR",
      billingInterval: interval,
      monthlyCreditAllowance: allowance,
      ...(active ? { status: "active" } : {}),
      ...(pastDue ? { status: "past_due", pastDueEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } : {}),
      ...(incomplete ? { status: "incomplete" } : {}),
      ...(canceled ? { status: "canceled", cancelAtPeriodEnd: false } : {}),
      ...(paused ? { status: "paused" } : {}),
      ...(typeof entity.cancel_at_cycle_end === "boolean" ? { cancelAtPeriodEnd: entity.cancel_at_cycle_end } : {}),
      ...(active ? { currentPeriodStart: currentStart, currentPeriodEnd: currentEnd } : {}),
      ...(resetAllowance
        ? {
            creditBalance: allowance,
            creditsUsedThisPeriod: 0,
            creditPeriodStart: currentStart,
            creditPeriodEnd: addOneMonth(currentStart),
          }
        : {}),
    };
    const unset: Record<string, 1> = pastDue ? {} : { pastDueEndsAt: 1 };
    if (subscription.pendingPlan && subscription.pendingPlan === plan) {
      unset.pendingPlan = 1;
      unset.pendingBillingInterval = 1;
    }
    await Subscription.updateOne({ _id: subscription._id }, { $set: update, $unset: unset });
    try {
      await BillingWebhookEvent.create({ eventId: storedEventId, eventType: event, processedAt: new Date() });
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    return ApiResponse.success({ received: true });
  } catch (error: unknown) {
    console.error("API Route Error [POST /api/billing/razorpay-webhook]:", error);
    return ApiResponse.error(
      "Could not process Razorpay webhook",
      500,
      process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
    );
  }
}
