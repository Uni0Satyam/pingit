import { getSession } from "@/app/utils/getSession";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import {
  CREDIT_TOP_UP,
  getPlanCredits,
  getPlanPrice,
  type BillingInterval,
  type EffectiveSubscriptionPlan,
  type PricingRegion,
} from "@/lib/planEntitlements";
import {
  getDodoBrandingAddonProductId,
  getCreditRechargeProductId,
  getDodoPayments,
  getDodoProductId,
} from "@/lib/dodoPayments";
import {
  cancelRazorpaySubscription,
  createRazorpayCreditLink,
  createRazorpayBrandingSubscriptionLink,
  createRazorpaySubscriptionLink,
  getRazorpayPlanId,
  isRazorpayConfigured,
  isRazorpayBrandingPlanConfigured,
  updateRazorpaySubscription,
} from "@/lib/razorpayPayments";
import { calculateUsageCost, getUsdToInrRate } from "@/lib/usageCost";
import { ensureFreeSubscription } from "@/models/subscription.model";
import User from "@/models/user.model";
import UsageRecord from "@/models/usageRecord.model";
import Subscription from "@/models/subscription.model";
import type { NextRequest } from "next/server";
import type { Types } from "mongoose";

interface BillingAccount {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  subscription: {
    _id: Types.ObjectId;
    plan: string;
    status: string;
    billingProvider: string;
    billingProviderCustomerId?: string;
    billingProviderSubscriptionId?: string;
    pricingRegion: PricingRegion;
    billingInterval: BillingInterval;
    monthlyCreditAllowance: number;
    currentPeriodEnd: Date;
    brandingRemovalActive: boolean;
    brandingRemovalEndsAt?: Date;
    brandingAddonProviderSubscriptionId?: string;
    brandingRemovalCancelAtPeriodEnd: boolean;
  };
}

const PAID_PLANS: readonly Exclude<EffectiveSubscriptionPlan, "free">[] = [
  "starter",
  "pro",
  "business",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getBillingContext() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return { response: ApiResponse.error("Authentication required", 401) };

  await connectDB();
  const user = await User.findOne({ userId }).select("_id email name");
  if (!user) return { response: ApiResponse.error("Account not found", 404) };
  const subscription = await ensureFreeSubscription(user._id);
  return { account: { ...user.toObject(), subscription } as BillingAccount };
}

function dashboardUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  return new URL("/dashboard?tab=billing", appUrl).toString();
}

function getRegion(value: unknown, fallback: PricingRegion): PricingRegion | null {
  if (value === undefined) return fallback;
  return value === "global" || value === "europe" || value === "india" ? value : null;
}

function getInterval(value: unknown, fallback: BillingInterval): BillingInterval | null {
  if (value === undefined) return fallback;
  return value === "monthly" || value === "annual" ? value : null;
}

