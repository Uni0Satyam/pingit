import type { BillingInterval, EffectiveSubscriptionPlan } from "@/lib/planEntitlements";

type RazorpayRecord = Record<string, unknown>;

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API keys are not configured");
  }
  return { keyId, keySecret };
}

async function razorpayRequest(
  path: string,
  body: RazorpayRecord,
  method = "POST",
) {
  const { keyId, keySecret } = getCredentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null) {
    const message =
      typeof result === "object" && result !== null && "error" in result &&
      typeof result.error === "object" && result.error !== null &&
      "description" in result.error && typeof result.error.description === "string"
        ? result.error.description
        : "Razorpay could not create the billing link";
    throw new Error(message);
  }
  return result as RazorpayRecord;
}

export function getRazorpayPlanId(
  plan: Exclude<EffectiveSubscriptionPlan, "free">,
  interval: BillingInterval,
) {
  return process.env[`RAZORPAY_${plan.toUpperCase()}_${interval.toUpperCase()}_PLAN_ID`];
}

export function getRazorpayPlanDetails(planId: string) {
  for (const plan of ["starter", "pro", "business"] as const) {
    for (const interval of ["monthly", "annual"] as const) {
      if (getRazorpayPlanId(plan, interval) === planId) return { plan, interval };
    }
  }
  return null;
}

export function isRazorpayBrandingPlan(planId: string) {
  return planId === process.env.RAZORPAY_STARTER_BRANDING_MONTHLY_PLAN_ID;
}

export function isRazorpayBrandingPlanConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_STARTER_BRANDING_MONTHLY_PLAN_ID);
}

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpaySubscriptionLink(input: {
  plan: Exclude<EffectiveSubscriptionPlan, "free">;
  interval: BillingInterval;
  email: string;
  userId: string;
}) {
  const planId = getRazorpayPlanId(input.plan, input.interval);
  if (!planId) {
    throw new Error(`Razorpay ${input.plan} ${input.interval} plan ID is not configured`);
  }
  const result = await razorpayRequest("/subscriptions", {
    plan_id: planId,
    total_count: input.interval === "annual" ? 10 : 120,
    quantity: 1,
    customer_notify: 1,
    notify_info: { notify_email: input.email },
    notes: {
      app_user_id: input.userId,
      plan: input.plan,
      pricing_region: "india",
      billing_interval: input.interval,
    },
  });
  if (typeof result.id !== "string" || typeof result.short_url !== "string") {
    throw new Error("Razorpay did not return a subscription link");
  }
  return { id: result.id, url: result.short_url };
}

export async function createRazorpayBrandingSubscriptionLink(input: {
  email: string;
  userId: string;
}) {
  const planId = process.env.RAZORPAY_STARTER_BRANDING_MONTHLY_PLAN_ID;
  if (!planId) throw new Error("Razorpay Starter branding add-on plan ID is not configured");
  const result = await razorpayRequest("/subscriptions", {
    plan_id: planId,
    total_count: 120,
    quantity: 1,
    customer_notify: 1,
    notify_info: { notify_email: input.email },
    notes: { app_user_id: input.userId, purchase_type: "branding_addon" },
  });
  if (typeof result.id !== "string" || typeof result.short_url !== "string") {
    throw new Error("Razorpay did not return a branding add-on link");
  }
  return { id: result.id, url: result.short_url };
}

export async function createRazorpayCreditLink(input: {
  credits: number;
  amountRupees: number;
  email: string;
  userId: string;
}) {
  const result = await razorpayRequest("/payment_links", {
    amount: input.amountRupees * 100,
    currency: "INR",
    accept_partial: false,
    description: `${input.credits.toLocaleString()} Pingit AI credits`,
    customer: { email: input.email },
    notify: { email: true, sms: false },
    reminder_enable: false,
    notes: {
      app_user_id: input.userId,
      purchase_type: "credit_recharge",
      credits: String(input.credits),
    },
  });
  if (typeof result.id !== "string" || typeof result.short_url !== "string") {
    throw new Error("Razorpay did not return a credit payment link");
  }
  return { id: result.id, url: result.short_url };
}

export async function updateRazorpaySubscription(input: {
  subscriptionId: string;
  plan: Exclude<EffectiveSubscriptionPlan, "free">;
  interval: BillingInterval;
  scheduleChangeAt: "now" | "cycle_end";
}) {
  const planId = getRazorpayPlanId(input.plan, input.interval);
  if (!planId) {
    throw new Error(`Razorpay ${input.plan} ${input.interval} plan ID is not configured`);
  }
  await razorpayRequest(
    `/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
    { plan_id: planId, schedule_change_at: input.scheduleChangeAt },
    "PATCH",
  );
}

export async function cancelRazorpaySubscription(subscriptionId: string) {
  await razorpayRequest(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { cancel_at_cycle_end: 1 },
  );
}
