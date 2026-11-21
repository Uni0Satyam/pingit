import { getSession } from "@/app/utils/getSession";
import connectDB from "@/lib/db";
import { ApiResponse } from "@/lib/apiResponse";
import {
  downgradeExpiredCanceledSubscription,
  ensureFreeSubscription,
  refreshMonthlyCredits,
} from "@/models/subscription.model";
import User from "@/models/user.model";
import { getEffectivePlan, PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import { connection, NextRequest } from "next/server";

export async function GET() {
  await connection();
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return ApiResponse.error("Authentication required", 401);
    }

    await connectDB();
    const user = await User.findOne({ userId }).select("_id name").lean();
    if (!user) {
      return ApiResponse.error("Account not found", 404);
    }

    let subscription = await ensureFreeSubscription(user._id);
    subscription =
      (await downgradeExpiredCanceledSubscription(subscription._id)) ??
      subscription;
    subscription = await refreshMonthlyCredits(subscription);

    const plan = getEffectivePlan(subscription);
    const planCreditBalance = subscription.creditBalance;
    return ApiResponse.success(
      {
        name: user.name,
        plan,
        subscriptionStatus: subscription.status,
        billingProvider: subscription.billingProvider,
        canManageBilling:
          (subscription.billingProvider === "dodo" &&
            Boolean(subscription.billingProviderCustomerId)) ||
          (subscription.billingProvider === "razorpay" &&
            Boolean(subscription.billingProviderSubscriptionId)),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        pastDueEndsAt: subscription.pastDueEndsAt?.toISOString() ?? null,
        creditBalance: planCreditBalance + (subscription.prepaidCreditBalance ?? 0),
        monthlyCreditBalance: planCreditBalance,
        prepaidCreditBalance: subscription.prepaidCreditBalance ?? 0,
        monthlyCreditAllowance: subscription.monthlyCreditAllowance,
        creditsUsedThisPeriod: subscription.creditsUsedThisPeriod,
        pricingRegion: subscription.pricingRegion,
        pricingCurrency: subscription.pricingCurrency,
        billingInterval: subscription.billingInterval,
        dailyCreditsUsed:
          subscription.dailyCreditDate === new Date().toISOString().slice(0, 10)
            ? subscription.dailyCreditsUsed
            : 0,
        dailyCreditCap: PLAN_ENTITLEMENTS[plan].dailyCreditCap,
        brandingRemovalActive:
          subscription.brandingRemovalActive &&
          (!subscription.brandingRemovalEndsAt || subscription.brandingRemovalEndsAt > new Date()),
        brandingRemovalEndsAt: subscription.brandingRemovalEndsAt?.toISOString() ?? null,
        brandingRemovalCancelAtPeriodEnd: subscription.brandingRemovalCancelAtPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      },
      200,
      "Account details fetched successfully",
    );
  } catch (error: unknown) {
    console.error("API Route Error [GET /api/account/profile]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to fetch account details",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return ApiResponse.error("Authentication required", 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return ApiResponse.error("Invalid JSON request body", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      typeof body.name !== "string"
    ) {
      return ApiResponse.error("A valid display name is required", 400);
    }

    const name = body.name.trim();
    if (!name || name.length > 100) {
      return ApiResponse.error(
        "Display name must be between 1 and 100 characters",
        400,
      );
    }

    await connectDB();
    const user = await User.findOneAndUpdate(
      { userId },
      { $set: { name } },
      { new: true, runValidators: true },
    ).select("name");

    if (!user) {
      return ApiResponse.error("Account not found", 404);
    }

    return ApiResponse.success(
      { name: user.name },
      200,
      "Profile updated successfully",
    );
  } catch (error: unknown) {
    console.error("API Route Error [PATCH /api/account/profile]:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponse.error(
      "Failed to update profile",
      500,
      process.env.NODE_ENV === "development" ? message : undefined,
    );
  }
}
