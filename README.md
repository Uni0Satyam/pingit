# 🤖 Pingit (Support-Ease)

> **AI-Powered Customer Support Widget & Management Dashboard**
> An end-to-end platform enabling businesses to train a personalized AI support assistant on their business knowledge and embed it seamlessly into any website with a single `<script>` tag.

---

## ⚠️ MANDATORY RULE FOR DEVELOPERS & AI AGENTS

> **CRITICAL DIRECTIVE**: Always consult this `README.md` before creating any new file, component, model, route, or utility.
>
> 1. **Check Existing Primitives**: Do not write new utilities, models, or UI components if one already exists in the registry below.
> 2. **Zero Redundancy Policy**: Never introduce duplicate functions, parallel data schemas, or redundant wrapper libraries.
> 3. **Clean Code**: Remove unused imports, dead files, and unreferenced schemas.
> 4. **Update This Document**: Whenever a new route, model, utility, or component is introduced or refactored, update this `README.md` immediately.

---

## 📋 Table of Contents
1. [Architecture & System Flow](#architecture--system-flow)
2. [Tech Stack](#tech-stack)
3. [Repository File Registry](#repository-file-registry)
4. [Shared Utilities & Helper Registry](#shared-utilities--helper-registry)
5. [Database Models & Schemas](#database-models--schemas)
6. [API Route Specifications](#api-route-specifications)
7. [UI Component Registry](#ui-component-registry)
8. [Embeddable Widget (`public/chatBot.js`)](#embeddable-widget-publicchatbotjs)
9. [Codebase Health & Identified Technical Debt](#codebase-health--identified-technical-debt)
10. [Product Feature Checklist](#product-feature-checklist)
11. [Future Implementation Guidelines](#future-implementation-guidelines)
12. [Environment Setup & Installation](#environment-setup--installation)

---

## 🏛️ Architecture & System Flow

```
[ Customer Website ]
        │
        ▼ (Loads public/chatBot.js with data-user-id and data-chatbot-id)
[ Embeddable Chat Widget ]
        │
        ▼ (POST /api/chat with messageHistory + userId)
[ Next.js API Layer ] ───► [ MongoDB (Chatbot Collection) ]
        │                     (Retrieves Business Knowledge)
        ▼
[ Google Gemini AI (gemini-3.5-flash) ]
        │ (Answers strictly using business context)
        ▼
[ Streamed / Structured JSON Response back to Widget ]
```

### Authentication Flow (Supabase Auth):
1. **Sign up or sign in**: Users choose email/password, Google, or GitHub at `/login`; Supabase handles credential validation and OAuth.
2. **Email confirmation and OAuth callback**: Supabase sends users to `/api/auth/callback`, which exchanges the PKCE code and sends them to `/dashboard`.
3. **Database sync**: `src/app/utils/getSession.ts` validates the Supabase user, creates the MongoDB `User` and Free subscription, or links an existing MongoDB account by verified email. It stores the Supabase UUID in `authUserId` while retaining the stable `userId`, so existing widget embeds and account data remain attached.
4. **Session cookies**: `@supabase/ssr` stores and refreshes the auth session in cookies through `src/proxy.ts`.
5. **Protected routes**: The proxy gates `/dashboard`; API handlers validate the user through the shared `getSession()` helper.

---

## 🛠️ Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | 16.4.6 | SSR, RSC, API routes, Turbopack |
| **Runtime / UI** | React / React DOM | 19.3.0 | Modern React component rendering |
| **Language** | TypeScript | 5.x | Strict type safety |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS engine with OKLCH theme variables |
| **Animations** | Motion (`motion/react`) | 14.6.0 | Fluid UI micro-interactions |
| **UI Primitives** | Base UI (`@base-ui/react`) / Shadcn | 1.9.0 / 4.22.1 | Accessible, headless UI component wrappers |
| **Icons** | Lucide React | 1.61.0 | Standardized UI iconography |
| **Database** | MongoDB & Mongoose | 9.11.4 | Document store & ODM with connection caching |
| **Authentication** | Supabase Auth | Free plan | Email/password, Google, and GitHub with cookie-based server sessions |
| **AI / LLM** | Google GenAI SDK | 2.31.0 | Gemini 3.5 Flash-Lite Standard and Gemini 3.8 Flash Smart replies |
| **State Management** | Redux Toolkit / React-Redux | 2.13.0 / 9.3.1 | Centralized async state management for dashboard & chatbots |
| **HTTP Client** | Axios | 1.20.0 | Client-side API requests in dashboard |

---

## 📁 Repository File Registry

Below is the complete file manifest of the repository. Consult this list before creating any new file.

### 1. Configuration & Root Files

| File Path | Description |
| :--- | :--- |
| `package.json` | Project scripts, dependencies, devDependencies. |
| `tsconfig.json` | TypeScript configuration with `@/*` mapping to `./src/*`. |
| `next.config.ts` | Next.js settings: partial prefetching, component caching, Turbopack CSS loaders. |
| `components.json` | Shadcn configuration (`base-nova` style, neutral base color, path aliases). |
| `eslint.config.mjs` | ESLint 9 flat configuration with Next.js presets. |
| `.env.local` | Local environment variables (Supabase URL/key, MongoDB URI, Gemini API key). |

### 2. Public Static Assets (`public/`)

| File Path | Description |
| :--- | :--- |
| `public/chatBot.js` | **Core embed script**. Injected into client websites; renders the chat widget, calls `/api/chat`, and routes exhausted-credit replies to the chatbot's support contact. |
| `public/icon.svg` | Application favicon / branding icon. |

### 3. Application Routes (`src/app/`)

| File Path | Type | Description |
| :--- | :--- | :--- |
| `src/app/layout.tsx` | Server Component | Root layout with metadata, Geist font, body styling, and `<Toaster />`. |
| `src/app/globals.css` | Stylesheet | Tailwind v4 import, OKLCH CSS theme variables for light and dark modes. |
| `src/app/page.tsx` | Server Component | Landing page route (`/`), passes `userProfile` from session to `HomeClient`. |
| `src/app/dashboard/page.tsx` | Server Component | Authenticated dashboard page (`/dashboard`), passes `userProfile` to `DashboardClient`. |
| `src/app/embed/page.tsx` | Server Component | Compatibility redirect from `/embed?chatbotId=...` to the dashboard's Embed & preview tab; configuration stays inside `/dashboard`. |
| `src/app/login/page.tsx` | Server Component | Redirects signed-in users to the dashboard and renders the email/password auth page. |
| `src/app/login/LoginForm.tsx` | Client Component | Supabase email/password, Google, and GitHub sign-in form with email-confirmation feedback. |

### 4. API Endpoints (`src/app/api/`)

| Endpoint Route | Methods | Purpose |
| :--- | :--- | :--- |
| `src/app/api/auth/login/route.ts` | `GET` | Redirects legacy login links to the `/login` page. |
| `src/app/api/auth/captcha/route.ts` | `POST` | Verifies Cloudflare Turnstile tokens on the server before email sign-up or OAuth redirects. |
| `src/app/api/auth/callback/route.ts` | `GET` | Exchanges the Supabase PKCE email-confirmation or OAuth code and redirects to the dashboard. |
| `src/app/api/auth/logout/route.ts` | `GET` | Signs out of Supabase Auth and redirects to the home page. |
| `src/app/api/account/profile/route.ts` | `GET`, `PATCH` | Returns fresh subscription/credit details or updates the authenticated user's display name; account ID and SSO email are not editable here. |
| `src/app/api/billing/route.ts` | `GET`, `POST` | Returns regional plan/provider availability and usage costs; creates Dodo or Razorpay subscriptions/top-ups, manages Razorpay plan changes/cancellations, and opens the Dodo customer portal. |
| `src/app/api/billing/webhook/route.ts` | `POST` | Verifies Dodo signatures, fulfills credit and branding add-ons, synchronizes plan periods, applies grace periods, and deduplicates events. |
| `src/app/api/billing/razorpay-webhook/route.ts` | `POST` | Verifies Razorpay HMAC signatures and applies paid top-ups, subscription lifecycle changes, branding add-ons, and seven-day payment grace. |
| `src/app/api/maintenance/pause-idle-bots/route.ts` | `GET` | CRON_SECRET-protected scheduled task that pauses active chatbots after 30 days without traffic; never deletes data. |
| `src/app/api/chat/route.ts` | `POST`, `OPTIONS` | External chatbot endpoint with CORS headers, Free rate limits/domain checks, Standard/Smart Gemini selection, fixed credit charges, usage records, and conversation persistence. |
| `src/app/api/chatbot/route.ts` | `GET`, `POST`, `PUT`, `DELETE` | Session-authenticated chatbot management; enforces chatbot, allowed-domain, knowledge-size, and mode limits for the effective plan. |
| `src/app/api/chatbot/[id]/route.ts` | `GET`, `PUT`, `PATCH`, `DELETE` | Session-authenticated, owner-scoped chatbot operations by MongoDB `_id`; validates allowed domains, knowledge size, and chat mode against the plan. |
| `src/app/api/conversations/route.ts` | `GET` | Lists the authenticated user's latest conversations. |
| `src/app/api/conversations/[id]/route.ts` | `GET` | Fetches an owned conversation and its ordered message history. |
| `src/app/api/usage-record/route.ts` | `GET` | Returns aggregate usage, latest reply records, and a 14-day usage trend; accepts optional `limit` (1–100, default 20). |

### 5. Client Components (`src/components/`)

| File Path | Purpose |
| :--- | :--- |
| `src/components/HomeClient.tsx` | Developer-focused landing page with chat preview, setup steps, regional Free/Starter/Pro/Business pricing, annual discounts, FAQ, and footer. |
| `src/components/DashboardClient.tsx` | Dashboard shell, navigation, current-plan badge, and chatbot create/delete dialogs; billing, settings, and workspace views are separate tabs. |
| `src/components/EmbedClient.tsx` | Dashboard tab content: chatbot configuration editor with live preview, saved chatbot settings, and framework-specific embed snippets including the public support email used when credits run out. |
| `src/components/dashboard/ChatbotsTab.tsx` | Chatbot search, status filters, loading/error states, chatbot cards, and embed/delete actions. |
| `src/components/dashboard/ConversationsTab.tsx` | Searchable visitor conversation list and ordered message transcript viewer. |
| `src/components/dashboard/AnalyticsTab.tsx` | Analytics dashboard with 14-day usage summaries, selectable credits/requests/tokens trend chart, chatbot counts, and recent request activity. |
| `src/components/dashboard/BillingTab.tsx` | Regional plan comparison, transparent Standard/Smart charges, monthly credit meter and alerts, top-ups, Starter brand removal, payment management, and recent estimated usage costs. |
| `src/components/dashboard/SettingsTab.tsx` | Account profile, monthly included credit overview, prepaid credit balance, and display-name editing. |
| `src/components/dashboard/types.ts` | Shared dashboard user profile type. |
| `src/components/layout/Header.tsx` | Shared navigation bar with Pricing link, Auth login/logout, billing/dashboard links, avatar dropdown, and logout confirmation dialog. |

### 6. Redux State Management (`src/store/`)

| File Path | Purpose |
| :--- | :--- |
| `src/store/store.ts` | Configures Redux Toolkit store (`makeStore`, `RootState`, `AppDispatch`). |
| `src/store/hooks.ts` | Typed React-Redux hooks (`useAppDispatch`, `useAppSelector`). |
| `src/store/StoreProvider.tsx` | Client-side Redux Provider wrapper for Next.js App Router. |
| `src/store/slices/chatbotsSlice.ts` | Chatbot data and API state slice (async thunks: `fetchChatbots`, `createChatbot`, `updateChatbot`, `deleteChatbot`). |
| `src/store/slices/dashboardSlice.ts` | Dashboard UI state: active tab, chatbot filters/search/selection, and dashboard modal visibility. |

### 7. Backend Libraries & Models (`src/lib/` & `src/models/`)

| File Path | Purpose |
| :--- | :--- |
| `src/lib/db.ts` | MongoDB connection cache (`connectDB()`) to prevent multiple connections in serverless environments. |
| `src/lib/supabase/client.ts` | Creates the shared Supabase browser client for sign-in and sign-up. |
| `src/lib/supabase/server.ts` | Creates the cookie-backed Supabase server client for server components and route handlers. |
| `src/lib/dodoPayments.ts` | Dodo Payments client and configured product-ID mapping for regional plans, top-ups, branding add-ons, and delayed legacy purchases. |
| `src/lib/razorpayPayments.ts` | Razorpay Subscriptions and Payment Links API calls, configured plan IDs, and subscription change/cancel operations. |
| `src/lib/usageCost.ts` | Calculates per-reply Gemini model cost from reported token usage and published model rates, with an optional infrastructure estimate. |
| `src/lib/planEntitlements.ts` | Shared regional Free/Starter/Pro/Business price book, entitlements, credit allowances, annual discount, effective-plan resolution, and domain validation. |
| `src/lib/apiResponse.ts` | Standardized JSON response helper (`ApiResponse.success`, `ApiResponse.error`). |
| `src/lib/utils.ts` | Classname concatenation helper re-exporting `cn`. |
| `src/app/utils/getSession.ts` | Validates the Supabase user and synchronizes the MongoDB account and Free subscription. |
| `src/models/user.model.ts` | Mongoose model for `User` collection. |
| `src/models/chatbot.model.ts` | Mongoose model for `Chatbot` settings, allowed domains, Standard/Smart mode, active/paused status, and last visitor traffic time. |
| `src/models/subscription.model.ts` | Free/paid subscription, monthly included and non-expiring prepaid credits, region/currency/interval, provider lifecycle, grace period, brand add-on, and atomic credit operations. |
| `src/models/billingWebhookEvent.model.ts` | Processed Dodo and Razorpay webhook event IDs for idempotent delivery handling. |
| `src/models/rateLimit.model.ts` | MongoDB fixed-window IP/session counters for Free widget traffic, with a TTL index. |
| `src/models/usageRecord.model.ts` | Per-reply Standard/Smart usage, fixed credits charged, provider/model/token counts, and estimated model cost. |
| `src/models/conversation.model.ts` | Visitor conversation sessions associated with a user and chatbot. |
| `src/models/message.model.ts` | Visitor, assistant, and system messages associated with a conversation. |
| `src/models/knowledgeSource.model.ts` | Chatbot knowledge source metadata for URLs, documents, and text with processing/indexing status. |
| `src/proxy.ts` | Next.js 16 proxy that refreshes Supabase cookies and redirects unauthenticated dashboard requests to `/login`. |
| `src/types.d.ts` | Global TypeScript definitions (Mongoose connection cache declaration). |

---

## 🧰 Shared Utilities & Helper Registry

Before creating a utility function, check this table. **Reuse existing helpers; do not duplicate.**

### 1. `connectDB()` (`src/lib/db.ts`)
- **Signature**: `async function connectDB(): Promise<Connection>`
- **Description**: Connects to MongoDB using `process.env.MONGODB_URI` and caches the connection on `global.mongoose`. Prevents connection leak in serverless runtimes.
- **Usage**:
  ```ts
  import connectDB from "@/lib/db";
  await connectDB();
  ```

### 2. `ApiResponse` (`src/lib/apiResponse.ts`)
- **Signature**:
  - `ApiResponse.success<T>(data: T, status = 200, message = "Success"): NextResponse`
  - `ApiResponse.error(message: string, status = 500, errorDetails: any = null): NextResponse`
- **Description**: Standardizes all JSON responses returned by API routes.
- **Usage**:
  ```ts
  import { ApiResponse } from "@/lib/apiResponse";
  return ApiResponse.success({ item }, 200, "Item fetched successfully");
  return ApiResponse.error("Resource not found", 404);
  ```

### 3. `getSession()` (`src/app/utils/getSession.ts`)
- **Signature**: `async function getSession(): Promise<AuthSession | null>`
- **Description**: Validates the cookie-backed Supabase Auth user, requires a confirmed email, and synchronizes the MongoDB account. Existing accounts are linked by verified email, preserving their MongoDB IDs and related data. Returns `null` if unauthenticated or unconfirmed.
- **Usage**:
  ```ts
  import { getSession } from "@/app/utils/getSession";
  const session = await getSession();
  const userProfile = session?.user?.userProfile;
  ```

### 4. Supabase SSR clients (`src/lib/supabase/`)
- **Description**: Shared browser and server clients from `@supabase/ssr`; browser auth uses the publishable key, while server clients read and refresh cookie-backed sessions.

### 5. `cn(...inputs)` (`src/lib/utils.ts`)
- **Description**: Merges class names cleanly.
- **Usage**:
  ```ts
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", isActive && "active-class", className)} />
  ```

### 6. Dodo Payments (`src/lib/dodoPayments.ts`)
- **Description**: Configures Dodo as the global/EU merchant of record, maps regional subscription/top-up/branding product IDs, and preserves product mapping for in-flight legacy purchases.

### 7. Razorpay Subscriptions (`src/lib/razorpayPayments.ts`)
- **Description**: Creates India subscription and top-up links, then changes or cancels subscriptions through the Razorpay API. Plan IDs and API credentials are configured in environment variables.

---

## 🗄️ Database Models & Schemas

### 1. `User` Model (`src/models/user.model.ts`)
Tracks registered users synced from Supabase Auth. `authUserId` stores the Supabase Auth UUID; `userId` remains the stable account ID used by widget embeds and ownership checks. A verified email links existing accounts without changing either their MongoDB `_id` or `userId`.
```typescript
interface IUser {
  userId: string;              // Stable account ID used by widget embeds, unique index
  authUserId?: string;         // Supabase Auth UUID, unique sparse index
  name?: string;              // User-editable display name (seeded from Supabase signup metadata)
  email: string;              // Lowercase, trimmed email
  createdAt: Date;
  updatedAt: Date;
}
```
Virtual inverse relationships (populatable without storing duplicate ID arrays): `chatbots`, `subscriptions`, `usageRecords`, `conversations`, and `knowledgeSources`.

### 2. `Chatbot` Model (`src/models/chatbot.model.ts`)
Stores multi-tenant chatbot assistant configurations linked to a `User`.
```typescript
interface IChatbotSettings {
  welcomeMessage: string;      // Opening greeting in widget (default: "Hi! How can I help you?")
  primaryColor: string;        // Hex color theme (default: "#2563eb")
  systemPrompt: string;        // Custom system instructions for the LLM
  chatMode: "standard" | "smart"; // Smart is available to Pro and Business
}

interface IChatbot {
  userId: Types.ObjectId;      // Reference to User document (_id)
  name: string;                // Internal chatbot name (max: 100)
  businessName: string;        // Business brand name
  businessEmail: string;       // Support email address
  knowledgeBase: string;       // Raw text knowledge base (policies, FAQs)
  status: "draft" | "active" | "disabled" | "paused"; // Paused after 30 days without traffic; data remains stored
  settings: IChatbotSettings;  // Chatbot appearance and prompt configuration
  lastTrafficAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
Virtual inverse relationships: `usageRecords`, `conversations`, and `knowledgeSources`.

### 3. `Subscription` Model (`src/models/subscription.model.ts`)
Stores a user's subscription and billing-provider lifecycle data.
```typescript
interface ISubscription {
  userId: Types.ObjectId;
  plan: "free" | "starter" | "pro" | "business"; // Legacy Premium names map during migration
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "paused";
  billingProvider: string;
  billingProviderCustomerId?: string;
  billingProviderSubscriptionId?: string;
  billingProviderProductId?: string;
  billingProviderUpdatedAt?: Date;
  pastDueEndsAt?: Date;
  pricingRegion: "global" | "europe" | "india";
  pricingCurrency: "USD" | "EUR" | "INR";
  billingInterval: "monthly" | "annual";
  monthlyCreditAllowance: number; // Region-specific allowance from the plan catalog
  creditBalance: number;         // Remaining monthly included credits
  lifetimeCreditBalance: number; // Legacy field, migrated to monthly credits
  prepaidCreditBalance: number;  // Purchased credits; do not expire
  creditsUsedThisPeriod: number;
  dailyCreditsUsed: number;
  dailyCreditDate?: string;
  creditPeriodStart: Date;
  creditPeriodEnd: Date;
  brandingRemovalActive: boolean;
  brandingRemovalEndsAt?: Date;
  pendingPlan?: "starter" | "pro" | "business";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
The plan catalog is authoritative: Free has 200 monthly credits and a 20-credit daily cap; Starter, Pro, and Business receive region-specific monthly amounts. Standard replies charge 1 credit and Smart replies charge 4; token usage is recorded for transparent cost reporting, not used to calculate customer credits. The chat handler reserves credits before Gemini, logs successful replies, and refunds failed generations. Included monthly credits expire at the monthly reset; prepaid top-ups never expire and are consumed after included credits. `refreshMonthlyCredits` advances monthly credit windows, including during annual subscriptions. Dodo serves Global/EU subscriptions and Razorpay serves India subscriptions; signed provider webhooks update status and grants.

### 4. `UsageRecord` Model (`src/models/usageRecord.model.ts`)
Records metered usage for a chatbot, with optional AI provider and cost metadata.
```typescript
interface IUsageRecord {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  units: number;
  unitType: "request" | "token";
  creditsCharged: number;
  occurredAt: Date;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costAmount?: number;
  costCurrency?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. `Conversation` Model (`src/models/conversation.model.ts`)
Stores a visitor session and summary metadata; messages are stored separately.
```typescript
interface IConversation {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  visitorId: string;
  visitorEmail?: string;
  status: "open" | "closed";
  startedAt: Date;
  lastMessageAt: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}
```
Virtual inverse relationship: `messages`, populated in message timestamp order when requested.

### 6. `Message` Model (`src/models/message.model.ts`)
Stores ordered visitor, assistant, or system messages for a conversation.
```typescript
interface IMessage {
  conversationId: Types.ObjectId;
  role: "visitor" | "assistant" | "system";
  content: string;
  sentAt: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 7. `KnowledgeSource` Model (`src/models/knowledgeSource.model.ts`)
Tracks chatbot knowledge inputs and their processing/indexing lifecycle.
```typescript
interface IKnowledgeSource {
  userId: Types.ObjectId;
  chatbotId: Types.ObjectId;
  type: "website_url" | "document" | "text";
  name: string;
  url?: string;
  fileName?: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentHash?: string;
  textContent?: string;
  processingStatus: "pending" | "processing" | "ready" | "failed";
  indexedAt?: Date;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 8. `BillingWebhookEvent` Model (`src/models/billingWebhookEvent.model.ts`)
Stores successfully processed Dodo and Razorpay webhook IDs to ignore provider retries. Events expire after 90 days.

### 9. `ChatRateLimit` Model (`src/models/rateLimit.model.ts`)
Stores hashed Free-tier IP and visitor-session keys in one-minute windows, with TTL cleanup. Defaults are 30 requests per IP and 12 per visitor session per minute; configure `CHAT_RATE_LIMIT_IP_PER_MINUTE` and `CHAT_RATE_LIMIT_SESSION_PER_MINUTE` to adjust them.

These are persistence schemas. Subscription records are initialized for authenticated users; chat requests consume monthly included credits before using prepaid top-ups, and successful widget chats are saved as Conversation/Message records. Regional checkout/webhooks are implemented for Dodo and Razorpay; KnowledgeSource ingestion/indexing still needs implementation.

Relationship fields on child documents use Mongoose `ref`s (`Chatbot.userId`, `Subscription.userId`, `UsageRecord.userId/chatbotId`, `Conversation.userId/chatbotId`, `Message.conversationId`, and `KnowledgeSource.userId/chatbotId`). The inverse virtuals listed above support population without maintaining redundant arrays on parent documents.

---

## 🌐 API Route Specifications

| Route | Method | Payload / Params | Response | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `GET` | None | `302 Redirect` | Redirects older login links to `/login`. |
| `/api/auth/callback` | `GET` | `?code=...` | `302 Redirect` to `/dashboard` or `/login` | Exchanges the Supabase PKCE email-confirmation or OAuth code; the shared session helper syncs the MongoDB account. |
| `/api/auth/logout` | `GET` | None | `302 Redirect` to `/` | Signs out of Supabase Auth and clears its session cookies. |
| `/api/account/profile` | `GET` | None | `ApiResponse.success({ name, plan, subscriptionStatus, region, currency, interval, monthlyCreditAllowance, creditBalance, prepaidCreditBalance, dailyCreditsUsed, dailyCreditCap, brandingRemovalActive })` | Authenticates from the Supabase Auth session and returns current subscription, monthly/daily quota, and branding status. |
| `/api/account/profile` | `PATCH` | `{ name: string }` | `ApiResponse.success({ name })` | Authenticates from the Supabase Auth session and updates only the user's display name; user ID and email remain unchanged. |
| `/api/billing` | `GET` | Optional `?region=global\|europe\|india&interval=monthly\|annual` | `ApiResponse.success({ region, currency, provider, planAvailability, creditTopUp, recentCreditUsage, unitEconomics })` | Returns regional checkout availability, top-up pricing, the latest 10 reply records, and token-based model-cost estimates. |
| `/api/billing` | `POST` | `{ action: "checkout"\|"change", plan, region, interval }`, `{ action: "credits", credits, region }`, `{ action: "branding"\|"branding-cancel"\|"cancel"\|"portal" }` | `ApiResponse.success({ url? })` | Creates regional hosted checkout or manages supported provider subscription changes and cancellation. Credit top-ups must be multiples of 1,000. |
| `/api/billing/webhook` | `POST` | Dodo-signed webhook event | `ApiResponse.success({ received })` | Verifies Dodo signatures, fulfills top-ups/branding add-ons idempotently, synchronizes plan status and monthly grants, and applies the seven-day past-due grace. |
| `/api/billing/razorpay-webhook` | `POST` | Razorpay-signed webhook event | `ApiResponse.success({ received })` | Verifies `X-Razorpay-Signature` over the raw request body and synchronizes India payments, subscriptions, and add-ons idempotently. |
| `/api/maintenance/pause-idle-bots` | `GET` | `Authorization: Bearer $CRON_SECRET` | `ApiResponse.success({ paused })` | Pauses active bots with no recorded traffic in the previous 30 days. Requires a daily external scheduler. |
| `/api/chat` | `POST` | `{ userId: string, chatbotId: string, visitorId?: string, messageHistory: Array<{ role, parts: [{ text }] }> }` | `ApiResponse.success({ reply, usage, brandingRemovalActive })` | Checks origin/domain, Free IP/session limits, monthly/daily credits, and plan mode; charges 1 Standard or 4 Smart credits; records model/token cost and saves successful conversation messages. |
| `/api/chat` | `OPTIONS` | None | `204 No Content` | CORS preflight handler. |
| `/api/conversations` | `GET` | Optional `?limit=50` (1–100, default 50) | `ApiResponse.success({ conversations, limit })` | Uses the authenticated session to return the user's latest conversations. |
| `/api/conversations/[id]` | `GET` | Conversation MongoDB ID | `ApiResponse.success({ conversation, messages, hasMoreMessages })` | Verifies ownership and returns up to 500 messages ordered by send time. |
| `/api/usage-record` | `GET` | Optional `?limit=20` (1–100) | `ApiResponse.success({ summary, records, dailyTrend, limit })` | Uses the authenticated Supabase session to scope reply usage records to the current account. |
| `/api/chatbot` | `POST` | `{ name, businessName, businessEmail, knowledgeBase?, status?, settings? }` | `ApiResponse.success(chatbot, 201)` | Creates a chatbot for the authenticated user; enforces plan bot, knowledge-size, and mode limits atomically. Caller-supplied user IDs are ignored. |
| `/api/chatbot` | `GET` | Optional `?id=...` | `ApiResponse.success(chatbots)` | Lists the authenticated user's chatbots or fetches one owned chatbot. |
| `/api/chatbot` | `PUT` | `{ id, name?, businessName?, businessEmail?, knowledgeBase?, allowedDomains?, status?, settings? }` | `ApiResponse.success(updatedChatbot)` | Updates an authenticated user's owned chatbot; validates knowledge size, allowed domains, and mode against the effective plan. |
| `/api/chatbot` | `DELETE` | `?id=...` or `{ id }` in body | `ApiResponse.success({ id })` | Deletes an authenticated user's owned chatbot. |
| `/api/chatbot/[id]` | `GET`, `PUT`, `PATCH`, `DELETE` | Chatbot MongoDB ID; update body may include `allowedDomains` | `ApiResponse.success(chatbot)` | Authenticated, owner-scoped operations; update validates plan-specific domain limits. |
| `/api/chatbot/[id]` | `GET` | URL param `id` | `ApiResponse.success(chatbot)` | Fetches single chatbot by its MongoDB `_id`. |
| `/api/chatbot/[id]` | `PUT` / `PATCH` | URL param `id`, fields in body | `ApiResponse.success(updatedChatbot)` | Updates single chatbot by its MongoDB `_id`. Enforces ownership. |
| `/api/chatbot/[id]` | `DELETE` | URL param `id` | `ApiResponse.success({ id })` | Deletes single chatbot by its MongoDB `_id`. Enforces ownership. |

---

## 🎨 UI Component Registry

The project uses pre-built, accessible primitives located in `src/components/ui/`. **Do not re-implement custom variants of these components.**

| Component Name | File Path | Exports |
| :--- | :--- | :--- |
| **Accordion** | `src/components/ui/accordion.tsx` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| **Alert Dialog** | `src/components/ui/alert-dialog.tsx` | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogMedia` |
| **Avatar** | `src/components/ui/avatar.tsx` | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup` |
| **Bubble** | `src/components/ui/bubble.tsx` | `Bubble`, `BubbleContent`, `BubbleReactions`, `BubbleReaction` |
| **Button** | `src/components/ui/button.tsx` | `Button`, `buttonVariants` (variants: default, outline, secondary, ghost, destructive, link) |
| **Card** | `src/components/ui/card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` |
| **Checkbox** | `src/components/ui/checkbox.tsx` | `Checkbox` |
| **Dropdown Menu** | `src/components/ui/dropdown-menu.tsx` | `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` |
| **Field** | `src/components/ui/field.tsx` | `Field`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSeparator` |
| **Hover Card** | `src/components/ui/hover-card.tsx` | `HoverCard`, `HoverCardTrigger`, `HoverCardContent` |
| **Input** | `src/components/ui/input.tsx` | `Input` |
| **Label** | `src/components/ui/label.tsx` | `Label` |
| **Select** | `src/components/ui/select.tsx` | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` |
| **Separator** | `src/components/ui/separator.tsx` | `Separator` |
| **Steps** | `src/components/ui/steps.tsx` | `Steps`, `Step` |
| **Textarea** | `src/components/ui/textarea.tsx` | `Textarea` |
| **Toast** | `src/components/ui/toast.tsx` | `Toaster`, `toast` (`toast.add({ type: 'success'|'error', title, description })`) |

---

## 📦 Embeddable Widget (`public/chatBot.js`)

The standalone chatbot script is served statically at `/chatBot.js`.

### How It Works:
1. Business users paste this snippet on their site:
   ```html
   <script src="https://<YOUR_APP_URL>/chatBot.js" data-user-id="<USER_ID>" data-chatbot-id="<CHATBOT_ID>"></script>
   ```
2. The script:
   - Reads `data-user-id` and `data-chatbot-id` from its own `<script>` tag.
   - Reads the public `data-business-email` support contact emitted in the dashboard embed snippet.
   - Uses the chatbot-specific business knowledge and instructions.
   - Injects a floating bubble toggle button (`#pingit-chat-toggle`, fixed bottom-right, `z-index: 2147483647`).
   - Injects a chatbox container (`#pingit-chat-box`) with responsive styling for desktop and mobile viewport constraints.
   - Maintains conversation history (`messageHistory: [{ role, parts: [{ text }] }]`).
   - Reuses a per-chatbot visitor ID for the browser tab so successful chats are grouped into a conversation.
   - Dispatches user queries via `fetch` to `${widgetUrl}/api/chat`.
   - Renders bot responses formatted according to business knowledge instructions.
   - Shows a support-contact fallback when the chat API returns HTTP 402 after the account runs out of credits.

---

## 🧹 Codebase Health & Identified Technical Debt

During repository analysis, the following discrepancies were identified. **Keep these in mind to avoid repeating or compounding them:**

1. **Inconsistent Response Formatting**:
   - `/api/chat` manually constructs `NextResponse.json` payloads. All future JSON endpoints must standardize on `ApiResponse`.
2. **Linting & Type Safety Warnings**:
   - Several files use `any` type annotations (`getSession.ts`, `callback/route.ts`, `DashboardClient.tsx`, `Header.tsx`, `apiResponse.ts`).
   - Direct `window.location.href` navigation in client components instead of Next.js router (where applicable).

---

## ✅ Product Feature Checklist

### Regional price book

| Plan | Global / Europe monthly | Included credits | India monthly | Included credits |
| :--- | ---: | ---: | ---: | ---: |
| Free | $0 / €0 | 200 | ₹0 | 200 |
| Starter | $25 / €25 | 2,000 | ₹999 | 1,000 |
| Pro | $79 / €79 | 10,000 | ₹3,499 | 6,000 |
| Business | $199 / €199 | 40,000 | ₹8,999 | 20,000 |

Annual subscriptions receive 20% off and still replenish included credits monthly. Euro plan prices exclude VAT. Top-ups are 1,000 credits for $5 / €5 / ₹399. Starter branding removal is $10 / €10 / ₹499 monthly; Pro and Business include removal.

### Metering and model costs

- [x] Standard uses paid Gemini 3.5 Flash-Lite and costs 1 credit per reply.
- [x] Smart uses paid Gemini 3.8 Flash with low thinking and costs 4 credits per reply; it is available to Pro and Business.
- [x] Successful replies record model, tokens, credits, and estimated model cost. Failed generations refund the fixed reservation.
- [x] Billing explains monthly included credits, daily Free caps, non-expiring top-ups, and the per-reply credit rule.
- [x] In-app and optional email warnings are triggered at 80% and 100% of included monthly credits.
- [ ] Validate real Gemini token averages, payment fees, hosting costs, and margins after launch.

### Free plan guardrails

- [x] 200 monthly credits with a 20-credit daily cap; Standard mode only.
- [x] One chatbot, one registered domain, a 2 MB text knowledge base, and a persistent Pingit badge.
- [x] Verified-email sign-up with a Turnstile challenge when configured; IP and visitor-session rate limits.
- [x] Active bots with no visitor traffic for 30 days are paused by the protected maintenance route; their data is retained.

### Billing and rollout

- [x] Dodo Payments checkout and signed webhooks for Global and Europe; Razorpay Subscriptions and signed webhooks for India.
- [x] Monthly and annual checkout, top-ups, Starter branding add-on, cancellation at renewal, immediate Razorpay upgrades, and renewal-scheduled Razorpay downgrades.
- [x] Seven-day paid-feature grace after a provider reports failed recurring payment; expired or canceled plans return to Free.
- [ ] Open and approve provider accounts, create all plan/add-on products, set production secrets, and test small real payments and lifecycle events.
- [ ] Review cost and conversion after the document's two-week and 90-day checkpoints.

The source pricing brief gives model-cost assumptions of about $0.0015 per Standard reply and $0.0064 per Smart reply for 3,000 input and 250 output tokens. These are estimates from paid Gemini token rates, exclude hosting/payment fees/taxes/storage, and vary with actual context and output size. The exact credit charge is fixed per mode even when provider token counts vary.

The authenticated plan is the source of truth, while prepaid credits remain available across plan changes. The existing dashboard, conversations, analytics, auth, and chatbot workflows remain part of the app. Lead capture, integrations, and human handoff are marked as Pro+ entitlements in the catalog; their product modules still need implementation.

India uses Razorpay; Global/Europe use Dodo Payments as the configured merchant-of-record provider. Provider onboarding, plan product creation, secret configuration, tax advice, and live payment testing are external rollout work and cannot be completed from repository changes alone. Configure the protected idle-bot route in a daily scheduler using `Authorization: Bearer $CRON_SECRET`.

---

## 📐 Future Implementation Guidelines

When writing new features or fixing bugs:

1. **Consult This README First**:
   - Review the [Shared Utilities Registry](#shared-utilities--helper-registry) and [UI Component Registry](#ui-component-registry).
   - If a function or component exists, use it. Do not write a second one.
2. **Strictly Enforce Zero Redundancy**:
   - Do not create helper functions that duplicate `connectDB`, `getSession`, `ApiResponse`, or `cn`.
   - Do not install redundant npm packages (e.g., additional styling, icon, or toast libraries).
3. **Consistent Response Schema**:
   - Always return `ApiResponse.success(data, status, message)` or `ApiResponse.error(message, status, details)`.
4. **Database Cleanliness**:
   - Do not create duplicate schemas for existing domain entities.
   - Always ensure models check `mongoose.models[ModelName] || model(ModelName, schema)` for serverless HMR safety.
5. **No Unused Code**:
   - Remove unused imports, dead variables, and test scrap files.
   - Keep TypeScript strict without unnecessary `any` overrides.
6. **Keep This Document Updated**:
   - Any new route, model, utility, or UI component must be added to this `README.md` in the exact same format.

---

## 🚀 Environment Setup & Installation

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- MongoDB instance (Atlas or local)
- Supabase project for Auth (free plan includes 50,000 monthly active users)
- Google Gemini API key

### 2. Environment Variables (`.env.local`)
Create a `.env.local` file with the following keys:
```env
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>

# App Base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>

# Google Gemini AI
GEMINI_API_KEY=<your-gemini-api-key>

# Merchant of record (Global / Europe)
DODO_PAYMENTS_API_KEY=<your-dodo-api-key>
DODO_PAYMENTS_WEBHOOK_KEY=<your-dodo-webhook-signing-secret>
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_STARTER_USD_MONTHLY_PRODUCT_ID=<starter-monthly-usd-product-id>
DODO_STARTER_USD_ANNUAL_PRODUCT_ID=<starter-annual-usd-product-id>
DODO_STARTER_EUR_MONTHLY_PRODUCT_ID=<starter-monthly-eur-product-id>
DODO_STARTER_EUR_ANNUAL_PRODUCT_ID=<starter-annual-eur-product-id>
DODO_PRO_USD_MONTHLY_PRODUCT_ID=<pro-monthly-usd-product-id>
DODO_PRO_USD_ANNUAL_PRODUCT_ID=<pro-annual-usd-product-id>
DODO_PRO_EUR_MONTHLY_PRODUCT_ID=<pro-monthly-eur-product-id>
DODO_PRO_EUR_ANNUAL_PRODUCT_ID=<pro-annual-eur-product-id>
DODO_BUSINESS_USD_MONTHLY_PRODUCT_ID=<business-monthly-usd-product-id>
DODO_BUSINESS_USD_ANNUAL_PRODUCT_ID=<business-annual-usd-product-id>
DODO_BUSINESS_EUR_MONTHLY_PRODUCT_ID=<business-monthly-eur-product-id>
DODO_BUSINESS_EUR_ANNUAL_PRODUCT_ID=<business-annual-eur-product-id>
DODO_CREDIT_TOPUP_USD_PRODUCT_ID=<one-time-1000-credit-usd-product-id>
DODO_CREDIT_TOPUP_EUR_PRODUCT_ID=<one-time-1000-credit-eur-product-id>
DODO_STARTER_BRANDING_USD_MONTHLY_PRODUCT_ID=<starter-branding-usd-monthly-product-id>
DODO_STARTER_BRANDING_EUR_MONTHLY_PRODUCT_ID=<starter-branding-eur-monthly-product-id>

# India subscriptions and top-ups
RAZORPAY_KEY_ID=<your-razorpay-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
RAZORPAY_WEBHOOK_SECRET=<your-razorpay-webhook-secret>
RAZORPAY_STARTER_MONTHLY_PLAN_ID=<starter-monthly-inr-plan-id>
RAZORPAY_STARTER_ANNUAL_PLAN_ID=<starter-annual-inr-plan-id>
RAZORPAY_PRO_MONTHLY_PLAN_ID=<pro-monthly-inr-plan-id>
RAZORPAY_PRO_ANNUAL_PLAN_ID=<pro-annual-inr-plan-id>
RAZORPAY_BUSINESS_MONTHLY_PLAN_ID=<business-monthly-inr-plan-id>
RAZORPAY_BUSINESS_ANNUAL_PLAN_ID=<business-annual-inr-plan-id>
RAZORPAY_STARTER_BRANDING_MONTHLY_PLAN_ID=<starter-branding-inr-monthly-plan-id>

# Legacy Dodo IDs for delayed payments or existing subscriptions
DODO_CREDIT_RECHARGE_PRODUCT_ID=<legacy-usd-top-up-product-id>
DODO_CREDIT_PACK_1000_PRODUCT_ID=<legacy-credit-pack-product-id>
DODO_CREDIT_PACK_5000_PRODUCT_ID=<legacy-credit-pack-product-id>
DODO_PREMIUM_PRODUCT_ID=<legacy-premium-product-id>
DODO_PREMIUM_PLUS_PRODUCT_ID=<legacy-premium-plus-product-id>

# Signup challenge and usage email alerts
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<cloudflare-turnstile-site-key>
TURNSTILE_SECRET_KEY=<cloudflare-turnstile-secret-key>
RESEND_API_KEY=<optional-resend-api-key>
BILLING_ALERT_FROM=<verified-sender-address>

# Scheduled maintenance and Free traffic limits
CRON_SECRET=<long-random-secret>
CHAT_RATE_LIMIT_IP_PER_MINUTE=30
CHAT_RATE_LIMIT_SESSION_PER_MINUTE=12

# Optional unit economics
INFRASTRUCTURE_USD_PER_REQUEST=<measured-or-explicitly-estimated-cost>
USD_INR_EXCHANGE_RATE=<current-usd-to-inr-rate>

# Environment
NODE_ENV=development
```

Create monthly and annual Dodo products for every Global/EU plan, a recurring Starter branding add-on, and one-time top-up products priced at $5/€5 per 1,000 credits. Create the matching Razorpay plans in INR, including the annual intervals, Starter branding add-on, and API/webhook credentials. Configure all product/plan IDs above before enabling checkout; a provider API key alone does not create the catalog. Keep legacy Dodo product IDs while delayed payments or existing subscriptions still use them.

The app estimates reply model costs from provider-reported input/output tokens and the model's configured Gemini rates. `INFRASTRUCTURE_USD_PER_REQUEST` adds an optional estimate; without it, the displayed figure is model-only. These costs exclude payment fees, taxes, hosting, storage, and support. `USD_INR_EXCHANGE_RATE` is optional and only controls the converted internal cost display; it does not change customer prices.

Add `POST https://<YOUR_APP_URL>/api/billing/webhook` as a Dodo webhook endpoint for `payment.succeeded` and subscription lifecycle events. Add `POST https://<YOUR_APP_URL>/api/billing/razorpay-webhook` in Razorpay and subscribe to `payment_link.paid` and subscription lifecycle events. Use provider test credentials and products first; live payments require approved accounts and live product IDs. Configure a daily scheduler to call `/api/maintenance/pause-idle-bots` with the `CRON_SECRET` bearer token.

To send 80% and 100% usage emails, configure Resend and a verified `BILLING_ALERT_FROM`. The in-app usage banner works without an email provider.

In Supabase Auth URL settings, keep email confirmation enabled, set the site URL to `NEXT_PUBLIC_APP_URL`, and allow `http://localhost:3000/api/auth/callback` plus the production `/api/auth/callback` URL as redirect URLs. To enable Google and GitHub, create an OAuth app for each provider and add their client IDs and secrets in Supabase Auth > Providers. Use the Supabase project callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as the authorized callback URL in both provider consoles. The hosted free email sender is rate-limited; configure SMTP if production signup volume needs more capacity.

### 3. Install & Run
```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```
