import type { SubscriptionPlan } from "@/models/subscription.model";

export type EffectiveSubscriptionPlan = "free" | "starter" | "pro" | "business";
export type PricingRegion = "global" | "europe" | "india";
export type PricingCurrency = "USD" | "EUR" | "INR";
export type BillingInterval = "monthly" | "annual";
export type ChatMode = "standard" | "smart";

export interface PlanEntitlements {
  monthlyCredits: number;
  dailyCreditCap: number | null;
  maxChatbots: number | null;
  maxAllowedDomains: number | null;
  maxKnowledgeBaseBytes: number | null;
  modes: readonly ChatMode[];
  conversations: boolean;
  analytics: boolean;
  leadCapture: boolean;
  integrations: boolean;
  humanHandoff: boolean;
  brandingRemovalIncluded: boolean;
  brandingRemovalAddonAvailable: boolean;
}

interface PlanPrice {
  amount: number;
  currency: PricingCurrency;
}

interface PlanDefinition {
  name: string;
  credits: Record<"global" | "india", number>;
  monthlyPrice: Record<PricingRegion, PlanPrice>;
  entitlements: PlanEntitlements;
}

const paidEntitlements = (credits: number): PlanEntitlements => ({
  monthlyCredits: credits,
  dailyCreditCap: null,
  maxChatbots: null,
  maxAllowedDomains: null,
  maxKnowledgeBaseBytes: null,
  modes: ["standard"],
  conversations: true,
  analytics: true,
  leadCapture: false,
  integrations: false,
  humanHandoff: false,
  brandingRemovalIncluded: false,
  brandingRemovalAddonAvailable: true,
});

export const PLAN_CATALOG: Record<EffectiveSubscriptionPlan, PlanDefinition> = {
  free: {
    name: "Free",
    credits: { global: 200, india: 200 },
    monthlyPrice: {
      global: { amount: 0, currency: "USD" },
      europe: { amount: 0, currency: "EUR" },
      india: { amount: 0, currency: "INR" },
    },
    entitlements: {
      monthlyCredits: 200,
      dailyCreditCap: 20,
      maxChatbots: 1,
      maxAllowedDomains: 1,
      maxKnowledgeBaseBytes: 2 * 1024 * 1024,
      modes: ["standard"],
      conversations: true,
      analytics: true,
      leadCapture: false,
      integrations: false,
      humanHandoff: false,
      brandingRemovalIncluded: false,
      brandingRemovalAddonAvailable: false,
    },
  },
  starter: {
    name: "Starter",
    credits: { global: 2_000, india: 1_000 },
    monthlyPrice: {
      global: { amount: 25, currency: "USD" },
      europe: { amount: 25, currency: "EUR" },
      india: { amount: 999, currency: "INR" },
    },
    entitlements: {
      ...paidEntitlements(2_000),
      monthlyCredits: 2_000,
      brandingRemovalAddonAvailable: true,
    },
  },
  pro: {
    name: "Pro",
    credits: { global: 10_000, india: 6_000 },
    monthlyPrice: {
      global: { amount: 79, currency: "USD" },
      europe: { amount: 79, currency: "EUR" },
      india: { amount: 3_499, currency: "INR" },
    },
    entitlements: {
      ...paidEntitlements(10_000),
      monthlyCredits: 10_000,
      modes: ["standard", "smart"],
      leadCapture: true,
      integrations: true,
      humanHandoff: true,
      brandingRemovalIncluded: true,
    },
  },
  business: {
    name: "Business",
    credits: { global: 40_000, india: 20_000 },
    monthlyPrice: {
      global: { amount: 199, currency: "USD" },
      europe: { amount: 199, currency: "EUR" },
      india: { amount: 8_999, currency: "INR" },
    },
    entitlements: {
      ...paidEntitlements(40_000),
      monthlyCredits: 40_000,
      modes: ["standard", "smart"],
      leadCapture: true,
      integrations: true,
      humanHandoff: true,
      brandingRemovalIncluded: true,
    },
  },
};

export const CREDIT_TOP_UP = {
  credits: 1_000,
  price: {
    global: { amount: 5, currency: "USD" as const },
    europe: { amount: 5, currency: "EUR" as const },
    india: { amount: 399, currency: "INR" as const },
  },
};

export const STARTER_BRANDING_ADDON = {
  price: {
    global: { amount: 10, currency: "USD" as const },
    europe: { amount: 10, currency: "EUR" as const },
    india: { amount: 499, currency: "INR" as const },
  },
};

export const ANNUAL_DISCOUNT = 0.2;
export const LEGACY_PLAN_MAP: Partial<Record<SubscriptionPlan, EffectiveSubscriptionPlan>> = {
  free: "free",
  starter: "starter",
  pro: "pro",
  business: "business",
  premium: "starter",
  premium_plus: "pro",
};

export const PLAN_ENTITLEMENTS: Record<EffectiveSubscriptionPlan, PlanEntitlements> =
  Object.fromEntries(
    Object.entries(PLAN_CATALOG).map(([plan, definition]) => [
      plan,
      definition.entitlements,
    ]),
  ) as Record<EffectiveSubscriptionPlan, PlanEntitlements>;

export function getPlanPrice(
  plan: EffectiveSubscriptionPlan,
  region: PricingRegion,
  interval: BillingInterval,
) {
  const monthly = PLAN_CATALOG[plan].monthlyPrice[region];
  if (interval === "monthly" || monthly.amount === 0) return monthly;
  const annualAmount = monthly.amount * 12 * (1 - ANNUAL_DISCOUNT);
  return {
    currency: monthly.currency,
    amount:
      monthly.currency === "INR"
        ? Math.round(annualAmount)
        : Number(annualAmount.toFixed(2)),
  } satisfies PlanPrice;
}

export function getPlanCredits(
  plan: EffectiveSubscriptionPlan,
  region: PricingRegion,
) {
  return PLAN_CATALOG[plan].credits[region === "india" ? "india" : "global"];
}

interface SubscriptionPlanState {
  plan: SubscriptionPlan;
  status: string;
  currentPeriodEnd: Date;
  pastDueEndsAt?: Date;
}

export function getEffectivePlan(
  subscription: SubscriptionPlanState,
  now = new Date(),
): EffectiveSubscriptionPlan {
  const plan = LEGACY_PLAN_MAP[subscription.plan] ?? "free";
  if (plan === "free") return "free";
  if (
    subscription.status === "past_due" &&
    (!subscription.pastDueEndsAt || subscription.pastDueEndsAt <= now)
  ) {
    return "free";
  }
  if (
    subscription.status !== "past_due" &&
    subscription.currentPeriodEnd <= now
  ) {
    return "free";
  }
  if (
    !["active", "trialing", "past_due", "canceled"].includes(
      subscription.status,
    )
  ) {
    return "free";
  }
  return plan;
}

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeAllowedDomains(
  values: unknown,
): { domains: string[] } | { error: string } {
  if (
    !Array.isArray(values) ||
    !values.every((value): value is string => typeof value === "string")
  ) {
    return { error: "Allowed domains must be a list of domain names" };
  }

  const domains: string[] = [];
  for (const value of values) {
    const domain = normalizeDomain(value);
    if (!domain) {
      return { error: "Enter valid domain names without paths or credentials" };
    }
    domains.push(domain);
  }
  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length !== domains.length) {
    return { error: "Remove duplicate domains" };
  }
  return { domains: uniqueDomains };
}
