"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  MessageSquareText,
  ChartNoAxesCombined,
  Settings,
  CreditCard,
  Plus,
  Code2,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchChatbots,
  createChatbot,
  deleteChatbot,
  ChatbotItem,
} from "@/store/slices/chatbotsSlice";
import {
  setActiveTab,
  setFilterStatus,
  setSearchQuery,
  setSelectedChatbot,
  setIsCreateModalOpen,
} from "@/store/slices/dashboardSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PLAN_ENTITLEMENTS } from "@/lib/planEntitlements";
import type {
  BillingInterval,
  EffectiveSubscriptionPlan,
  PricingRegion,
} from "@/lib/planEntitlements";
import EmbedClient from "@/components/EmbedClient";
import ChatbotsTab from "@/components/dashboard/ChatbotsTab";
import AnalyticsTab from "@/components/dashboard/AnalyticsTab";
import ConversationsTab from "@/components/dashboard/ConversationsTab";
import BillingTab from "@/components/dashboard/BillingTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import type { UserProfile } from "@/components/dashboard/types";

interface DashboardClientProps {
  userProfile: UserProfile;
}

const PRESET_COLORS = [
  "#2563eb", // Royal Blue
  "#000000", // Onyx Black
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ef4444", // Crimson
];

export default function DashboardClient({ userProfile }: DashboardClientProps) {
  const entitlements = PLAN_ENTITLEMENTS[userProfile.plan];
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedChatbotId = searchParams.get("chatbotId");
  const [initialBillingSelection] = useState(() => {
    const plan = searchParams.get("plan");
    const region = searchParams.get("region");
    const interval = searchParams.get("interval");
    return {
      plan: ["free", "starter", "pro", "business"].includes(plan ?? "")
        ? (plan as EffectiveSubscriptionPlan)
        : undefined,
      region: ["global", "europe", "india"].includes(region ?? "")
        ? (region as PricingRegion)
        : undefined,
      interval: ["monthly", "annual"].includes(interval ?? "")
        ? (interval as BillingInterval)
        : undefined,
    };
  });
  const dispatch = useAppDispatch();
  const {
    items: chatbots,
    status,
    error,
    actionLoading,
  } = useAppSelector((state) => state.chatbots);
  const canCreateChatbot =
    entitlements.maxChatbots === null ||
    chatbots.length < entitlements.maxChatbots;
  const {
    activeTab,
    filterStatus,
    searchQuery,
    selectedChatbot,
    isCreateModalOpen,
  } = useAppSelector((state) => state.dashboard);
  const initialDisplayName =
    `${userProfile.firstName} ${userProfile.lastName}`.trim() || "User";

  // Local state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<ChatbotItem | null>(null);
  const [profileName, setProfileName] = useState(initialDisplayName);
  const [currentPlan, setCurrentPlan] = useState(userProfile.plan);
  const profileNameParts = profileName.split(/\s+/);

  // Create chatbot form state
  const [formData, setFormData] = useState({
    name: "",
    businessName: "",
    businessEmail: "",
    knowledgeBase: "",
    status: "active" as "draft" | "active" | "disabled",
    welcomeMessage: "Hi! How can I help you today?",
    primaryColor: "#2563eb",
    systemPrompt: "",
    chatMode: "standard" as "standard" | "smart",
  });

  const goToBilling = () => {
    dispatch(setActiveTab("billing"));
    dispatch(setIsCreateModalOpen(false));
    setMobileSidebarOpen(false);
    router.replace("/dashboard?tab=billing", { scroll: false });
  };

  // Fetch chatbots on mount
  useEffect(() => {
    dispatch(fetchChatbots(userProfile.id));
  }, [dispatch, userProfile.id]);

  useEffect(() => {
    if (
      !["embed", "settings", "billing"].includes(requestedTab ?? "") ||
      status !== "succeeded"
    ) {
      return;
    }

    if (requestedTab === "settings" || requestedTab === "billing") {
      dispatch(setActiveTab(requestedTab));
    } else {
      const chatbot = requestedChatbotId
        ? chatbots.find((item) => item._id === requestedChatbotId)
        : undefined;
      if (chatbot) {
        dispatch(setSelectedChatbot(chatbot));
      }
      dispatch(setActiveTab("embed"));
    }
    router.replace("/dashboard", { scroll: false });
  }, [chatbots, dispatch, requestedChatbotId, requestedTab, router, status]);

  const openEmbedTab = (chatbot: ChatbotItem) => {
    dispatch(setSelectedChatbot(chatbot));
    dispatch(setActiveTab("embed"));
    setMobileSidebarOpen(false);
  };

  const openCreateModal = () => {
    if (!canCreateChatbot) {
      goToBilling();
      return;
    }
    setFormData({
      name: "",
      businessName: "",
      businessEmail: userProfile.email || "",
      knowledgeBase: "",
      status: "active",
      welcomeMessage: "Hi! How can I help you today?",
      primaryColor: "#2563eb",
      systemPrompt: "",
      chatMode: "standard",
    });
    dispatch(setIsCreateModalOpen(true));
  };

  const filteredChatbots = useMemo(() => {
    return chatbots.filter((bot) => {
      const matchesSearch =
        bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bot.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bot.businessEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === "all" || bot.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [chatbots, searchQuery, filterStatus]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(
      createChatbot({
        userId: userProfile.id,
        name: formData.name,
        businessName: formData.businessName,
        businessEmail: formData.businessEmail,
        knowledgeBase: formData.knowledgeBase,
        status: formData.status,
        settings: {
          welcomeMessage: formData.welcomeMessage,
          primaryColor: formData.primaryColor,
          systemPrompt: formData.systemPrompt,
          chatMode: formData.chatMode,
        },
      }),
    );

    if (createChatbot.fulfilled.match(result)) {
      toast.add({
        type: "success",
        title: "Chatbot Created!",
        description: `"${result.payload.name}" is now ready for deployment.`,
      });
    } else {
      toast.add({
        type: "error",
        title: "Creation Failed",
        description: (result.payload as string) || "Could not create chatbot",
      });
    }
  };

  const confirmDelete = async () => {
    if (!botToDelete) return;
    const result = await dispatch(deleteChatbot(botToDelete._id));

    if (deleteChatbot.fulfilled.match(result)) {
      toast.add({
        type: "success",
        title: "Chatbot Deleted",
        description: `"${botToDelete.name}" has been removed.`,
      });
    } else {
      toast.add({
        type: "error",
        title: "Delete Failed",
        description: (result.payload as string) || "Failed to delete chatbot",
      });
    }
    setDeleteDialogOpen(false);
    setBotToDelete(null);
  };

  const handleLogout = () => {
    router.push("/api/auth/logout");
  };

  const activeCount = chatbots.filter((b) => b.status === "active").length;
  const draftCount = chatbots.filter((b) => b.status === "draft").length;

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden font-sans">
      {/* ---------------- MOBILE SIDEBAR OVERLAY ---------------- */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          />
        )}
      </AnimatePresence>

      {/* ---------------- SIDEBAR ---------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-200 bg-white transition-transform duration-300 md:static md:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-100 px-6">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => dispatch(setActiveTab("chatbots"))}
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-black text-white shadow-xs">
              <Bot size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              ping<span className="text-zinc-400">it</span>
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 border border-zinc-200">
              Admin
            </span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="px-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            Workspace
          </p>
          <nav className="mt-3 space-y-1.5">
            <button
              onClick={() => {
                dispatch(setActiveTab("chatbots"));
                setMobileSidebarOpen(false);
              }}
              className={cn(
                "group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                activeTab === "chatbots"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <div className="flex items-center gap-3">
                <Bot
                  size={18}
                  className={
                    activeTab === "chatbots" ? "text-white" : "text-zinc-500"
                  }
                />
                <span>Chatbots</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  activeTab === "chatbots"
                    ? "bg-white/20 text-white"
                    : "bg-zinc-100 text-zinc-600",
                )}
              >
                {chatbots.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (entitlements.conversations) {
                  dispatch(setActiveTab("conversations"));
                  setMobileSidebarOpen(false);
                } else {
                  goToBilling();
                }
              }}
              aria-disabled={!entitlements.conversations}
              title={
                entitlements.conversations
                  ? undefined
                  : "Upgrade to Business to access conversations"
              }
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                !entitlements.conversations && "opacity-55",
                entitlements.conversations && activeTab === "conversations"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <MessageSquareText
                size={18}
                className={
                  entitlements.conversations && activeTab === "conversations"
                    ? "text-white"
                    : "text-zinc-500"
                }
              />
              <span className="flex-1 text-left">Conversations</span>
              {!entitlements.conversations && (
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  Upgrade
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (entitlements.analytics) {
                  dispatch(setActiveTab("analytics"));
                  setMobileSidebarOpen(false);
                } else {
                  goToBilling();
                }
              }}
              aria-disabled={!entitlements.analytics}
              title={
                entitlements.analytics
                  ? undefined
                  : "Upgrade to Business to access analytics"
              }
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                !entitlements.analytics && "opacity-55",
                entitlements.analytics && activeTab === "analytics"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <ChartNoAxesCombined
                size={18}
                className={
                  entitlements.analytics && activeTab === "analytics"
                    ? "text-white"
                    : "text-zinc-500"
                }
              />
              <span className="flex-1 text-left">Analytics</span>
              {!entitlements.analytics && (
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  Upgrade
                </span>
              )}
            </button>

            <button
              onClick={() => {
                dispatch(setActiveTab("billing"));
                setMobileSidebarOpen(false);
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                activeTab === "billing"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <CreditCard
                size={18}
                className={
                  activeTab === "billing" ? "text-white" : "text-zinc-500"
                }
              />
              <span>Billing</span>
            </button>

            <button
              onClick={() => {
                dispatch(setActiveTab("settings"));
                setMobileSidebarOpen(false);
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                activeTab === "settings"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <Settings
                size={18}
                className={
                  activeTab === "settings" ? "text-white" : "text-zinc-500"
                }
              />
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                dispatch(setActiveTab("embed"));
                setMobileSidebarOpen(false);
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition cursor-pointer",
                activeTab === "embed"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <Code2
                size={18}
                className={
                  activeTab === "embed" ? "text-white" : "text-zinc-500"
                }
              />
              <span>Embed</span>
            </button>
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="border-t border-zinc-100 p-4">
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 border border-zinc-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-xs text-white">
                {(profileNameParts[0]?.[0] || "U").toUpperCase()}
                {(profileNameParts.slice(1).join(" ")[0] || "").toUpperCase()}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-semibold text-zinc-900">
                  {profileName}
                </p>
                <p className="truncate text-[11px] text-zinc-500">
                  {userProfile.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-destructive transition cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              {activeTab === "embed"
                ? "Embed"
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={goToBilling}
              title={`Current plan: ${getPlanLabel(currentPlan)}`}
              className="h-8 gap-1 border-indigo-200 bg-indigo-50 px-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 sm:gap-1.5 sm:px-3"
              aria-label={`Current plan: ${getPlanLabel(currentPlan)}. Open billing.`}
            >
              <span className="size-1.5 rounded-full bg-indigo-500" />
              <span className="sm:hidden">
                {getPlanLabel(currentPlan)}
              </span>
              <span className="hidden sm:inline">
                {getPlanLabel(currentPlan)}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(fetchChatbots(userProfile.id))}
              disabled={status === "loading"}
              className="hidden sm:inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <RefreshCw
                size={14}
                className={cn(status === "loading" && "animate-spin")}
              />
              Refresh
            </Button>

            {activeTab === "chatbots" && (
              <Button
                size="sm"
                onClick={canCreateChatbot ? openCreateModal : goToBilling}
                aria-disabled={!canCreateChatbot}
                title={
                  canCreateChatbot
                    ? undefined
                    : "Your Free plan includes one chatbot. Upgrade to Premium to create more."
                }
                className={cn(
                  "flex items-center gap-1.5 shadow-xs cursor-pointer text-xs",
                  !canCreateChatbot && "opacity-60",
                )}
              >
                {canCreateChatbot ? (
                  <>
                    <Plus size={15} />
                    Create Chatbot
                  </>
                ) : (
                  "Plan limit reached"
                )}
              </Button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {activeTab === "chatbots" && (
            <ChatbotsTab
              chatbots={chatbots}
              filteredChatbots={filteredChatbots}
              status={status}
              error={error}
              searchQuery={searchQuery}
              filterStatus={filterStatus}
              onSearchChange={(value) => dispatch(setSearchQuery(value))}
              onFilterChange={(filter) => dispatch(setFilterStatus(filter))}
              onRetry={() => dispatch(fetchChatbots(userProfile.id))}
              onCreate={openCreateModal}
              onEmbed={openEmbedTab}
              onDelete={(chatbot) => {
                setBotToDelete(chatbot);
                setDeleteDialogOpen(true);
              }}
            />
          )}

          {activeTab === "analytics" && entitlements.analytics && (
            <AnalyticsTab
              totalCount={chatbots.length}
              activeCount={activeCount}
              draftCount={draftCount}
            />
          )}

          {activeTab === "conversations" && entitlements.conversations && (
            <ConversationsTab />
          )}

          {((activeTab === "analytics" && !entitlements.analytics) ||
            (activeTab === "conversations" && !entitlements.conversations)) && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold">Available on Business</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Conversation history and usage analytics are included with a
                Business subscription.
              </p>
              <Button
                className="mt-5"
                onClick={goToBilling}
              >
                Go to billing
              </Button>
            </section>
          )}

          {activeTab === "settings" && (
            <SettingsTab
              userProfile={userProfile}
              profileName={profileName}
              onProfileNameChange={setProfileName}
              onBillingClick={goToBilling}
            />
          )}

          {activeTab === "billing" && (
            <BillingTab
              userProfile={userProfile}
              onPlanChange={setCurrentPlan}
              initialSelection={initialBillingSelection}
            />
          )}

          {activeTab === "embed" &&
            (selectedChatbot ? (
              <EmbedClient userProfile={userProfile} chatbot={selectedChatbot} />
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-14 text-center shadow-sm">
                <Code2 className="mx-auto size-10 text-zinc-400" />
                <h2 className="mt-4 text-lg font-semibold">
                  Choose a chatbot to customize
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Select a chatbot from your workspace to configure its
                  appearance and preview the embed.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => dispatch(setActiveTab("chatbots"))}
                >
                  Browse chatbots
                </Button>
              </div>
            ))}
        </div>
      </main>

      {/* ---------------- CREATE CHATBOT MODAL ---------------- */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => dispatch(setIsCreateModalOpen(false))}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    Create New Chatbot Assistant
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure your AI agent&apos;s identity, tone, and
                    knowledge.
                  </p>
                </div>
                <button
                  onClick={() => dispatch(setIsCreateModalOpen(false))}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-6 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1.5">
                    Chatbot Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    placeholder="e.g. Order Support Agent"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-9.5 text-xs rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Business Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      required
                      placeholder="e.g. Acme Corporation"
                      value={formData.businessName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessName: e.target.value,
                        })
                      }
                      className="h-9.5 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Business Support Email{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      required
                      type="email"
                      placeholder="support@acme.com"
                      value={formData.businessEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessEmail: e.target.value,
                        })
                      }
                      className="h-9.5 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1.5">
                    Assistant Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["active", "draft", "disabled"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: s })}
                        className={cn(
                          "rounded-xl py-2 font-medium capitalize border transition cursor-pointer text-xs",
                          formData.status === s
                            ? "bg-zinc-950 text-white border-zinc-950 shadow-xs"
                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1.5">
                    Knowledge Base (FAQs, Policies, Services)
                  </label>
                  <Textarea
                    rows={4}
                    placeholder="- Refund policy: 7 days after purchase with original receipt&#10;- Shipping times: 3-5 business days across US&#10;- Support hours: 9 AM - 6 PM EST"
                    value={formData.knowledgeBase}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        knowledgeBase: e.target.value,
                      })
                    }
                    className="text-xs resize-none rounded-xl"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    The assistant will only answer questions using the knowledge
                    provided above.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1.5">
                    Welcome Message
                  </label>
                  <Input
                    placeholder="Hi! How can I help you today?"
                    value={formData.welcomeMessage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        welcomeMessage: e.target.value,
                      })
                    }
                    className="h-9.5 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1.5">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, primaryColor: color })
                          }
                          style={{ backgroundColor: color }}
                          className={cn(
                            "size-6 rounded-full border-2 transition cursor-pointer",
                            formData.primaryColor === color
                              ? "border-zinc-900 scale-110 shadow-xs"
                              : "border-transparent hover:scale-105",
                          )}
                        />
                      ))}
                    </div>
                    <Input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryColor: e.target.value,
                        })
                      }
                      className="w-28 h-8 text-xs font-mono rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => dispatch(setIsCreateModalOpen(false))}
                    className="cursor-pointer text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="cursor-pointer text-xs"
                  >
                    {actionLoading ? "Saving..." : "Create Chatbot"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------- DELETE CONFIRMATION DIALOG ---------------- */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 size={20} />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this chatbot?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{botToDelete?.name}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={actionLoading}
              className="cursor-pointer text-xs"
            >
              {actionLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getPlanLabel(plan: UserProfile["plan"]) {
  return plan === "free" ? "Free" : plan[0].toUpperCase() + plan.slice(1);
}
