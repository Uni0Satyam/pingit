"use client";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Step, Steps } from "@/components/ui/steps";
import { useRouter } from "next/navigation";
import { Header } from "./layout/Header";
import {
  CREDIT_TOP_UP,
  PLAN_CATALOG,
  STARTER_BRANDING_ADDON,
  getPlanPrice,
  type BillingInterval,
  type EffectiveSubscriptionPlan,
  type PricingRegion,
} from "@/lib/planEntitlements";

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
};

const features = [
  {
    title: "Build the support widget",
    desc: "Set up your product assistant, preview it, and install it with one script tag.",
  },
  {
    title: "Test with your product knowledge",
    desc: "Add your docs, FAQs, and product details so the assistant can answer the questions your users ask.",
  },
  {
    title: "Ship to your users",
    desc: "Test locally, allow your production domain, then give visitors a clear path to your support email when they need a person.",
  },
];

const setupSteps = [
  {
    number: "01",
    title: "Create your support bot",
    desc: "Add your product name, support email, and paste the docs or answers your users need.",
  },
  {
    number: "02",
    title: "Test the experience",
    desc: "Preview the widget and test its answers before putting it on your production site.",
  },
  {
    number: "03",
    title: "Deploy the widget",
    desc: "Allow your local and production domains, then paste the embed snippet before the closing body tag.",
  },
];

const commonQuestions = [
  {
    question: "Can I onboard and test for free?",
    answer:
      "Yes. Free includes 200 monthly credits with a 20-credit daily cap, one bot, one registered domain, a 2 MB knowledge base, and Standard mode.",
  },
  {
    question: "What information should I add?",
    answer:
      "Start with product setup, API and authentication guides, troubleshooting steps, and support policies. Clear, current information helps the assistant give useful answers.",
  },
  {
    question: "Can the assistant make up an answer?",
    answer:
      "It is instructed to answer using the business information you provide. If a question cannot be answered from that information, it directs the customer to your support email.",
  },
  {
    question: "How do I put the chat on my website?",
    answer:
      "After saving your business details and knowledge, open Embed from your dashboard. Copy the script and paste it just before the closing body tag on your site.",
  },
];

