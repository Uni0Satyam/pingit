"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  CREDIT_TOP_UP,
  PLAN_CATALOG,
  STARTER_BRANDING_ADDON,
  getPlanPrice,
  type BillingInterval,
  type EffectiveSubscriptionPlan,
  type PricingRegion,
} from "@/lib/planEntitlements";
import type { UserProfile } from "./types";

interface BillingOptions {
  region: PricingRegion;
  currency: "USD" | "EUR" | "INR";
  interval: BillingInterval;
  provider: "dodo" | "razorpay";
  creditTopUp: {
    credits: number;
    price: { amount: number; currency: "USD" | "EUR" | "INR" };
    available: boolean;
  };
  brandingAddonAvailable: boolean;
  planAvailability: Record<"starter" | "pro" | "business", boolean>;
  recentCreditUsage: Array<{
    id: string;
    chatbotName: string;
    occurredAt: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number | null;
    mode: string;
    creditsCharged: number;
    estimatedCost: number | null;
    costCurrency: string | null;
  }>;
  unitEconomics: {
    costedRequests: number;
    costedCredits: number;
    totalCostUsd: number;
    costPerCreditUsd: number | null;
    usdToInrRate: number | null;
    costPerCreditInr: number | null;
    costInputsConfigured: boolean;
  };
}

interface BillingTabProps {
  userProfile: UserProfile;
  onPlanChange: (plan: UserProfile["plan"]) => void;
  initialSelection?: {
    plan?: EffectiveSubscriptionPlan;
    region?: PricingRegion;
    interval?: BillingInterval;
  };
}

type BillingAction = "checkout" | "change" | "credits" | "portal" | "cancel" | "branding" | "branding-cancel";

