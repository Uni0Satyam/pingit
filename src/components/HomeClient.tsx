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

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
};

const features = [
  {
    title: "Add the assistant",
    desc: "Install the chat on your website with a single script, giving visitors a familiar way to ask for help.",
  },
  {
    title: "Share your business knowledge",
    desc: "Add your FAQs, policies, delivery details, and other useful information so the assistant can answer common questions.",
  },
  {
    title: "Give customers a next step",
    desc: "When a question is outside the information you provided, the assistant directs customers to your support email.",
  },
];

const setupSteps = [
  {
    number: "01",
    title: "Add your business details",
    desc: "Sign in and enter your business name, support email, and the information customers ask about most.",
  },
  {
    number: "02",
    title: "Review your answers",
    desc: "Save your knowledge base, then preview how the chat experience will look on a website.",
  },
  {
    number: "03",
    title: "Embed pingit",
    desc: "Copy your unique embed snippet, paste it before your website’s closing body tag, and you’re ready to help visitors.",
  },
];

const commonQuestions = [
  {
    question: "What information should I add?",
    answer:
      "Start with your FAQs, return or refund policies, delivery information, service details, and support hours. Clear, current information helps the assistant give useful answers.",
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
                AI Customer support <br />
                Built for modern websites
              </h1>
              <p className="mt-6 text-lg text-zinc-600 max-w-xl">
                Add a powerful AI chatbot to your website in one click <br /> Let your
                customer get instant answers using your own business knowledge.
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
              No complicated workflow - Give business information, review the
              experience, then add the chatbot to your website.
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
