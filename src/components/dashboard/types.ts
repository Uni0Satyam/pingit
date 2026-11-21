export interface UserProfile {
  id: string;
  databaseId: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "starter" | "pro" | "business";
  subscriptionStatus:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "paused";
  billingProvider: string;
  canManageBilling: boolean;
  cancelAtPeriodEnd: boolean;
  pastDueEndsAt: string | null;
  creditBalance: number;
  monthlyCreditBalance: number;
  prepaidCreditBalance: number;
  monthlyCreditAllowance: number;
  creditsUsedThisPeriod: number;
  pricingRegion: "global" | "europe" | "india";
  pricingCurrency: "USD" | "EUR" | "INR";
  billingInterval: "monthly" | "annual";
  dailyCreditsUsed: number;
  dailyCreditCap: number | null;
  brandingRemovalActive: boolean;
  brandingRemovalEndsAt: string | null;
  brandingRemovalCancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}
