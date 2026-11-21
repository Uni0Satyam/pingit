import DodoPayments from "dodopayments";
import {
  CREDIT_TOP_UP,
  type BillingInterval,
  type EffectiveSubscriptionPlan,
  type PricingCurrency,
  type PricingRegion,
} from "@/lib/planEntitlements";

export type PaidSubscriptionPlan = Exclude<EffectiveSubscriptionPlan, "free">;
export type CreditPackId = "credits_1000" | "credits_5000";

export const CREDIT_PACK_IDS: CreditPackId[] = [
  "credits_1000",
  "credits_5000",
];

function currencyForRegion(region: PricingRegion): PricingCurrency {
  return region === "india" ? "INR" : region === "europe" ? "EUR" : "USD";
}

export function getCreditRechargeProductId(currency: PricingCurrency = "USD") {
  return (
    process.env[`DODO_CREDIT_TOPUP_${currency}_PRODUCT_ID`] ??
    (currency === "USD" ? process.env.DODO_CREDIT_RECHARGE_PRODUCT_ID : undefined)
  );
}

export function getCreditRechargeCurrencyForProduct(productId: string) {
  const currencies: PricingCurrency[] = ["USD", "EUR", "INR"];
  return currencies.find(
    (currency) => getCreditRechargeProductId(currency) === productId,
  ) ?? null;
}

export function getCreditTopUpCreditsPerProductUnit() {
  return CREDIT_TOP_UP.credits;
}

export function getDodoBrandingAddonProductId(currency: PricingCurrency) {
  return process.env[`DODO_STARTER_BRANDING_${currency}_MONTHLY_PRODUCT_ID`];
}

export function getDodoBrandingAddonCurrencyForProduct(productId: string) {
  const currencies: PricingCurrency[] = ["USD", "EUR", "INR"];
  return currencies.find(
    (currency) => getDodoBrandingAddonProductId(currency) === productId,
  ) ?? null;
}

export const CREDIT_PACKS: Record<
  CreditPackId,
  { name: string; credits: number; productId?: string }
> = {
  credits_1000: {
    name: "1,000 credits",
    credits: 1000,
    productId: process.env.DODO_CREDIT_PACK_1000_PRODUCT_ID,
  },
  credits_5000: {
    name: "5,000 credits",
    credits: 5000,
    productId: process.env.DODO_CREDIT_PACK_5000_PRODUCT_ID,
  },
};

let client: DodoPayments | undefined;

export function getDodoPayments(requireWebhookKey = false) {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT;

  if (!bearerToken) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured");
  }
  if (requireWebhookKey && !webhookKey) {
    throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is not configured");
  }
  if (environment !== "test_mode" && environment !== "live_mode") {
    throw new Error(
      "DODO_PAYMENTS_ENVIRONMENT must be set to test_mode or live_mode",
    );
  }

  if (!client) {
    client = new DodoPayments({
      bearerToken,
      webhookKey,
      environment,
    });
  }
  return client;
}

export function getDodoProductId(
  plan: PaidSubscriptionPlan,
  region: PricingRegion = "global",
  interval: BillingInterval = "monthly",
) {
  const currency = currencyForRegion(region);
  const productId =
    process.env[
      `DODO_${plan.toUpperCase()}_${currency}_${interval.toUpperCase()}_PRODUCT_ID`
    ] ??
    (plan === "starter" && region === "global" && interval === "monthly"
      ? process.env.DODO_PREMIUM_PRODUCT_ID
      : plan === "pro" && region === "global" && interval === "monthly"
        ? process.env.DODO_PREMIUM_PLUS_PRODUCT_ID
        : undefined);
  if (!productId) {
    throw new Error(
      `The Dodo Payments product for ${plan} (${currency}, ${interval}) is not configured`,
    );
  }
  return productId;
}

export function getDodoPlanProduct(
  productId: string,
): { plan: PaidSubscriptionPlan; region: PricingRegion; interval: BillingInterval } | null {
  const plans: PaidSubscriptionPlan[] = ["starter", "pro", "business"];
  const regions: PricingRegion[] = ["global", "europe", "india"];
  const intervals: BillingInterval[] = ["monthly", "annual"];
  for (const plan of plans) {
    for (const region of regions) {
      for (const interval of intervals) {
        try {
          if (getDodoProductId(plan, region, interval) === productId) {
            return { plan, region, interval };
          }
        } catch {
          // An unconfigured product is not part of the Dodo product map.
        }
      }
    }
  }
  if (productId === process.env.DODO_PREMIUM_PRODUCT_ID) {
    return { plan: "starter", region: "global", interval: "monthly" };
  }
  if (productId === process.env.DODO_PREMIUM_PLUS_PRODUCT_ID) {
    return { plan: "pro", region: "global", interval: "monthly" };
  }
  return null;
}

export function getPlanForDodoProduct(productId: string) {
  return getDodoPlanProduct(productId)?.plan ?? null;
}

export function getCreditPackForDodoProduct(productId: string) {
  return (
    CREDIT_PACK_IDS.find(
      (packId) => CREDIT_PACKS[packId].productId === productId,
    ) ?? null
  );
}

export function getCreditPack(packId: unknown) {
  if (packId === "credits_1000" || packId === "credits_5000") {
    return { id: packId, ...CREDIT_PACKS[packId] };
  }
  return null;
}