export default function BillingTab({
  userProfile,
  onPlanChange,
  initialSelection,
}: BillingTabProps) {
  const [account, setAccount] = useState(userProfile);
  const [billingOptions, setBillingOptions] = useState<BillingOptions | null>(null);
  const [region, setRegion] = useState<PricingRegion>(
    initialSelection?.region ?? userProfile.pricingRegion,
  );
  const [interval, setInterval] = useState<BillingInterval>(
    initialSelection?.interval ?? userProfile.billingInterval,
  );
  const [creditAmount, setCreditAmount] = useState(String(CREDIT_TOP_UP.credits));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadBilling = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ region, interval });
        const [accountResponse, optionsResponse] = await Promise.all([
          fetch("/api/account/profile", { cache: "no-store", signal: controller.signal }),
          fetch(`/api/billing?${query.toString()}`, { cache: "no-store", signal: controller.signal }),
        ]);
        const accountResult = await accountResponse.json();
        const optionsResult = await optionsResponse.json();
        if (!accountResponse.ok || !accountResult.success || !accountResult.data) {
          throw new Error(accountResult.message || "Could not load account billing details.");
        }
        if (!optionsResponse.ok || !optionsResult.success || !optionsResult.data) {
          throw new Error(optionsResult.message || "Could not load billing options.");
        }
        setAccount(accountResult.data as UserProfile);
        onPlanChange(accountResult.data.plan as UserProfile["plan"]);
        setBillingOptions(optionsResult.data as BillingOptions);
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load billing details.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void loadBilling();
    return () => controller.abort();
  }, [interval, onPlanChange, refreshKey, region]);

  const runBillingAction = async (action: BillingAction, options?: { plan?: Exclude<EffectiveSubscriptionPlan, "free">; credits?: number }) => {
    const actionKey = options?.credits ? `credits-${options.credits}` : `${action}-${options?.plan ?? ""}`;
    setBillingAction(actionKey);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, region, interval, ...options }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not update billing.");
      }
      if (result.data?.url) {
        window.location.assign(result.data.url as string);
        return;
      }
      toast.add({
        type: "success",
        title: result.message || "Billing updated",
        description: result.data?.scheduledChange === "cycle_end"
          ? "Your current plan stays active until renewal."
          : "Refresh this page to see the latest subscription status.",
      });
      setRefreshKey((current) => current + 1);
    } catch (actionError: unknown) {
      toast.add({
        type: "error",
        title: "Billing action failed",
        description: actionError instanceof Error ? actionError.message : "Please try again.",
      });
    } finally {
      setBillingAction(null);
    }
  };

  const topUp = CREDIT_TOP_UP.price[region];
  const selectedCredits = Number(creditAmount);
  const topUpValid = Number.isSafeInteger(selectedCredits) &&
    selectedCredits >= CREDIT_TOP_UP.credits &&
    selectedCredits % CREDIT_TOP_UP.credits === 0;
  const topUpTotal = topUpValid
    ? (selectedCredits / CREDIT_TOP_UP.credits) * topUp.amount
    : null;
  const includedBalance = Math.max(0, account.monthlyCreditBalance ?? 0);
  const includedAllowance = Math.max(0, account.monthlyCreditAllowance ?? 0);
  const usageRatio = includedAllowance > 0
    ? Math.max(0, (account.creditsUsedThisPeriod ?? 0) / includedAllowance)
    : 0;
  const currencyFormat = (amount: number, currency: "USD" | "EUR" | "INR") =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "INR" ? 0 : 2,
    }).format(amount);
  const isCurrentPlanActive = account.plan !== "free" &&
    ["active", "trialing", "past_due"].includes(account.subscriptionStatus) &&
    new Date(account.currentPeriodEnd) > new Date();

  return (
    <div className="max-w-6xl space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-zinc-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Plans and usage</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Credits are charged per successful reply: Standard costs 1; Smart costs 4. Top-ups do not expire.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoading} className="gap-1.5">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {account.cancelAtPeriodEnd && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Cancellation is scheduled for {formatDate(account.currentPeriodEnd)}. Your plan remains active until then.
          </p>
        )}
        {account.subscriptionStatus === "past_due" && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Payment is past due{account.pastDueEndsAt ? `; paid features continue until ${formatDate(account.pastDueEndsAt)}` : ""}. Update payment details with your billing provider.
          </p>
        )}
        {usageRatio >= 1 ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
            You have used 100% of included credits. Replies use paid top-ups if available; otherwise they pause until the next monthly grant.
          </p>
        ) : usageRatio >= 0.8 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
            You have used {Math.floor(usageRatio * 100)}% of included monthly credits. {includedBalance.toLocaleString()} included credits remain.
          </p>
        ) : null}
        {account.dailyCreditCap !== null && account.dailyCreditCap !== undefined && (
          <p className="mt-3 text-xs text-zinc-500">
            Free daily cap: {account.dailyCreditsUsed.toLocaleString()} / {account.dailyCreditCap} credits used (resets at midnight UTC).
          </p>
        )}
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <div role="group" aria-label="Billing country" className="flex flex-wrap justify-center gap-2">
            {([["global", "Global · USD"], ["europe", "Europe · EUR"], ["india", "India · INR"]] as const).map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={region === value ? "default" : "outline"} aria-pressed={region === value} onClick={() => setRegion(value)}>{label}</Button>
            ))}
          </div>
          <div role="group" aria-label="Billing interval" className="flex gap-2">
            <Button type="button" size="sm" variant={interval === "monthly" ? "default" : "outline"} aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>Monthly</Button>
            <Button type="button" size="sm" variant={interval === "annual" ? "default" : "outline"} aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Annual · save 20%</Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["free", "starter", "pro", "business"] as const).map((plan) => {
            const price = getPlanPrice(plan, region, interval);
            const credits = PLAN_CATALOG[plan].credits[region === "india" ? "india" : "global"];
            const active = account.plan === plan && isCurrentPlanActive;
            const paidPlan = plan !== "free";
            const unavailable = paidPlan && !billingOptions?.planAvailability[plan];
            const planFeatures = plan === "free"
              ? ["200 monthly credits · 20 daily", "1 bot · 1 domain · 2 MB knowledge base", "Standard only · brand badge always on"]
              : plan === "starter"
                ? ["Standard · 1 credit per reply", "Brand removal add-on available", "Smart and Pro features start at Pro"]
                : ["Standard · 1 credit; Smart · 4 credits", "Lead capture, integrations, human handoff", "Brand removal included"];
            return (
              <article key={plan} className={`flex h-full flex-col rounded-2xl border bg-white p-5 ${plan === "pro" ? "border-indigo-300 ring-1 ring-indigo-100" : "border-zinc-200"}`}>
                <h3 className="font-semibold text-zinc-900">{PLAN_CATALOG[plan].name}</h3>
                <p className="mt-3 text-2xl font-semibold text-zinc-950">{currencyFormat(price.amount, price.currency)}<span className="ml-1.5 text-xs font-normal text-zinc-500">/ {interval === "annual" ? "year" : "month"}</span></p>
                {region === "europe" && <p className="mt-1 text-xs text-zinc-500">VAT excluded</p>}
                <p className="mt-3 text-sm font-medium text-zinc-700">{credits.toLocaleString()} credits each month</p>
                <ul className="mt-4 flex-1 space-y-2 text-xs leading-5 text-zinc-600">{planFeatures.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                {paidPlan && (
                  <Button type="button" className="mt-5 w-full" disabled={active || unavailable || billingAction !== null || isLoading} onClick={() => {
                    void runBillingAction(isCurrentPlanActive ? "change" : "checkout", { plan });
                  }}>
                    {billingAction === `${isCurrentPlanActive ? "change" : "checkout"}-${plan}`
                      ? "Opening secure checkout…"
                      : active ? "Current plan" : unavailable ? "Provider setup required" : isCurrentPlanActive ? `Change to ${PLAN_CATALOG[plan].name}` : `Choose ${PLAN_CATALOG[plan].name}`}
                  </Button>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 rounded-xl border border-zinc-200 p-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Transparent credit rules</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Standard uses Gemini 3.5 Flash-Lite and charges 1 credit for each reply. Smart uses Gemini 3.8 Flash with low thinking and charges 4 credits. Failed generations are refunded. Monthly included credits reset every month; top-ups are spent after included credits and never expire.
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Model cost estimates use the configured Gemini input/output rates and actual reported tokens. They exclude payment fees, tax, hosting, and storage unless you set an infrastructure cost estimate.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Add credits</h3>
            <p className="mt-2 text-sm text-zinc-600">
              {currencyFormat(topUp.amount, topUp.currency)} per {CREDIT_TOP_UP.credits.toLocaleString()} credits in this billing region.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs font-medium text-zinc-700" htmlFor="billing-credit-amount">
                Credits to add
                <Input id="billing-credit-amount" type="number" min={CREDIT_TOP_UP.credits} step={CREDIT_TOP_UP.credits} value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} className="h-9 w-40" />
              </label>
              <Button type="button" disabled={!billingOptions?.creditTopUp.available || !topUpValid || billingAction !== null || isLoading} onClick={() => void runBillingAction("credits", { credits: selectedCredits })}>
                {billingAction === `credits-${selectedCredits}` ? "Opening checkout…" : billingOptions?.creditTopUp.available ? `Add ${selectedCredits.toLocaleString()} for ${topUpTotal === null ? "—" : currencyFormat(topUpTotal, topUp.currency)}` : "Top-up provider setup required"}
              </Button>
            </div>
            {!topUpValid && <p className="mt-2 text-xs text-red-600">Choose a multiple of 1,000 credits.</p>}
          </div>
        </div>

        {account.plan === "starter" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Remove the Pingit badge</h3>
              <p className="mt-1 text-sm text-zinc-600">
                {account.brandingRemovalActive
                  ? `Brand removal is active${account.brandingRemovalEndsAt ? ` until ${formatDate(account.brandingRemovalEndsAt)}` : ""}.`
                  : `${currencyFormat(STARTER_BRANDING_ADDON.price[account.pricingRegion].amount, STARTER_BRANDING_ADDON.price[account.pricingRegion].currency)} per month. Pro and Business include it.`}
              </p>
            </div>
            {account.brandingRemovalActive ? (
              account.brandingRemovalCancelAtPeriodEnd ? (
                <span className="text-xs text-amber-700">Cancellation scheduled</span>
              ) : account.billingProvider === "razorpay" ? (
                <Button type="button" size="sm" variant="outline" disabled={billingAction !== null} onClick={() => void runBillingAction("branding-cancel")}>Cancel add-on at renewal</Button>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled={billingAction !== null} onClick={() => void runBillingAction("portal")}>Manage add-on</Button>
              )
            ) : (
              <Button type="button" size="sm" disabled={!billingOptions?.brandingAddonAvailable || billingAction !== null || isLoading} onClick={() => void runBillingAction("branding")}>
                {billingOptions?.brandingAddonAvailable ? "Add monthly branding removal" : "Provider setup required"}
              </Button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <p>Included: {includedBalance.toLocaleString()} / {includedAllowance.toLocaleString()} · Top-up: {account.prepaidCreditBalance.toLocaleString()} · Total: {account.creditBalance.toLocaleString()} credits</p>
          {isCurrentPlanActive && (
            <div className="flex flex-wrap gap-2">
              {account.billingProvider === "dodo" && account.canManageBilling && <Button type="button" size="sm" variant="outline" onClick={() => void runBillingAction("portal")}>Manage billing</Button>}
              {account.billingProvider === "razorpay" && !account.cancelAtPeriodEnd && <Button type="button" size="sm" variant="outline" onClick={() => void runBillingAction("cancel")}>Cancel at renewal</Button>}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-900">Recent credit usage</h3>
          <p className="mt-1 text-xs text-zinc-500">Each entry is one successful reply and shows its mode, credits, token count, and estimated model cost.</p>
        </div>
        {!billingOptions?.recentCreditUsage.length ? (
          <p className="px-5 py-6 text-sm text-zinc-500">Replies will appear here after your chatbot answers a visitor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-5 py-3 font-medium">Time</th><th className="px-5 py-3 font-medium">Chatbot</th><th className="px-5 py-3 font-medium">Mode / tokens</th><th className="px-5 py-3 font-medium">Credits</th><th className="px-5 py-3 font-medium">Estimated model cost</th></tr></thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">{billingOptions.recentCreditUsage.map((record) => <tr key={record.id}><td className="whitespace-nowrap px-5 py-3">{new Date(record.occurredAt).toLocaleString()}</td><td className="max-w-48 truncate px-5 py-3">{record.chatbotName}</td><td className="px-5 py-3">{record.mode} · {record.totalTokens === null ? "token details unavailable" : `${record.totalTokens.toLocaleString()} tokens`}</td><td className="px-5 py-3">{record.creditsCharged.toLocaleString()}</td><td className="px-5 py-3">{record.estimatedCost === null ? "No estimate" : `${record.estimatedCost.toFixed(5)} ${record.costCurrency ?? "USD"}`}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4 text-xs text-zinc-600">
          {billingOptions?.unitEconomics.costPerCreditUsd !== null && billingOptions?.unitEconomics.costPerCreditUsd !== undefined
            ? `Observed model cost: $${billingOptions.unitEconomics.costPerCreditUsd.toFixed(6)} per credit across ${billingOptions.unitEconomics.costedRequests.toLocaleString()} replies. This excludes payment fees and any unconfigured infrastructure cost.`
            : "Model cost estimates use Gemini's published token rates and reported usage. Infrastructure, payment fees, taxes, and storage are not included unless separately configured."}
          {region === "europe" && <span> EU plan prices exclude VAT; checkout applies provider taxes.</span>}
          {region === "india" && <span> GST is applied where configured and legally required.</span>}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : "Not available";
}