function productAvailable(plan: Exclude<EffectiveSubscriptionPlan, "free">, region: PricingRegion, interval: BillingInterval) {
  if (region === "india") {
    return isRazorpayConfigured() && Boolean(getRazorpayPlanId(plan, interval));
  }
  try {
    return Boolean(getDodoProductId(plan, region, interval));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getBillingContext();
    if ("response" in context) return context.response;
    const { account } = context;
    const searchParams = new URL(request.url).searchParams;
    const region = getRegion(searchParams.get("region") ?? undefined, account.subscription.pricingRegion);
    const interval = getInterval(searchParams.get("interval") ?? undefined, account.subscription.billingInterval);
    if (!region || !interval) return ApiResponse.error("Choose a valid billing region and interval", 400);
    const currency = region === "india" ? "INR" : region === "europe" ? "EUR" : "USD";
    const [summary, recentCreditUsage] = await Promise.all([
      UsageRecord.aggregate<{
        costedRequests: number;
        costedCredits: number;
        totalCostUsd: number;
      }>([
        { $match: { userId: account._id } },
        {
          $group: {
            _id: null,
            costedRequests: { $sum: { $cond: [{ $isNumber: "$costAmount" }, 1, 0] } },
            costedCredits: { $sum: { $cond: [{ $isNumber: "$costAmount" }, "$creditsCharged", 0] } },
            totalCostUsd: { $sum: { $cond: [{ $isNumber: "$costAmount" }, "$costAmount", 0] } },
          },
        },
        { $project: { _id: 0, costedRequests: 1, costedCredits: 1, totalCostUsd: 1 } },
      ]),
      UsageRecord.find({ userId: account._id })
        .sort({ occurredAt: -1 })
        .limit(10)
        .populate("chatbotId", "name")
        .lean(),
    ]);
    const costedRequests = summary[0]?.costedRequests ?? 0;
    const costedCredits = summary[0]?.costedCredits ?? 0;
    const totalCostUsd = summary[0]?.totalCostUsd ?? 0;
    const usdToInrRate = getUsdToInrRate();

    return ApiResponse.success({
      region,
      currency,
      interval,
      provider: region === "india" ? "razorpay" : "dodo",
      creditTopUp: {
        credits: CREDIT_TOP_UP.credits,
        price: CREDIT_TOP_UP.price[region],
        available:
          region === "india"
            ? isRazorpayConfigured()
            : Boolean(getCreditRechargeProductId(currency)),
      },
      brandingAddonAvailable:
        account.subscription.pricingRegion === "india"
          ? isRazorpayBrandingPlanConfigured()
          : Boolean(
              getDodoBrandingAddonProductId(
                account.subscription.pricingRegion === "europe" ? "EUR" : "USD",
              ),
            ),
      planAvailability: Object.fromEntries(
        PAID_PLANS.map((plan) => [
          plan,
          productAvailable(plan, region, interval),
        ]),
      ),
      recentCreditUsage: recentCreditUsage.map((record) => {
        const chatbot = record.chatbotId as unknown as { name?: string } | null;
        return {
          id: String(record._id),
          chatbotName: chatbot?.name ?? "Deleted chatbot",
          occurredAt: record.occurredAt,
          inputTokens: record.inputTokens ?? 0,
          outputTokens: record.outputTokens ?? 0,
          totalTokens: record.inputTokens === undefined && record.outputTokens === undefined
            ? null
            : (record.inputTokens ?? 0) + (record.outputTokens ?? 0),
          mode: record.metadata?.mode ?? "standard",
          creditsCharged: record.creditsCharged,
          estimatedCost: record.costAmount ?? null,
          costCurrency: record.costCurrency ?? null,
        };
      }),
      unitEconomics: {
        costedRequests,
        costedCredits,
        totalCostUsd,
        costPerCreditUsd: costedCredits > 0 ? totalCostUsd / costedCredits : null,
        usdToInrRate,
        costPerCreditInr: costedCredits > 0 && usdToInrRate ? (totalCostUsd / costedCredits) * usdToInrRate : null,
        costInputsConfigured: calculateUsageCost(0, 0) !== null,
      },
    }, 200, "Regional plans, top-ups, and usage fetched");
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/billing]:", error);
    return ApiResponse.error(
      "Could not load billing options",
      500,
      process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return ApiResponse.error("Invalid JSON request body", 400);
    }
    if (!isRecord(parsed) || typeof parsed.action !== "string") {
      return ApiResponse.error("A valid billing action is required", 400);
    }
    const context = await getBillingContext();
    if ("response" in context) return context.response;
    const { account } = context;
    const subscription = account.subscription;

    if (parsed.action === "credits") {
      const credits = parsed.credits;
      if (!Number.isSafeInteger(credits) || typeof credits !== "number" || credits < CREDIT_TOP_UP.credits || credits % CREDIT_TOP_UP.credits !== 0) {
        return ApiResponse.error(`Top-ups must be in blocks of ${CREDIT_TOP_UP.credits.toLocaleString()} credits`, 400);
      }
      const region = getRegion(parsed.region, subscription.pricingRegion);
      if (!region) return ApiResponse.error("Choose a valid billing region", 400);
      if (region === "india") {
        const checkout = await createRazorpayCreditLink({
          credits,
          amountRupees: (credits / CREDIT_TOP_UP.credits) * CREDIT_TOP_UP.price.india.amount,
          email: account.email,
          userId: account._id.toString(),
        });
        return ApiResponse.success({ url: checkout.url }, 200, "Razorpay top-up link created");
      }
      const currency = region === "europe" ? "EUR" : "USD";
      const productId = getCreditRechargeProductId(currency);
      if (!productId) return ApiResponse.error(`Dodo ${currency} top-up product is not configured`, 503);
      const checkout = await getDodoPayments().checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: credits / CREDIT_TOP_UP.credits }],
        customer: { email: account.email, name: account.name },
        return_url: dashboardUrl(),
        metadata: {
          app_user_id: account._id.toString(),
          purchase_type: "credit_recharge",
          credits: String(credits),
          pricing_region: region,
        },
      });
      return ApiResponse.success({ url: checkout.checkout_url }, 200, "Credit top-up checkout created");
    }

    if (parsed.action === "branding") {
      if (subscription.plan !== "starter" && subscription.plan !== "premium") {
        return ApiResponse.error("Brand removal is a Starter add-on and is already included in Pro and Business", 409);
      }
      if (
        subscription.brandingRemovalActive &&
        subscription.brandingRemovalEndsAt &&
        subscription.brandingRemovalEndsAt > new Date()
      ) {
        return ApiResponse.error("Brand removal is already active for this workspace", 409);
      }
      if (subscription.pricingRegion === "india") {
        const checkout = await createRazorpayBrandingSubscriptionLink({
          email: account.email,
          userId: account._id.toString(),
        });
        await Subscription.updateOne(
          { _id: subscription._id },
          { $set: { brandingAddonProviderSubscriptionId: checkout.id, brandingRemovalCancelAtPeriodEnd: false } },
        );
        return ApiResponse.success({ url: checkout.url }, 200, "Razorpay branding add-on checkout created");
      }
      const currency = subscription.pricingRegion === "europe" ? "EUR" : "USD";
      const productId = getDodoBrandingAddonProductId(currency);
      if (!productId) return ApiResponse.error(`Dodo ${currency} branding add-on is not configured`, 503);
      const checkout = await getDodoPayments().checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: account.email, name: account.name },
        return_url: dashboardUrl(),
        metadata: { app_user_id: account._id.toString(), purchase_type: "branding_addon" },
      });
      return ApiResponse.success({ url: checkout.checkout_url }, 200, "Dodo branding add-on checkout created");
    }

    if (parsed.action === "branding-cancel") {
      if (subscription.billingProvider !== "razorpay" || !subscription.brandingAddonProviderSubscriptionId) {
        return ApiResponse.error("No Razorpay branding add-on is linked to this workspace", 409);
      }
      await cancelRazorpaySubscription(subscription.brandingAddonProviderSubscriptionId);
      await Subscription.updateOne(
        { _id: subscription._id },
        { $set: { brandingRemovalCancelAtPeriodEnd: true } },
      );
      return ApiResponse.success({ scheduled: true }, 200, "Branding add-on cancellation scheduled");
    }

    if (parsed.action === "portal") {
      if (subscription.billingProvider !== "dodo" || !subscription.billingProviderCustomerId) {
        return ApiResponse.error("Manage the active Razorpay subscription with the in-app cancel or plan-change controls", 409);
      }
      const portal = await getDodoPayments().customers.customerPortal.create(
        subscription.billingProviderCustomerId,
        { return_url: dashboardUrl() },
      );
      return ApiResponse.success({ url: portal.link }, 200, "Billing portal opened");
    }

    if (parsed.action === "cancel") {
      if (subscription.billingProvider !== "razorpay" || !subscription.billingProviderSubscriptionId) {
        return ApiResponse.error("No Razorpay subscription is linked to this workspace", 409);
      }
      await cancelRazorpaySubscription(subscription.billingProviderSubscriptionId);
      await Subscription.updateOne(
        { _id: subscription._id },
        { $set: { cancelAtPeriodEnd: true } },
      );
      return ApiResponse.success({ scheduled: true }, 200, "Subscription cancellation scheduled");
    }

    if (parsed.action !== "checkout" && parsed.action !== "change") {
      return ApiResponse.error("A valid billing action is required", 400);
    }
    if (!PAID_PLANS.includes(parsed.plan as (typeof PAID_PLANS)[number])) {
      return ApiResponse.error("Choose Starter, Pro, or Business", 400);
    }
    const plan = parsed.plan as Exclude<EffectiveSubscriptionPlan, "free">;
    const region = getRegion(parsed.region, subscription.pricingRegion);
    const interval = getInterval(parsed.interval, subscription.billingInterval);
    if (!region || !interval) return ApiResponse.error("Choose a valid billing region and interval", 400);

    const hasActivePlan = subscription.plan !== "free" &&
      ["active", "trialing", "past_due"].includes(subscription.status) &&
      subscription.currentPeriodEnd > new Date();
    if (hasActivePlan && parsed.action === "checkout") {
      return ApiResponse.error("Use Change plan or your billing portal to modify the active subscription", 409);
    }
    if (hasActivePlan && parsed.action === "change") {
      if (subscription.billingProvider === "razorpay" && subscription.billingProviderSubscriptionId && region === "india") {
        const currentPlan = PAID_PLANS.includes(subscription.plan as (typeof PAID_PLANS)[number])
          ? subscription.plan as Exclude<EffectiveSubscriptionPlan, "free">
          : "starter";
        const currentPrice = getPlanPrice(currentPlan, subscription.pricingRegion, subscription.billingInterval).amount;
        const nextPrice = getPlanPrice(plan, region, interval).amount;
        const scheduleChangeAt = nextPrice > currentPrice ? "now" : "cycle_end";
        await updateRazorpaySubscription({
          subscriptionId: subscription.billingProviderSubscriptionId,
          plan,
          interval,
          scheduleChangeAt,
        });
        if (scheduleChangeAt === "now") {
          const allowance = getPlanCredits(plan, region);
          await Subscription.updateOne(
            { _id: subscription._id },
            {
              $set: {
                plan,
                pricingRegion: region,
                pricingCurrency: "INR",
                billingInterval: interval,
                monthlyCreditAllowance: allowance,
                creditBalance: allowance,
                creditsUsedThisPeriod: 0,
                creditPeriodStart: new Date(),
                creditPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            },
          );
        } else {
          await Subscription.updateOne({ _id: subscription._id }, { $set: { pendingPlan: plan, pendingBillingInterval: interval } });
        }
        return ApiResponse.success({ scheduledChange: scheduleChangeAt }, 200, scheduleChangeAt === "now" ? "Upgrade applied" : "Downgrade scheduled for renewal");
      }
      if (subscription.billingProvider === "dodo" && subscription.billingProviderCustomerId) {
        const portal = await getDodoPayments().customers.customerPortal.create(
          subscription.billingProviderCustomerId,
          { return_url: dashboardUrl() },
        );
        return ApiResponse.success({ url: portal.link }, 200, "Use the billing portal to change the active plan");
      }
      return ApiResponse.error("This active subscription cannot be changed through the configured billing provider", 409);
    }

    if (region === "india") {
      const checkout = await createRazorpaySubscriptionLink({
        plan,
        interval,
        email: account.email,
        userId: account._id.toString(),
      });
      await Subscription.updateOne(
        { _id: subscription._id },
        {
          $set: {
            billingProvider: "razorpay",
            billingProviderSubscriptionId: checkout.id,
            plan,
            status: "incomplete",
            pricingRegion: region,
            pricingCurrency: "INR",
            billingInterval: interval,
          },
        },
      );
      return ApiResponse.success({ url: checkout.url }, 200, "Razorpay subscription checkout created");
    }

    const productId = getDodoProductId(plan, region, interval);
    const checkout = await getDodoPayments().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: account.email, name: account.name },
      return_url: dashboardUrl(),
      metadata: {
        app_user_id: account._id.toString(),
        plan,
        pricing_region: region,
        billing_interval: interval,
      },
    });
    return ApiResponse.success({ url: checkout.checkout_url }, 200, "Dodo subscription checkout created");
  } catch (error: unknown) {
    console.error("API Route Error [POST /api/billing]:", error);
    return ApiResponse.error(
      "Could not start the billing action",
      502,
      process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined,
    );
  }
}
