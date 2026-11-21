import mongoose, {
  model,
  Schema,
  Types,
  type HydratedDocument,
} from "mongoose";
import {
  getPlanCredits,
  type EffectiveSubscriptionPlan,
  type PricingCurrency,
  type PricingRegion,
} from "@/lib/planEntitlements";

export type SubscriptionPlan =
  | EffectiveSubscriptionPlan
  | "premium"
  | "premium_plus";
export interface CreditAllocation {
  lifetime: number;
  monthly: number;
  prepaid: number;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused";

export interface ISubscription {
  userId: Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingProvider: string;
  billingProviderCustomerId?: string;
  billingProviderSubscriptionId?: string;
  billingProviderProductId?: string;
  billingProviderUpdatedAt?: Date;
  pastDueEndsAt?: Date;
  pricingRegion: PricingRegion;
  pricingCurrency: PricingCurrency;
  billingInterval: "monthly" | "annual";
  monthlyCreditAllowance: number;
  creditBalance: number;
  lifetimeCreditBalance: number;
  lastCreditAllocation?: CreditAllocation;
  prepaidCreditBalance: number;
  chatbotCount: number;
  creditsUsedThisPeriod: number;
  dailyCreditsUsed: number;
  dailyCreditDate?: string;
  creditPeriodStart: Date;
  creditPeriodEnd: Date;
  brandingRemovalActive: boolean;
  brandingRemovalEndsAt?: Date;
  brandingAddonProviderSubscriptionId?: string;
  brandingRemovalCancelAtPeriodEnd: boolean;
  pendingPlan?: Exclude<EffectiveSubscriptionPlan, "free">;
  pendingBillingInterval?: "monthly" | "annual";
  warning80PeriodStart?: Date;
  warning100PeriodStart?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      enum: ["free", "starter", "pro", "business", "premium", "premium_plus"],
      required: true,
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "incomplete", "paused"],
      required: true,
      default: "active",
    },
    billingProvider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "free",
    },
    billingProviderCustomerId: {
      type: String,
      trim: true,
    },
    billingProviderSubscriptionId: {
      type: String,
      trim: true,
    },
    billingProviderProductId: {
      type: String,
      trim: true,
    },
    billingProviderUpdatedAt: Date,
    pastDueEndsAt: Date,
    pricingRegion: {
      type: String,
      enum: ["global", "europe", "india"],
      default: "global",
      required: true,
    },
    pricingCurrency: {
      type: String,
      enum: ["USD", "EUR", "INR"],
      default: "USD",
      required: true,
    },
    billingInterval: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
      required: true,
    },
    monthlyCreditAllowance: {
      type: Number,
      required: true,
      min: 0,
    },
    creditBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    lifetimeCreditBalance: {
      type: Number,
      min: 0,
    },
    lastCreditAllocation: {
      lifetime: { type: Number, min: 0 },
      monthly: { type: Number, min: 0 },
      prepaid: { type: Number, min: 0 },
    },
    prepaidCreditBalance: {
      type: Number,
      min: 0,
      default: 0,
    },
    chatbotCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    creditsUsedThisPeriod: {
      type: Number,
      min: 0,
      default: 0,
    },
    dailyCreditsUsed: {
      type: Number,
      min: 0,
      default: 0,
    },
    dailyCreditDate: String,
    creditPeriodStart: { type: Date, required: true, default: Date.now },
    creditPeriodEnd: { type: Date, required: true, default: () => addOneMonth(new Date()) },
    brandingRemovalActive: { type: Boolean, default: false },
    brandingRemovalEndsAt: Date,
    brandingAddonProviderSubscriptionId: { type: String, trim: true },
    brandingRemovalCancelAtPeriodEnd: { type: Boolean, default: false },
    pendingPlan: {
      type: String,
      enum: ["starter", "pro", "business"],
    },
    pendingBillingInterval: {
      type: String,
      enum: ["monthly", "annual"],
    },
    warning80PeriodStart: Date,
    warning100PeriodStart: Date,
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      default: () => addOneMonth(new Date()),
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: Date,
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1 }, { unique: true });
subscriptionSchema.index(
  { billingProviderSubscriptionId: 1 },
  { unique: true, sparse: true },
);

