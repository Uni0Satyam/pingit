import { redirect } from "next/navigation";
import { getSession } from "../utils/getSession";
import connectDB from "@/lib/db";
import User from "@/models/user.model";
import {
  downgradeExpiredCanceledSubscription,
  ensureFreeSubscription,
  refreshMonthlyCredits,
} from "@/models/subscription.model";
import { getEffectivePlan, PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import DashboardClient from "@/components/DashboardClient";
import type { UserProfile } from "@/components/dashboard/types";
import StoreProvider from "@/store/StoreProvider";

export default async function DashboardContent() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const rawUser = session.user;
  const providerName = [
    rawUser?.userProfile?.firstName,
    rawUser?.userProfile?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  await connectDB();
  const account = rawUser?.id
    ? await User.findOne({ userId: rawUser.id })
        .select("_id userId name email createdAt updatedAt")
        .lean()
    : null;
  let subscription = account
    ? await ensureFreeSubscription(account._id)
    : null;
  if (subscription) {
    subscription =
      (await downgradeExpiredCanceledSubscription(subscription._id)) ??
      subscription;
  }
  if (subscription) {
    subscription = await refreshMonthlyCredits(subscription);
  }
  const displayName = account?.name?.trim() || providerName || "User";
  const [firstName = "User", ...lastNameParts] = displayName.split(/\s+/);
  const plan = subscription ? getEffectivePlan(subscription) : "free";
  const planCreditBalance = subscription?.creditBalance || 0;
  const pricingRegion = subscription?.pricingRegion || "global";
  const pricingCurrency = subscription?.pricingCurrency || "USD";
  const billingInterval = subscription?.billingInterval || "monthly";
  const userProfile: UserProfile = {
    id: account?.userId || rawUser?.id || "",
    databaseId: account?._id.toString() || "",
    email: account?.email || rawUser?.email || "",
    firstName,
    lastName: lastNameParts.join(" "),
    plan,
    subscriptionStatus: subscription?.status || "active",
    billingProvider: subscription?.billingProvider || "free",
    canManageBilling:
      (subscription?.billingProvider === "dodo" &&
        Boolean(subscription.billingProviderCustomerId)) ||
      (subscription?.billingProvider === "razorpay" &&
        Boolean(subscription.billingProviderSubscriptionId)),
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    pastDueEndsAt: subscription?.pastDueEndsAt?.toISOString() || null,
    creditBalance: planCreditBalance + (subscription?.prepaidCreditBalance || 0),
    monthlyCreditBalance: planCreditBalance,
    prepaidCreditBalance: subscription?.prepaidCreditBalance || 0,
    monthlyCreditAllowance: subscription?.monthlyCreditAllowance || 0,
    creditsUsedThisPeriod: subscription?.creditsUsedThisPeriod || 0,
    pricingRegion,
    pricingCurrency,
    billingInterval,
    dailyCreditsUsed:
      subscription?.dailyCreditDate === new Date().toISOString().slice(0, 10)
        ? subscription.dailyCreditsUsed
        : 0,
    dailyCreditCap: PLAN_ENTITLEMENTS[plan].dailyCreditCap,
    brandingRemovalActive:
      Boolean(subscription?.brandingRemovalActive) &&
      (!subscription?.brandingRemovalEndsAt || subscription.brandingRemovalEndsAt > new Date()),
    brandingRemovalEndsAt: subscription?.brandingRemovalEndsAt?.toISOString() || null,
    brandingRemovalCancelAtPeriodEnd: subscription?.brandingRemovalCancelAtPeriodEnd || false,
    currentPeriodStart:
      subscription?.currentPeriodStart?.toISOString() || "",
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() || "",
    createdAt: account?.createdAt?.toISOString() || "",
    updatedAt: account?.updatedAt?.toISOString() || "",
  };

  return (
    <StoreProvider>
      <DashboardClient userProfile={userProfile} />
    </StoreProvider>
  );
}
