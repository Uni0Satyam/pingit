"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleUserRound,
  CreditCard,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { UserProfile } from "./types";

interface SettingsTabProps {
  userProfile: UserProfile;
  profileName: string;
  onProfileNameChange: (name: string) => void;
  onBillingClick: () => void;
}

const PLAN_LABELS: Record<UserProfile["plan"], string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const STATUS_LABELS: Record<UserProfile["subscriptionStatus"], string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  paused: "Paused",
};

export default function SettingsTab({
  userProfile,
  profileName,
  onProfileNameChange,
  onBillingClick,
}: SettingsTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [savedName, setSavedName] = useState(profileName);
  const includedCreditUsage = Math.max(
    0,
    userProfile.monthlyCreditAllowance - userProfile.monthlyCreditBalance,
  );
  const includedCreditUsagePercent =
    userProfile.monthlyCreditAllowance > 0
      ? Math.min(
          100,
          (includedCreditUsage / userProfile.monthlyCreditAllowance) * 100,
        )
      : 0;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = profileName.trim();
    if (!name || name.length > 100) {
      toast.add({
        type: "error",
        title: "Check your display name",
        description: "Use between 1 and 100 characters.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result: {
        success: boolean;
        message: string;
        data?: { name: string };
      } = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Could not update your profile.");
      }

      onProfileNameChange(result.data.name);
      setSavedName(result.data.name);
      toast.add({
        type: "success",
        title: "Profile updated",
        description: "Your display name has been saved.",
      });
    } catch (error: unknown) {
      toast.add({
        type: "error",
        title: "Could not save profile",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-zinc-950 p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Sparkles size={16} className="text-indigo-300" />
              Your workspace
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                {PLAN_LABELS[userProfile.plan]}
              </h2>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200">
                {STATUS_LABELS[userProfile.subscriptionStatus]}
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">
              {userProfile.plan === "free"
                ? "Free includes 200 monthly credits, up to 20 credits per day, one bot, one domain, and a 2 MB knowledge base."
                : `${PLAN_LABELS[userProfile.plan]} includes ${userProfile.monthlyCreditAllowance.toLocaleString()} monthly credits.`} Extra credits are available in 1,000-credit packs.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-300">
              <span>
                <strong className="font-semibold text-white">
                  {userProfile.creditBalance.toLocaleString()}
                </strong>{" "}
                credits available
              </span>
              {userProfile.plan !== "free" && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  Renews {formatDate(userProfile.currentPeriodEnd)}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onBillingClick}
            className="relative gap-2 self-start sm:self-center"
          >
            {userProfile.canManageBilling ? "Manage billing" : "View plans"}
            <ArrowUpRight size={15} />
          </Button>
        </div>
        {userProfile.cancelAtPeriodEnd && (
          <p className="relative mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            Your subscription is set to end on{" "}
            {formatDate(userProfile.currentPeriodEnd)}. Your plan remains active
            until then.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                {userProfile.plan === "free"
                  ? "Free monthly credits"
                  : `${PLAN_LABELS[userProfile.plan]} monthly credits`}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
                {userProfile.monthlyCreditBalance.toLocaleString()}
                <span className="ml-1.5 text-sm font-normal text-zinc-400">
                  remaining
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <CreditCard size={19} />
            </div>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-label={
              userProfile.plan === "free"
                ? "Lifetime credit usage"
                : "Monthly credit usage"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(includedCreditUsagePercent)}
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width]"
              style={{ width: `${includedCreditUsagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {includedCreditUsage.toLocaleString()} of{" "}
            {userProfile.monthlyCreditAllowance.toLocaleString()} used{" "}
            {userProfile.plan === "free" ? "in total" : "this month"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Recharged credits
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
                {userProfile.prepaidCreditBalance.toLocaleString()}
                <span className="ml-1.5 text-sm font-normal text-zinc-400">
                  available
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <Check size={19} />
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Recharged credits do not expire and are used after your included
            {userProfile.plan === "free" ? " lifetime" : " monthly"} credits.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-zinc-100 p-2.5 text-zinc-600">
            <CircleUserRound size={19} />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900">Account profile</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Update how your account is identified in Support-Ease.
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-zinc-700">
            Display name
            <Input
              value={profileName}
              onChange={(event) => onProfileNameChange(event.target.value)}
              autoComplete="name"
              maxLength={100}
              required
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-zinc-700">
            Email address
            <span className="relative block">
              <Mail
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <Input
                type="email"
                value={userProfile.email}
                readOnly
                aria-readonly="true"
                className="pl-9 text-zinc-500"
              />
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <p className="text-xs text-zinc-500">
              Email is managed by your sign-in provider.
            </p>
            <Button
              type="submit"
              disabled={
                isSaving ||
                !profileName.trim() ||
                profileName.trim() === savedName
              }
              className="gap-2"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