const Subscription =
  mongoose.models.Subscription ||
  model<ISubscription>("Subscription", subscriptionSchema);

export const PLAN_MONTHLY_CREDITS: Record<SubscriptionPlan, number> = {
  free: getPlanCredits("free", "global"),
  starter: getPlanCredits("starter", "global"),
  pro: getPlanCredits("pro", "global"),
  business: getPlanCredits("business", "global"),
  premium: getPlanCredits("starter", "global"),
  premium_plus: getPlanCredits("pro", "global"),
};

export function addOneMonth(date: Date) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export async function refreshMonthlyCredits(
  subscription: HydratedDocument<ISubscription>,
  now = new Date(),
) {
  if (subscription.creditPeriodEnd > now) return subscription;

  let periodStart = subscription.creditPeriodEnd;
  let periodEnd = addOneMonth(periodStart);
  let elapsedPeriods = 1;
  while (periodEnd <= now && elapsedPeriods < 1_200) {
    periodStart = periodEnd;
    periodEnd = addOneMonth(periodStart);
    elapsedPeriods += 1;
  }

  return (
    (await Subscription.findOneAndUpdate(
      { _id: subscription._id, creditPeriodEnd: { $lte: now } },
      {
        $set: {
          creditPeriodStart: periodStart,
          creditPeriodEnd: periodEnd,
          creditBalance: subscription.monthlyCreditAllowance,
          creditsUsedThisPeriod: 0,
        },
        $unset: {
          warning80PeriodStart: 1,
          warning100PeriodStart: 1,
        },
      },
      { new: true, runValidators: true },
    )) ?? (await Subscription.findById(subscription._id)) ?? subscription
  );
}

export async function ensureFreeSubscription(
  userId: Types.ObjectId,
): Promise<HydratedDocument<ISubscription>> {
  const periodStart = new Date();
  const periodEnd = addOneMonth(periodStart);

  try {
    const subscription = await Subscription.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          plan: "free",
          status: "active",
          billingProvider: "free",
          pricingRegion: "global",
          pricingCurrency: "USD",
          billingInterval: "monthly",
          monthlyCreditAllowance: PLAN_MONTHLY_CREDITS.free,
          creditBalance: PLAN_MONTHLY_CREDITS.free,
          lifetimeCreditBalance: 0,
          prepaidCreditBalance: 0,
          dailyCreditsUsed: 0,
          dailyCreditDate: periodStart.toISOString().slice(0, 10),
          creditPeriodStart: periodStart,
          creditPeriodEnd: periodEnd,
          creditsUsedThisPeriod: 0,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    if (!subscription) {
      throw new Error("Unable to initialize user subscription");
    }
    const plan =
      subscription.plan === "premium"
        ? "starter"
        : subscription.plan === "premium_plus"
          ? "pro"
          : subscription.plan;
    const needsFreeMigration =
      plan === "free" &&
      (subscription.monthlyCreditAllowance !== PLAN_MONTHLY_CREDITS.free ||
        subscription.lifetimeCreditBalance === undefined ||
        subscription.lifetimeCreditBalance > 0);
    const needsPaidMigration =
      plan !== "free" && plan !== subscription.plan;
    const needsSchemaBackfill =
      !subscription.creditPeriodStart ||
      !subscription.creditPeriodEnd ||
      !subscription.pricingRegion ||
      !subscription.pricingCurrency ||
      !subscription.billingInterval ||
      subscription.dailyCreditsUsed === undefined;

    if (!needsFreeMigration && !needsPaidMigration && !needsSchemaBackfill) {
      return subscription;
    }

    const region: PricingRegion = subscription.pricingRegion ?? "global";
    const allowance =
      plan === "free"
        ? PLAN_MONTHLY_CREDITS.free
        : getPlanCredits(plan, region);
    const migrated = await Subscription.findOneAndUpdate(
      { _id: subscription._id },
      {
        $set: {
          plan,
          pricingRegion: region,
          pricingCurrency:
            subscription.pricingCurrency ??
            (region === "india" ? "INR" : region === "europe" ? "EUR" : "USD"),
          billingInterval: subscription.billingInterval ?? "monthly",
          monthlyCreditAllowance: allowance,
          ...(needsFreeMigration || needsPaidMigration
            ? {
                creditBalance: allowance,
                creditsUsedThisPeriod: 0,
                creditPeriodStart: periodStart,
                creditPeriodEnd: periodEnd,
              }
            : {
                creditPeriodStart:
                  subscription.creditPeriodStart ?? subscription.currentPeriodStart,
                creditPeriodEnd:
                  subscription.creditPeriodEnd ?? subscription.currentPeriodEnd,
              }),
          lifetimeCreditBalance: 0,
          dailyCreditsUsed: 0,
          ...(subscription.dailyCreditDate
            ? {}
            : { dailyCreditDate: periodStart.toISOString().slice(0, 10) }),
          brandingRemovalActive:
            subscription.brandingRemovalActive ?? false,
        },
      },
      { new: true, runValidators: true },
    );
    if (!migrated) {
      throw new Error("Unable to migrate subscription to the current plan catalog");
    }
    return migrated;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await Subscription.findOne({ userId });
      if (existing) {
        return existing.lifetimeCreditBalance !== undefined
          ? existing
          : ensureFreeSubscription(userId);
      }
    }
    throw error;
  }
}