const HomeClient = ({ userProfile }: { userProfile?: UserProfile }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pricingRegion, setPricingRegion] = useState<PricingRegion>("global");
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const selectPlan = (plan: EffectiveSubscriptionPlan) => {
    const query = new URLSearchParams({
      tab: "billing",
      plan,
      region: pricingRegion,
      interval: billingInterval,
    });
    if (userProfile) {
      router.push(`/dashboard?${query.toString()}`);
    } else {
      router.push("/login");
    }
  };

  const handleLogin = () => {
    setLoading(true);
    window.location.href = "/api/auth/login";
  };

  return (
    <div>
      <div className="min-h-screen bg-linear-to-br from-white to-zinc-50 text-zinc-900 overflow-x-hidden border-b">
        <Header
          userProfile={userProfile}
          loading={loading}
          onLogin={handleLogin}
        />

        <section className="pt-46 pb-36 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                Ship AI support chat <br />
                for your product
              </h1>
              <p className="mt-6 text-lg text-zinc-600 max-w-xl">
                Add a support widget with one script. Test it locally, add your
                product docs, then deploy it to your site.
              </p>
              <div className="mt-10 flex gap-4">
                {userProfile ? (
                  <Button
                    className="px-7 py-3 font-medium transition disabled:opacity-60 hover:cursor-pointer"
                    onClick={() => router.push("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <Button
                    className="px-7 py-3 font-medium transition disabled:opacity-60 hover:cursor-pointer"
                    onClick={handleLogin}
                    disabled={loading}
                  >
                    Get Started
                  </Button>
                )}
                <Button
                  variant={"outline"}
                  className="px-7 py-3 transition disabled:opacity-60 hover:cursor-pointer"
                  onClick={() =>
                    document
                      .getElementById("how-it-works")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  How It Works
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl shadow-2xl border border-zinc-200 p-6">
                <div className="text-sm text-zinc-500 mb-3">
                  Chat Preview
                </div>
                <div className="flex w-full max-w-sm flex-col gap-8 py-12">
                  <Bubble align="end" className="flex items-end">
                    <BubbleContent>
                      Can you help me with a delivery question?
                    </BubbleContent>
                    <Avatar>
                      <AvatarImage
                        src="https://github.com/evilrabbit.png"
                        alt="@evilrabbit"
                      />
                      <AvatarFallback>Evilrabbit</AvatarFallback>
                    </Avatar>
                  </Bubble>
                  <Bubble variant="muted">
                    <BubbleContent>
                      Absolutely! I can help with delivery, returns, and other
                      common questions. If you need a person, I’ll point you
                      to your support team.
                    </BubbleContent>
                    <Avatar>
                      <AvatarImage
                        src="https://t3.ftcdn.net/jpg/05/83/74/28/240_F_583742888_L0dIi5d23qJ2rteSlXMeMDGNsnLxbkjB.jpg"
                        alt="@bot"
                        className="grayscale h-7 w-7"
                      />
                      <AvatarFallback>Bot</AvatarFallback>
                      <AvatarBadge className="bg-green-600 dark:bg-green-800" />
                    </Avatar>
                  </Bubble>
                  <motion.div
                    animate={{ y: [0, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -bottom-6 -right-6 w-14 h-14 rounded-full bg-black flex items-center justify-center shadow-xl text-white"
                  >
                    <span className="text-2xl">💬</span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-20 border-t border-zinc-200 bg-zinc-50 px-6 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              The pingit promise
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0, animationDelay: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delayChildren: 0.5 }}
              className="mt-3 text-center text-3xl font-semibold tracking-tight"
            >
              Small questions, meet quick answers.
            </motion.h2>
            <p className="mx-auto mt-4 max-w-2xl text-center leading-7 text-zinc-600">
              pingit handles common questions using the information you
              provide, and gives customers a clear path to your team when they
              need extra help.
            </p>
            <Steps className="mt-12">
              {features.map((feat, i) => (
                <Step
                  key={feat.title}
                  number={`${i + 1}`}
                  title={feat.title}
                  description={feat.desc}
                  index={i}
                />
              ))}
            </Steps>
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-zinc-200 bg-white px-6 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              Three quick pings to get started
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">
              Get pingit on the job.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center leading-7 text-zinc-600">
              Create a bot, test the answers, and ship the widget with a small
              embed snippet.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {setupSteps.map((step) => (
                <Card
                  key={step.number}
                  className="h-full border-0 bg-zinc-50 ring-1 ring-zinc-200"
                >
                  <CardHeader>
                    <span className="text-sm font-semibold tracking-widest text-zinc-400">
                      {step.number}
                    </span>
                    <CardTitle className="mt-4 text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-zinc-600">
                      {step.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="scroll-mt-20 border-t border-zinc-200 bg-zinc-50 px-6 py-24"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              Transparent plans for every stage
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">
              Usage that scales with your product
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center leading-7 text-zinc-600">
              All plans use a clear monthly credit allowance. Choose the billing
              country to see the matching price book.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div role="group" aria-label="Billing country" className="flex flex-wrap justify-center gap-2">
                {([
                  ["global", "Global · USD"],
                  ["europe", "Europe · EUR"],
                  ["india", "India · INR"],
                ] as const).map(([region, label]) => (
                  <Button
                    key={region}
                    type="button"
                    size="sm"
                    variant={pricingRegion === region ? "default" : "outline"}
                    aria-pressed={pricingRegion === region}
                    onClick={() => setPricingRegion(region)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div role="group" aria-label="Billing interval" className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={billingInterval === "monthly" ? "default" : "outline"}
                  aria-pressed={billingInterval === "monthly"}
                  onClick={() => setBillingInterval("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={billingInterval === "annual" ? "default" : "outline"}
                  aria-pressed={billingInterval === "annual"}
                  onClick={() => setBillingInterval("annual")}
                >
                  Annual · Save 20%
                </Button>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(["free", "starter", "pro", "business"] as const).map((plan) => {
                const definition = PLAN_CATALOG[plan];
                const price = getPlanPrice(plan, pricingRegion, billingInterval);
                const credits = definition.credits[
                  pricingRegion === "india" ? "india" : "global"
                ];
                const priceLabel = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: price.currency,
                  maximumFractionDigits: price.currency === "INR" ? 0 : 2,
                }).format(price.amount);
                const planFeatures = plan === "free"
                  ? [
                      "Standard mode · 1 credit per reply",
                      "Up to 20 credits per day",
                      "1 bot · 1 registered domain · 2 MB knowledge base",
                      "Brand badge stays on",
                    ]
                  : plan === "starter"
                    ? [
                        "Standard mode · 1 credit per reply",
                        "Starter branding-removal add-on available",
                        "Smart mode and Pro features start at Pro",
                      ]
                    : [
                        "Standard mode · 1 credit; Smart mode · 4 credits",
                        "Lead capture, integrations, and human handoff",
                        "Branding removal included",
                      ];

                return (
                  <article
                    key={plan}
                    className={`flex h-full flex-col rounded-2xl border bg-white p-6 shadow-xs ${plan === "pro" ? "border-indigo-300 ring-1 ring-indigo-100" : "border-zinc-200"}`}
                  >
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {definition.name}
                    </h3>
                    <p className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
                      {priceLabel}
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        / {billingInterval === "annual" ? "year" : "month"}
                      </span>
                    </p>
                    {pricingRegion === "europe" && (
                      <p className="mt-1 text-xs text-zinc-500">VAT excluded</p>
                    )}
                    <p className="mt-3 text-sm font-medium text-zinc-700">
                      {credits.toLocaleString()} credits / month
                    </p>
                    <ul className="mt-5 flex-1 space-y-3 text-sm leading-5 text-zinc-600">
                      {planFeatures.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      className="mt-6 w-full"
                      variant={plan === "free" ? "outline" : "default"}
                      onClick={() => (plan === "free" && userProfile ? router.push("/dashboard") : selectPlan(plan))}
                      disabled={loading}
                    >
                      {plan === "free"
                        ? userProfile ? "Open dashboard" : "Start free"
                        : userProfile ? `Choose ${definition.name}` : "Create free account"}
                    </Button>
                  </article>
                );
              })}
            </div>
            <div className="mx-auto mt-6 grid max-w-4xl gap-3 text-center text-sm leading-6 text-zinc-600 sm:grid-cols-2">
              <p>
                Extra credits: {CREDIT_TOP_UP.credits.toLocaleString()} for{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: CREDIT_TOP_UP.price[pricingRegion].currency,
                  maximumFractionDigits: 0,
                }).format(CREDIT_TOP_UP.price[pricingRegion].amount)}.
              </p>
              <p>
                Starter branding removal: {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: STARTER_BRANDING_ADDON.price[pricingRegion].currency,
                  maximumFractionDigits: 0,
                }).format(STARTER_BRANDING_ADDON.price[pricingRegion].amount)} / month; included in Pro and Business.
              </p>
            </div>
            <p className="mx-auto mt-4 max-w-4xl text-center text-xs leading-5 text-zinc-500">
              Each successful Standard reply costs 1 credit; Smart costs 4. The cost estimate assumes 3,000 input and 250 output tokens and can vary with context and model thinking. Failed generations are refunded. EU prices exclude VAT; taxes and GST apply where required.
            </p>
          </div>
        </section>

        <section
          id="faq"
          className="scroll-mt-20 border-t border-zinc-200 bg-zinc-50 px-6 py-24"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              A few things people ask pingit
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold tracking-tight">
              Frequently asked questions
            </h2>
            <Accordion className="mt-10 border-y border-zinc-200">
              {commonQuestions.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="border-zinc-200 px-2"
                >
                  <AccordionTrigger className="py-5 text-base hover:no-underline hover:cursor-pointer">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pr-10 text-sm leading-6 text-zinc-600">
                    <p>{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white px-6 py-20">
          <Card className="mx-auto max-w-6xl items-center gap-0 rounded-3xl border-0 bg-zinc-950 text-white ring-0 [--card-spacing:--spacing(0)]">
            <p className="items-center px-8 pt-12 text-center sm:px-12 text-2xl tracking-tight sm:text-3xl">
              Ready to make support feel more instant?
            </p>
            <CardContent className="flex flex-col items-center px-8 pb-12 text-center sm:px-12">
              <p className="mt-3 max-w-xl leading-7 text-zinc-300">
                Give pingit the details. Let it take the first hello. Your
                customers get a quicker start, and your team gets room to focus.
              </p>
              <Button
                className="mt-7 bg-white px-7 py-3 font-medium text-zinc-950 hover:bg-zinc-200 hover:cursor-pointer"
                onClick={
                  userProfile ? () => router.push("/dashboard") : handleLogin
                }
                disabled={!userProfile && loading}
              >
                {userProfile ? "Go to Dashboard" : "Get Started"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <footer className="border-t border-zinc-200 bg-white px-6 py-8 text-sm text-zinc-600">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <span>
              &copy; {new Date().getFullYear()} pingit. All rights
              reserved.
            </span>
            <nav aria-label="Footer navigation" className="flex gap-5">
              <a className="transition hover:text-zinc-950" href="#features">
                Features
              </a>
              <a
                className="transition hover:text-zinc-950"
                href="#how-it-works"
              >
                How it works
              </a>
              <a className="transition hover:text-zinc-950" href="#pricing">
                Pricing
              </a>
              <a className="transition hover:text-zinc-950" href="#faq">
                FAQ
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HomeClient;
