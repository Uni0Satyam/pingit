"use client";

import { motion } from "motion/react";
import {
  AlertCircle,
  Bot,
  Building2,
  Code2,
  Edit3,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatbotItem } from "@/store/slices/chatbotsSlice";

type ChatbotStatus = "idle" | "loading" | "succeeded" | "failed";
type ChatbotFilter = "all" | "draft" | "active" | "disabled";

interface ChatbotsTabProps {
  chatbots: ChatbotItem[];
  filteredChatbots: ChatbotItem[];
  status: ChatbotStatus;
  error: string | null;
  searchQuery: string;
  filterStatus: ChatbotFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: ChatbotFilter) => void;
  onRetry: () => void;
  onCreate: () => void;
  onEmbed: (chatbot: ChatbotItem) => void;
  onDelete: (chatbot: ChatbotItem) => void;
}

export default function ChatbotsTab({
  chatbots,
  filteredChatbots,
  status,
  error,
  searchQuery,
  filterStatus,
  onSearchChange,
  onFilterChange,
  onRetry,
  onCreate,
  onEmbed,
  onDelete,
}: ChatbotsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            placeholder="Search by name, business, or email..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9 h-9.5 text-xs bg-white rounded-xl shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "active", "draft", "disabled"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition cursor-pointer select-none",
                filterStatus === filter
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100",
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {status === "failed" && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error || "Failed to load chatbots."}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onRetry} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {status === "loading" && chatbots.length === 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-4 bg-zinc-200 rounded-md w-1/3" />
                <div className="h-6 bg-zinc-200 rounded-md w-3/4" />
                <div className="h-16 bg-zinc-100 rounded-lg w-full" />
              </div>
              <div className="h-9 bg-zinc-100 rounded-lg w-full" />
            </div>
          ))}
        </div>
      )}

      {status !== "loading" && filteredChatbots.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
            <Bot size={28} />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">
            {searchQuery ? "No matching chatbots found" : "No chatbots created yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            {searchQuery
              ? "Try tweaking your search terms or clearing status filters."
              : "Create your first AI assistant to start answering customer inquiries using your business knowledge."}
          </p>
          {!searchQuery && (
            <Button onClick={onCreate} className="mt-6 flex items-center gap-2 shadow-xs cursor-pointer text-xs">
              <Plus size={15} />
              Create My First Chatbot
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredChatbots.map((bot) => (
          <motion.div
            key={bot._id}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-300 hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border",
                    bot.status === "active" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    bot.status === "draft" && "bg-amber-50 text-amber-700 border-amber-200",
                    bot.status === "disabled" && "bg-zinc-100 text-zinc-600 border-zinc-200",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      bot.status === "active" && "bg-emerald-500 animate-pulse",
                      bot.status === "draft" && "bg-amber-500",
                      bot.status === "disabled" && "bg-zinc-400",
                    )}
                  />
                  {bot.status}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEmbed(bot)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
                    title="Customize and preview chatbot"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(bot)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                    title="Delete Chatbot"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: bot.settings?.primaryColor || "#2563eb" }}
                    title={`Primary Color: ${bot.settings?.primaryColor || "#2563eb"}`}
                  />
                  <h3 className="font-semibold text-base text-zinc-900 truncate">{bot.name}</h3>
                </div>

                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 size={13} className="shrink-0 text-zinc-400" />
                    <span className="truncate font-medium text-zinc-700">{bot.businessName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail size={13} className="shrink-0 text-zinc-400" />
                    <span className="truncate">{bot.businessEmail}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-zinc-50 p-3 border border-zinc-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  <MessageSquare size={12} />
                  Greeting
                </div>
                <p className="text-xs text-zinc-700 line-clamp-2 italic">
                  &ldquo;{bot.settings?.welcomeMessage || "Hi! How can I help you?"}&rdquo;
                </p>
              </div>

              <div className="mt-3 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>
                  Knowledge Base:{" "}
                  <strong className="text-zinc-600 font-medium">
                    {bot.knowledgeBase ? `${bot.knowledgeBase.length} chars` : "Empty"}
                  </strong>
                </span>
                <span>{new Date(bot.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEmbed(bot)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Code2 size={14} />
                Embed
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
