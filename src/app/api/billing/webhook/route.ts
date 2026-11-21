import connectDB from "@/lib/db";
import {
  getCreditPack,
  getCreditPackForDodoProduct,
  getCreditRechargeCurrencyForProduct,
  getDodoBrandingAddonCurrencyForProduct,
  getDodoPayments,
  getDodoPlanProduct,
} from "@/lib/dodoPayments";
import { getPlanCredits } from "@/lib/planEntitlements";
import { ApiResponse } from "@/lib/apiResponse";
import BillingWebhookEvent from "@/models/billingWebhookEvent.model";
import Subscription, {
  addOneMonth,
  downgradeExpiredCanceledSubscription,
  ensureFreeSubscription,
} from "@/models/subscription.model";
import User from "@/models/user.model";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { NextRequest } from "next/server";

interface DodoWebhookEvent {
  type: string;
  timestamp?: string | number;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getWebhookEvent(value: unknown): DodoWebhookEvent | null {
  if (!isRecord(value) || typeof value.type !== "string" || !isRecord(value.data)) {
    return null;
  }
  return {
    type: value.type,
    timestamp:
      typeof value.timestamp === "string" || typeof value.timestamp === "number"
        ? value.timestamp
        : undefined,
    data: value.data,
  };
}

function getAppUserId(data: Record<string, unknown>) {
  if (!isRecord(data.metadata)) return null;
  return getString(data.metadata.app_user_id);
}

function getCustomerId(data: Record<string, unknown>) {
  const directId = getString(data.customer_id);
  if (directId) return directId;
  return isRecord(data.customer)
    ? getString(data.customer.customer_id)
    : null;
}

function getPaymentProductId(data: Record<string, unknown>) {
  const productId = getString(data.product_id);
  if (productId) return productId;
  if (Array.isArray(data.product_cart)) {
    const firstItem = data.product_cart.find(isRecord);
    if (firstItem) return getString(firstItem.product_id);
  }
  return null;
}

function getPaymentProductQuantity(
  data: Record<string, unknown>,
  productId: string,
) {
  if (!Array.isArray(data.product_cart)) return null;
  const product = data.product_cart.find(
    (item) => isRecord(item) && item.product_id === productId,
  );
  return isRecord(product) && typeof product.quantity === "number"
    ? product.quantity
    : null;
}

function getStatusForEvent(
  type: string,
  status: unknown,
):
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused"
  | null {
  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.unpaused":
      return "active";
    case "subscription.past_due":
      return "past_due";
    case "subscription.on_hold":
    case "subscription.paused":
      return "paused";
    case "subscription.cancelled":
    case "subscription.expired":
      return "canceled";
    case "subscription.failed":
      return "past_due";
    default:
      switch (status) {
        case "active":
          return "active";
        case "trialing":
          return "trialing";
        case "past_due":
          return "past_due";
        case "cancelled":
        case "canceled":
        case "expired":
          return "canceled";
        case "incomplete":
          return "incomplete";
        case "failed":
          return "past_due";
        case "on_hold":
        case "paused":
          return "paused";
        default:
          return null;
      }
  }
}

function isDuplicateKeyError(error: unknown) {
  return (
    isRecord(error) &&
    "code" in error &&
    error.code === 11000
  );
}

