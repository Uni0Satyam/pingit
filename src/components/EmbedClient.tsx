"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import axios from "axios";
import { useAppDispatch } from "@/store/hooks";
import { updateChatbot } from "@/store/slices/chatbotsSlice";
import {
  Check,
  Copy,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { toast } from "./ui/toast";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import {
  PLAN_ENTITLEMENTS,
  type EffectiveSubscriptionPlan,
} from "@/lib/planEntitlements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { ChatbotItem } from "@/store/slices/chatbotsSlice";

type EmbedFramework = "javascript" | "react" | "next";
type ChatbotStatus = ChatbotItem["status"];

interface ChatbotDraft {
  name: string;
  businessName: string;
  businessEmail: string;
  knowledgeBase: string;
  allowedDomains: string;
  status: ChatbotStatus;
  welcomeMessage: string;
  primaryColor: string;
  systemPrompt: string;
  chatMode: "standard" | "smart";
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const frameworkOptions: { value: EmbedFramework; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "react", label: "React" },
  { value: "next", label: "Next.js" },
];

function getDraft(chatbot: ChatbotItem): ChatbotDraft {
  return {
    name: chatbot.name,
    businessName: chatbot.businessName,
    businessEmail: chatbot.businessEmail,
    knowledgeBase: chatbot.knowledgeBase || "",
    allowedDomains: (chatbot.allowedDomains || []).join("\n"),
    status: chatbot.status,
    welcomeMessage:
      chatbot.settings?.welcomeMessage || "Hi! How can I help you?",
    primaryColor: chatbot.settings?.primaryColor || "#2563eb",
    systemPrompt: chatbot.settings?.systemPrompt || "",
    chatMode: chatbot.settings?.chatMode || "standard",
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const EmbedClient = ({
  userProfile,
  chatbot,
}: {
  userProfile: {
    id: string;
    plan: EffectiveSubscriptionPlan;
    brandingRemovalActive: boolean;
  };
  chatbot: ChatbotItem;
}) => {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState<ChatbotDraft>(() => getDraft(chatbot));
  const [framework, setFramework] = useState<EmbedFramework>("javascript");
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const widgetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chatBot.js`;
  const domainLimit = PLAN_ENTITLEMENTS[userProfile.plan].maxAllowedDomains;
  const canUseSmartMode = PLAN_ENTITLEMENTS[userProfile.plan].modes.includes("smart");
  const hideBranding =
    userProfile.brandingRemovalActive ||
    PLAN_ENTITLEMENTS[userProfile.plan].brandingRemovalIncluded;
  const embedAttributes = [
    `data-user-id="${escapeHtmlAttribute(userProfile.id)}"`,
    `data-chatbot-id="${escapeHtmlAttribute(chatbot._id)}"`,
    `data-business-name="${escapeHtmlAttribute(draft.businessName)}"`,
    `data-business-email="${escapeHtmlAttribute(draft.businessEmail)}"`,
    `data-primary-color="${escapeHtmlAttribute(draft.primaryColor)}"`,
    `data-welcome-message="${escapeHtmlAttribute(draft.welcomeMessage)}"`,
    `data-hide-branding="${hideBranding ? "true" : "false"}"`,
  ].join(" ");

  const instructions = useMemo(
    () =>
      ({
        javascript: {
          code: `<script src="${widgetUrl}" ${embedAttributes}></script>`,
          steps: [
            "Copy the script below.",
            "Paste it just before the closing </body> tag in your website HTML.",
            "Publish or reload your site, then open the chat bubble to test it.",
          ],
          note: "Works with a plain HTML website or any site where you can edit the page HTML.",
        },
        react: {
          code: `<script src="${widgetUrl}" ${embedAttributes}></script>`,
          steps: [
            "Copy the script below.",
            "For Vite, paste it into the root index.html. For Create React App, use public/index.html.",
            "Place it just before </body>, then restart or redeploy your site.",
          ],
          note: "Add the script to the HTML entry point rather than inside a React component. This keeps it from being injected again when React re-renders.",
        },
        next: {
          code: `import Script from "next/script";\n\n// Add this inside the <body> in app/layout.tsx\n<Script\n  src="${widgetUrl}"\n  data-user-id={${JSON.stringify(userProfile.id)}}\n  data-chatbot-id={${JSON.stringify(chatbot._id)}}\n  data-business-name={${JSON.stringify(draft.businessName)}}\n  data-business-email={${JSON.stringify(draft.businessEmail)}}\n  data-primary-color={${JSON.stringify(draft.primaryColor)}}\n  data-welcome-message={${JSON.stringify(draft.welcomeMessage)}}\n  strategy="afterInteractive"\n/>`,
          steps: [
            "Import Script from next/script in your root app/layout.tsx.",
            "Place the snippet inside the root layout’s <body> element.",
            "Restart or redeploy your Next.js site and test the chat on a page.",
          ],
          note: "For the Pages Router, add the same next/script element to pages/_app.tsx instead.",
        },
      }) satisfies Record<
        EmbedFramework,
        { code: string; steps: string[]; note: string }
      >,
    [
      chatbot._id,
      draft.businessName,
      draft.primaryColor,
      draft.welcomeMessage,
      embedAttributes,
      userProfile.id,
      widgetUrl,
    ],
  );
  const selectedInstructions = instructions[framework];

  const updateDraft = <K extends keyof ChatbotDraft>(
    key: K,
    value: ChatbotDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveConfiguration = async () => {
    if (
      !draft.name.trim() ||
      !draft.businessName.trim() ||
      !draft.businessEmail.trim() ||
      !draft.welcomeMessage.trim()
    ) {
      toast.add({
        type: "error",
        title: "Check required fields",
        description:
          "Chatbot name, business name, email, and welcome message are required.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await dispatch(
        updateChatbot({
          id: chatbot._id,
          data: {
          name: draft.name.trim(),
          businessName: draft.businessName.trim(),
          businessEmail: draft.businessEmail.trim(),
          knowledgeBase: draft.knowledgeBase,
          allowedDomains: draft.allowedDomains
            .split(/[\n,]/)
            .map((domain) => domain.trim())
            .filter(Boolean),
          status: draft.status,
          settings: {
            welcomeMessage: draft.welcomeMessage.trim(),
            primaryColor: draft.primaryColor,
            systemPrompt: draft.systemPrompt,
            chatMode: draft.chatMode,
          },
          },
        }),
      );

      if (!updateChatbot.fulfilled.match(result)) {
        throw new Error(
          typeof result.payload === "string"
            ? result.payload
            : "Could not save changes.",
        );
      }

      const updated = result.payload;
      setDraft(getDraft(updated));
      toast.add({
        type: "success",
        title: "Chatbot updated",
        description: "Your configuration has been saved.",
      });
    } catch (error: unknown) {
      toast.add({
        type: "error",
        title: "Could not save changes",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(selectedInstructions.code);
      setIsCopied(true);
      toast.add({
        type: "success",
        title: "Embed code copied",
        description: "Paste it into your website to add Pingit.",
      });
    } catch (error: unknown) {
      console.error("Failed to copy embed code:", error);
      toast.add({
        type: "error",
        title: "Could not copy code",
        description: "Select and copy the code manually.",
      });
    }
  };

  return (
    <div className="space-y-6 text-zinc-900">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Chatbot appearance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Change your chatbot settings and see the preview update
              immediately.
            </p>
          </div>

          <Button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="h-10 gap-2 px-4"
          >
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Check className="size-4" aria-hidden="true" />
                Save changes
              </>
            )}
          </Button>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Configuration</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Configuring{" "}
                      <span className="font-medium text-zinc-700">
                        {chatbot.name}
                      </span>
                      . Edits appear in the preview as you type.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="chatbot-name">Chatbot name</Label>
                    <Input
                      id="chatbot-name"
                      value={draft.name}
                      onChange={(event) => updateDraft("name", event.target.value)}
                      placeholder="Support assistant"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-name">Widget title</Label>
                    <Input
                      id="business-name"
                      value={draft.businessName}
                      onChange={(event) =>
                        updateDraft("businessName", event.target.value)
                      }
                      placeholder="Your business name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-email">Support email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={draft.businessEmail}
                      onChange={(event) =>
                        updateDraft("businessEmail", event.target.value)
                      }
                      placeholder="support@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chatbot-status">Status</Label>
                    <select
                      id="chatbot-status"
                      value={draft.status}
                      onChange={(event) =>
                        updateDraft("status", event.target.value as ChatbotStatus)
                      }
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                      {draft.status === "paused" && (
                        <option value="paused" disabled>Paused after 30 days without traffic</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="chat-mode">AI mode</Label>
                  <select
                    id="chat-mode"
                    value={draft.chatMode}
                    onChange={(event) =>
                      updateDraft("chatMode", event.target.value as "standard" | "smart")
                    }
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200"
                  >
                    <option value="standard">Standard · 1 credit per reply</option>
                    {canUseSmartMode && (
                      <option value="smart">Smart · 4 credits per reply</option>
                    )}
                  </select>
                  <p className="text-xs leading-5 text-zinc-500">
                    {canUseSmartMode
                      ? "Smart uses Gemini 3.8 Flash with low thinking. Standard uses Gemini 3.5 Flash-Lite."
                      : "Standard uses Gemini 3.5 Flash-Lite. Smart mode is available on Pro and Business."}
                  </p>
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="welcome-message">Welcome message</Label>
                  <Textarea
                    id="welcome-message"
                    value={draft.welcomeMessage}
                    onChange={(event) =>
                      updateDraft("welcomeMessage", event.target.value)
                    }
                    className="min-h-20"
                    placeholder="Hi! How can I help you?"
                  />
                </div>

                <div className="mt-5 space-y-2">
                  <Label htmlFor="allowed-domains">Allowed website domains</Label>
                  <Textarea
                    id="allowed-domains"
                    value={draft.allowedDomains}
                    onChange={(event) =>
                      updateDraft("allowedDomains", event.target.value)
                    }
                    className="min-h-20"
                    placeholder="example.com"
                  />
                  <p className="text-xs leading-5 text-zinc-500">
                    Enter hostnames only, one per line.{" "}
                    {domainLimit === null
                      ? "Your plan supports multiple domains."
                      : `The Free plan allows ${domainLimit} domain. Add the domain where this widget will run.`}
                  </p>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Brand color</Label>
                    <div className="flex h-10 items-center gap-3 rounded-lg border border-zinc-200 px-3">
                      <Input
                        id="primary-color"
                        type="color"
                        value={draft.primaryColor}
                        onChange={(event) =>
                          updateDraft("primaryColor", event.target.value)
                        }
                        className="size-7 cursor-pointer border-0 p-0"
                        aria-label="Choose chatbot brand color"
                      />
                      <span className="font-mono text-sm uppercase text-zinc-600">
                        {draft.primaryColor}
                      </span>
                    </div>
                  </div>
                </div>

                <details className="mt-6 rounded-xl border border-zinc-200">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700">
                    Advanced assistant settings
                  </summary>
                  <div className="space-y-5 border-t border-zinc-100 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="knowledge-base">Knowledge base</Label>
                      <Textarea
                        id="knowledge-base"
                        value={draft.knowledgeBase}
                        onChange={(event) =>
                          updateDraft("knowledgeBase", event.target.value)
                        }
                        className="min-h-28"
                        placeholder="Add FAQs, policies, and other information for your assistant."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt">
                        Additional instructions
                      </Label>
                      <Textarea
                        id="system-prompt"
                        value={draft.systemPrompt}
                        onChange={(event) =>
                          updateDraft("systemPrompt", event.target.value)
                        }
                        className="min-h-24"
                        placeholder="Describe how your assistant should respond."
                      />
                    </div>
                  </div>
                </details>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">Install your chatbot</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Choose your framework and copy the embed snippet.
                  </p>
                </div>

                <div className="mb-4 max-w-xs space-y-2">
                  <Label htmlFor="embed-framework">Framework</Label>
                  <Select
                    value={framework}
                    onValueChange={(value) => {
                      const option = frameworkOptions.find(
                        (item) => item.value === value,
                      );
                      if (option) {
                        setFramework(option.value);
                        setIsCopied(false);
                      }
                    }}
                  >
                    <SelectTrigger id="embed-framework" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frameworkOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative rounded-xl bg-zinc-950 p-4 pr-20 text-xs leading-6 text-zinc-100 sm:text-sm">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                    {selectedInstructions.code}
                  </pre>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute right-3 top-3 gap-1.5"
                    onClick={copyCode}
                  >
                    {isCopied ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                    {isCopied ? "Copied" : "Copy"}
                  </Button>
                </div>

                <ol className="mt-5 list-inside list-decimal space-y-2 text-sm leading-6 text-zinc-600">
                  {selectedInstructions.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {selectedInstructions.note}
                </p>
              </div>
            </section>

            <section className="xl:sticky xl:top-24">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">Live preview</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Preview of your chatbot on a website.
                  </p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm"
                >
                  <div className="flex h-10 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4">
                    <span className="size-2.5 rounded-full bg-red-400" />
                    <span className="size-2.5 rounded-full bg-yellow-400" />
                    <span className="size-2.5 rounded-full bg-green-400" />
                    <span className="ml-3 text-xs text-zinc-500">
                      your-website.com
                    </span>
                  </div>

                  <div className="relative min-h-[480px] overflow-hidden bg-[linear-gradient(145deg,#fafafa_0%,#f4f4f5_60%,#e4e4e7_100%)] p-5 sm:min-h-[560px] sm:p-8">
                    <div className="max-w-[65%] space-y-3">
                      <div className="h-3 w-24 rounded bg-zinc-300/70" />
                      <div className="h-2 w-40 rounded bg-zinc-200" />
                      <div className="h-2 w-32 rounded bg-zinc-200" />
                      <div className="mt-8 h-28 w-full rounded-xl border border-zinc-200/80 bg-white/70" />
                    </div>
                    <div className="absolute bottom-5 right-4 flex flex-col items-end gap-3 sm:bottom-7 sm:right-6">
                      {isPreviewOpen && (
                        <div className="w-[min(290px,calc(100vw-64px))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15">
                          <div
                            className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-white"
                            style={{ backgroundColor: draft.primaryColor }}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="size-2 rounded-full bg-emerald-300" />
                              <span className="truncate text-sm font-semibold">
                                {draft.businessName || "Your business"}
                              </span>
                            </div>
                            <button
                              type="button"
                              aria-label="Close chatbot preview"
                              onClick={() => setIsPreviewOpen(false)}
                              className="shrink-0 rounded px-1 text-lg leading-none text-white/80 hover:text-white"
                            >
                              &times;
                            </button>
                          </div>
                          <div className="flex min-h-48 flex-col gap-3 bg-zinc-50 p-4">
                            <div className="max-w-[88%] self-start rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm leading-5 text-zinc-700 shadow-sm ring-1 ring-zinc-200/70">
                              {draft.welcomeMessage ||
                                "Your welcome message will appear here."}
                            </div>
                            <div
                              className="max-w-[88%] self-end rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-5 text-white"
                              style={{ backgroundColor: draft.primaryColor }}
                            >
                              Where can I find more information?
                            </div>
                            <div className="max-w-[88%] self-start rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm leading-5 text-zinc-700 shadow-sm ring-1 ring-zinc-200/70">
                              I&apos;m happy to help. What would you like to
                              know?
                            </div>
                          </div>
                          <div className="flex items-center gap-2 border-t border-zinc-100 bg-white p-3">
                            <div className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-400">
                              Type a message...
                            </div>
                            <span
                              className="flex size-8 items-center justify-center rounded-lg text-white"
                              style={{ backgroundColor: draft.primaryColor }}
                            >
                              <Send className="size-3.5" aria-hidden="true" />
                            </span>
                          </div>
                          <div className="border-t border-zinc-100 bg-white py-2 text-center text-[10px] text-zinc-400">
                            Powered by pingit
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen((open) => !open)}
                        aria-label={
                          isPreviewOpen
                            ? "Close chatbot preview"
                            : "Open chatbot preview"
                        }
                        className="flex size-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
                        style={{ backgroundColor: draft.primaryColor }}
                      >
                        {isPreviewOpen ? (
                          <X className="size-6" aria-hidden="true" />
                        ) : (
                          <MessageCircle
                            className="size-6"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
                <p className="mt-4 text-xs leading-5 text-zinc-400">
                  Changes are previewed instantly. Save changes to update this
                  chatbot&apos;s saved configuration.
                </p>
              </div>
            </section>
        </div>
    </div>
  );
};

export default EmbedClient;