export async function consumeCredits(
  subscriptionId: Types.ObjectId,
  amount: number,
  dailyCreditCap: number | null = null,
) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }

  const now = new Date();
  const dailyCreditDate = now.toISOString().slice(0, 10);
  const filter: Record<string, unknown> = {
    _id: subscriptionId,
    status: { $in: ["active", "trialing", "past_due", "canceled"] },
    $or: [
      { plan: "free" },
      { currentPeriodEnd: { $gt: now } },
      { status: "past_due", pastDueEndsAt: { $gt: now } },
    ],
    $expr: {
      $gte: [
        {
          $add: [
            { $ifNull: ["$creditBalance", 0] },
            { $ifNull: ["$prepaidCreditBalance", 0] },
          ],
        },
        amount,
      ],
    },
  };
  if (dailyCreditCap !== null) {
    filter.$and = [
      {
        $or: [
          { plan: { $ne: "free" } },
          { dailyCreditDate: { $ne: dailyCreditDate } },
          {
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ["$dailyCreditsUsed", 0] }, amount] },
                dailyCreditCap,
              ],
            },
          },
        ],
      },
    ];
  }

  const updated = await Subscription.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          dailyCreditsUsed: {
            $cond: [
              { $eq: [{ $ifNull: ["$dailyCreditDate", ""] }, dailyCreditDate] },
              { $ifNull: ["$dailyCreditsUsed", 0] },
              0,
            ],
          },
          dailyCreditDate,
        },
      },
      {
        $set: {
          lastCreditAllocation: {
            lifetime: 0,
            monthly: { $min: [amount, { $ifNull: ["$creditBalance", 0] }] },
            prepaid: {
              $max: [
                0,
                {
                  $subtract: [
                    amount,
                    { $ifNull: ["$creditBalance", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $set: {
          creditBalance: {
            $subtract: [
              { $ifNull: ["$creditBalance", 0] },
              "$lastCreditAllocation.monthly",
            ],
          },
          prepaidCreditBalance: {
            $subtract: [
              { $ifNull: ["$prepaidCreditBalance", 0] },
              "$lastCreditAllocation.prepaid",
            ],
          },
          creditsUsedThisPeriod: {
            $add: [{ $ifNull: ["$creditsUsedThisPeriod", 0] }, amount],
          },
          dailyCreditsUsed: {
            $cond: [
              { $eq: ["$plan", "free"] },
              { $add: [{ $ifNull: ["$dailyCreditsUsed", 0] }, amount] },
              { $ifNull: ["$dailyCreditsUsed", 0] },
            ],
          },
        },
      },
    ],
    { new: true, runValidators: true },
  );
  if (!updated) return null;
  if (!updated.lastCreditAllocation) {
    throw new Error("Credit allocation was not recorded");
  }
  return {
    subscription: updated,
    allocation: updated.lastCreditAllocation,
  };
}

export async function refundCredits(
  subscriptionId: Types.ObjectId,
  allocation: CreditAllocation,
) {
  const amount = allocation.lifetime + allocation.monthly + allocation.prepaid;
  if (
    !Object.values(allocation).every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    amount <= 0
  ) {
    throw new Error("Credit amount must be a positive integer");
  }

  return Subscription.findOneAndUpdate(
    { _id: subscriptionId },
    [
      {
        $set: {
          creditRefund: {
            lifetime: 0,
            monthly: {
              $min: [
                allocation.monthly + allocation.lifetime,
                {
                  $max: [
                    0,
                    {
                      $subtract: [
                        "$monthlyCreditAllowance",
                        { $ifNull: ["$creditBalance", 0] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $set: {
          lifetimeCreditBalance: {
            $add: [
              { $ifNull: ["$lifetimeCreditBalance", 0] },
              "$creditRefund.lifetime",
            ],
          },
          creditBalance: {
            $add: [
              { $ifNull: ["$creditBalance", 0] },
              "$creditRefund.monthly",
            ],
          },
          prepaidCreditBalance: {
            $add: [
              { $ifNull: ["$prepaidCreditBalance", 0] },
              allocation.prepaid,
              {
                $subtract: [
                  allocation.lifetime + allocation.monthly,
                  "$creditRefund.monthly",
                ],
              },
            ],
          },
          creditsUsedThisPeriod: {
            $max: [
              0,
              { $subtract: [{ $ifNull: ["$creditsUsedThisPeriod", 0] }, amount] },
            ],
          },
          dailyCreditsUsed: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: ["$dailyCreditsUsed", 0] },
                  amount,
                ],
              },
            ],
          },
        },
      },
      { $unset: "creditRefund" },
    ],
    { new: true, runValidators: true },
  );
}

export async function downgradeExpiredCanceledSubscription(
  subscriptionId: Types.ObjectId,
  now = new Date(),
) {
  return Subscription.findOneAndUpdate(
    {
      _id: subscriptionId,
      plan: { $ne: "free" },
      $or: [
        { status: "canceled", currentPeriodEnd: { $lte: now } },
        { status: "past_due", pastDueEndsAt: { $lte: now } },
      ],
    },
    {
      $set: {
        plan: "free",
        status: "active",
        billingProvider: "free",
        monthlyCreditAllowance: PLAN_MONTHLY_CREDITS.free,
        creditBalance: PLAN_MONTHLY_CREDITS.free,
        lifetimeCreditBalance: 0,
        creditsUsedThisPeriod: 0,
        creditPeriodStart: now,
        creditPeriodEnd: addOneMonth(now),
        dailyCreditsUsed: 0,
        brandingRemovalActive: false,
        currentPeriodStart: now,
        currentPeriodEnd: addOneMonth(now),
        cancelAtPeriodEnd: false,
        canceledAt: now,
      },
      $unset: {
        billingProviderSubscriptionId: 1,
        billingProviderProductId: 1,
        pastDueEndsAt: 1,
        billingProviderCustomerId: 1,
      },
    },
    { new: true, runValidators: true },
  );
}

export default Subscription;