export async function POST(request: NextRequest) {
  const webhookId = request.headers.get("webhook-id");
  const signature = request.headers.get("webhook-signature");
  const timestamp = request.headers.get("webhook-timestamp");
  if (!webhookId || !signature || !timestamp) {
    return ApiResponse.error("Missing Dodo webhook signature headers", 400);
  }

  let event: DodoWebhookEvent | null;
  try {
    const payload = await request.text();
    event = getWebhookEvent(
      getDodoPayments(true).webhooks.unwrap(payload, {
        headers: {
          "webhook-id": webhookId,
          "webhook-signature": signature,
          "webhook-timestamp": timestamp,
        },
      }),
    );
  } catch (error: unknown) {
    console.warn("Dodo webhook signature verification failed:", error);
    return ApiResponse.error("Invalid Dodo webhook signature", 401);
  }

  if (!event) {
    return ApiResponse.error("Invalid Dodo webhook payload", 400);
  }

  try {
    await connectDB();
    if (await BillingWebhookEvent.exists({ eventId: webhookId })) {
      return ApiResponse.success({ received: true, duplicate: true });
    }

    if (event.type === "payment.succeeded") {
      const productId = getPaymentProductId(event.data);
      const packId = productId
        ? getCreditPackForDodoProduct(productId)
        : null;
      const rechargeCurrency = productId
        ? getCreditRechargeCurrencyForProduct(productId)
        : null;
      const isRechargeProduct = rechargeCurrency !== null;
      const rechargeProductQuantity =
        isRechargeProduct && productId
          ? getPaymentProductQuantity(event.data, productId)
          : null;
      const metadata = isRecord(event.data.metadata)
        ? event.data.metadata
        : null;
      const paymentId = getString(event.data.payment_id);
      const appUserId = metadata ? getString(metadata.app_user_id) : null;

      if (metadata?.purchase_type === "branding_addon") {
        if (!productId || !getDodoBrandingAddonCurrencyForProduct(productId) || !appUserId || !Types.ObjectId.isValid(appUserId)) {
          return ApiResponse.error("Branding add-on payment metadata is invalid", 400);
        }
        const user = await User.findById(appUserId).select("_id");
        if (!user) return ApiResponse.error("Branding add-on account was not found", 404);
        const subscription = await ensureFreeSubscription(user._id);
        const paymentAt = getDate(event.timestamp) ?? new Date();
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await BillingWebhookEvent.create(
              [{ eventId: webhookId, eventType: event.type, paymentId: paymentId ?? undefined, processedAt: new Date() }],
              { session },
            );
            await Subscription.updateOne(
              { _id: subscription._id },
              {
                $set: {
                  brandingRemovalActive: true,
                  brandingRemovalEndsAt: addOneMonth(paymentAt),
                  brandingRemovalCancelAtPeriodEnd: false,
                },
              },
              { session },
            );
          });
        } catch (error: unknown) {
          if (isDuplicateKeyError(error)) return ApiResponse.success({ received: true, duplicate: true });
          throw error;
        } finally {
          await session.endSession();
        }
        return ApiResponse.success({ received: true, brandingRemovalActive: true });
      }

      if (packId || isRechargeProduct) {
        const purchaseType = metadata?.purchase_type;
        const rechargeCredits =
          isRechargeProduct && typeof metadata?.credits === "string"
            ? Number(metadata.credits)
            : null;
        const pack = packId ? getCreditPack(packId) : null;
        const creditsToAdd = isRechargeProduct
          ? rechargeCredits
          : pack?.credits;
        if (
          (isRechargeProduct && purchaseType !== "credit_recharge") ||
          (packId && purchaseType !== "credit_pack") ||
          !paymentId ||
          !appUserId ||
          !Types.ObjectId.isValid(appUserId) ||
          !Number.isSafeInteger(creditsToAdd) ||
          !creditsToAdd ||
          creditsToAdd <= 0 ||
          (isRechargeProduct &&
            (creditsToAdd % 1_000 !== 0 ||
              rechargeProductQuantity !==
                creditsToAdd / 1_000))
        ) {
          return ApiResponse.error(
            "Credit payment is missing valid account or purchase metadata",
            400,
          );
        }
        const user = await User.findById(appUserId).select("_id");
        if (!user) {
          return ApiResponse.error("Credit purchase account was not found", 404);
        }
        await ensureFreeSubscription(user._id);

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            if (
              await BillingWebhookEvent.exists({ eventId: webhookId }).session(
                session,
              )
            ) {
              return;
            }
            await BillingWebhookEvent.create(
              [
                {
                  eventId: webhookId,
                  eventType: event.type,
                  paymentId,
                  processedAt: new Date(),
                },
              ],
              { session },
            );
            const customerId = getCustomerId(event.data);
            const update: {
              $inc: { prepaidCreditBalance: number };
              $set?: Record<string, string>;
            } = { $inc: { prepaidCreditBalance: creditsToAdd } };
            if (customerId) {
              update.$set = {
                billingProvider: "dodo",
                billingProviderCustomerId: customerId,
              };
            }
            const updated = await Subscription.findOneAndUpdate(
              { userId: user._id },
              update,
              { new: true, runValidators: true, session },
            );
            if (!updated) {
              throw new Error("Unable to apply purchased credits");
            }
          });
        } catch (error: unknown) {
          if (
            isDuplicateKeyError(error) &&
            (await BillingWebhookEvent.exists({
              $or: [{ eventId: webhookId }, { paymentId }],
            }))
          ) {
            return ApiResponse.success({ received: true, duplicate: true });
          }
          throw error;
        } finally {
          await session.endSession();
        }
        return ApiResponse.success({
          received: true,
          creditsAdded: creditsToAdd,
        });
      }

    } else if (event.type.startsWith("subscription.")) {
      const providerSubscriptionId = getString(event.data.subscription_id);
      if (!providerSubscriptionId) {
        return ApiResponse.error(
          "Subscription webhook is missing its subscription ID",
          400,
        );
      }

      const eventProductId = getString(event.data.product_id);
      const addonCurrency = eventProductId
        ? getDodoBrandingAddonCurrencyForProduct(eventProductId)
        : null;
      if (addonCurrency) {
        let brandingSubscription = await Subscription.findOne({
          brandingAddonProviderSubscriptionId: providerSubscriptionId,
        });
        if (!brandingSubscription) {
          const appUserId = getAppUserId(event.data);
          if (!appUserId || !Types.ObjectId.isValid(appUserId)) {
            return ApiResponse.error("Branding add-on subscription is not linked to an account", 400);
          }
          const user = await User.findById(appUserId).select("_id");
          if (!user) return ApiResponse.error("Branding add-on account was not found", 404);
          brandingSubscription = await ensureFreeSubscription(user._id);
        }
        const status = getStatusForEvent(event.type, event.data.status);
        const currentEnd = getDate(event.data.current_period_end) ?? addOneMonth(new Date());
        const graceEnd = getDate(event.data.past_due_ends_at) ??
          (status === "past_due" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null);
        const isCanceled = status === "canceled";
        const addonActive =
          currentEnd > new Date() &&
          ["active", "trialing", "past_due", "canceled"].includes(status ?? "");
        await Subscription.updateOne(
          { _id: brandingSubscription._id },
          {
            $set: {
              brandingAddonProviderSubscriptionId: providerSubscriptionId,
              brandingRemovalActive: addonActive,
              brandingRemovalEndsAt: graceEnd ?? currentEnd,
              brandingRemovalCancelAtPeriodEnd: isCanceled || event.data.cancel_at_next_billing_date === true,
            },
          },
        );
        try {
          await BillingWebhookEvent.create({ eventId: webhookId, eventType: event.type, processedAt: new Date() });
        } catch (error: unknown) {
          if (!isDuplicateKeyError(error)) throw error;
        }
        return ApiResponse.success({ received: true, brandingRemovalActive: !isCanceled });
      }

      let subscription = await Subscription.findOne({
        billingProviderSubscriptionId: providerSubscriptionId,
      });

      if (!subscription) {
        if (!eventProductId || !getDodoPlanProduct(eventProductId)) {
          return ApiResponse.success({ received: true, ignored: true });
        }
        const appUserId = getAppUserId(event.data);
        if (!appUserId || !Types.ObjectId.isValid(appUserId)) {
          return ApiResponse.error(
            "Subscription webhook is not linked to an account",
            400,
          );
        }
        const user = await User.findById(appUserId).select("_id");
        if (!user) {
          return ApiResponse.error("Subscription account was not found", 404);
        }
        subscription = await ensureFreeSubscription(user._id);
      }

      const eventAt = getDate(event.timestamp) ?? new Date();
      if (
        subscription.billingProviderUpdatedAt &&
        eventAt < subscription.billingProviderUpdatedAt
      ) {
        await BillingWebhookEvent.create({
          eventId: webhookId,
          eventType: event.type,
          processedAt: new Date(),
        });
        return ApiResponse.success({ received: true, stale: true });
      }

      const status = getStatusForEvent(event.type, event.data.status);
      const productId =
        getString(event.data.product_id) ??
        subscription.billingProviderProductId ??
        null;
      const planProduct =
        productId && event.type !== "subscription.updated"
          ? getDodoPlanProduct(productId)
          : null;
      const plan = planProduct?.plan ?? null;

      if (
        ["subscription.active", "subscription.renewed", "subscription.plan_changed"].includes(
          event.type,
        ) &&
        !plan
      ) {
        return ApiResponse.error(
          "Subscription webhook product does not match a configured plan",
          400,
        );
      }

      const periodStart =
        getDate(event.data.current_period_start) ??
        getDate(event.data.previous_billing_date) ??
        subscription.currentPeriodStart;
      const periodEnd =
        getDate(event.data.current_period_end) ??
        getDate(event.data.next_billing_date) ??
        subscription.currentPeriodEnd;
      const graceEnd =
        getDate(event.data.past_due_ends_at) ??
        (status === "past_due"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null);
      const nextPeriod =
        Boolean(plan) &&
        (periodStart > subscription.currentPeriodStart ||
          (event.type === "subscription.renewed" &&
            periodEnd > subscription.currentPeriodEnd));
      const planChanged = Boolean(plan) && plan !== subscription.plan;
      const resetCredits = Boolean(plan) && (nextPeriod || planChanged);
      const configuredAllowance = plan
        ? getPlanCredits(plan, planProduct?.region ?? subscription.pricingRegion)
        : subscription.monthlyCreditAllowance;
      const allowance = configuredAllowance;
      const nextStatus = status ?? subscription.status;
      const updateFields: Record<string, unknown> = {
        billingProvider: "dodo",
        billingProviderSubscriptionId: providerSubscriptionId,
        billingProviderUpdatedAt: eventAt,
        status: nextStatus,
      };

      const customerId = getCustomerId(event.data);
      if (customerId) {
        updateFields.billingProviderCustomerId = customerId;
      }
      if (productId) {
        updateFields.billingProviderProductId = productId;
      }
      if (typeof event.data.cancel_at_next_billing_date === "boolean") {
        updateFields.cancelAtPeriodEnd =
          event.data.cancel_at_next_billing_date;
      }
      if (event.type === "subscription.expired") {
        updateFields.cancelAtPeriodEnd = false;
      }
      const canceledAt = getDate(event.data.cancelled_at);
      if (canceledAt) {
        updateFields.canceledAt = canceledAt;
      }
      if (graceEnd) {
        updateFields.pastDueEndsAt = graceEnd;
      }
      if (nextStatus === "past_due" && graceEnd) {
        updateFields.currentPeriodEnd = graceEnd;
      } else if (getDate(event.data.current_period_end)) {
        updateFields.currentPeriodEnd = periodEnd;
      }

      if (plan) {
        updateFields.plan = plan;
        updateFields.monthlyCreditAllowance = allowance;
        updateFields.pricingRegion = planProduct?.region ?? subscription.pricingRegion;
        updateFields.pricingCurrency =
          planProduct?.region === "india"
            ? "INR"
            : planProduct?.region === "europe"
              ? "EUR"
              : "USD";
        updateFields.billingInterval = planProduct?.interval ?? subscription.billingInterval;
      }
      if (resetCredits) {
        updateFields.creditBalance = allowance;
        updateFields.creditsUsedThisPeriod = 0;
        updateFields.currentPeriodStart = periodStart;
        updateFields.currentPeriodEnd = periodEnd;
        updateFields.creditPeriodStart = periodStart;
        updateFields.creditPeriodEnd = addOneMonth(periodStart);
      }

      const update: {
        $set: Record<string, unknown>;
        $unset?: Record<string, 1>;
      } = { $set: updateFields };
      if (nextStatus !== "past_due") {
        update.$unset = { pastDueEndsAt: 1 };
      }

      const updateFilter: Record<string, unknown> = {
        _id: subscription._id,
        billingProviderUpdatedAt: subscription.billingProviderUpdatedAt
          ? subscription.billingProviderUpdatedAt
          : { $exists: false },
      };
      if (resetCredits) {
        updateFilter.plan = subscription.plan;
        updateFilter.currentPeriodStart = subscription.currentPeriodStart;
        updateFilter.currentPeriodEnd = subscription.currentPeriodEnd;
      }

      const updated = await Subscription.findOneAndUpdate(
        updateFilter,
        update,
        { runValidators: true, new: true },
      );
      if (!updated) {
        try {
          await BillingWebhookEvent.create({
            eventId: webhookId,
            eventType: event.type,
            processedAt: new Date(),
          });
        } catch (error: unknown) {
          if (!isDuplicateKeyError(error)) throw error;
        }
        return ApiResponse.success({ received: true, stale: true });
      }

      if (
        nextStatus === "canceled" &&
        periodEnd <= new Date()
      ) {
        await downgradeExpiredCanceledSubscription(subscription._id);
      }
    }

    try {
      await BillingWebhookEvent.create({
        eventId: webhookId,
        eventType: event.type,
        processedAt: new Date(),
      });
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    return ApiResponse.success({ received: true });
  } catch (error: unknown) {
    console.error("API Route Error [POST /api/billing/webhook]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Could not process Dodo webhook",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
