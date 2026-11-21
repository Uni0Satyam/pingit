"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquareText,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConversationSummary {
  id: string;
  chatbotId: string;
  chatbotName: string;
  visitorId: string;
  status: "open" | "closed";
  startedAt: string;
  lastMessageAt: string;
  lastMessage: string;
  lastMessageSentAt: string;
}

interface ConversationMessage {
  id: string;
  role: "visitor" | "assistant" | "system";
  content: string;
  sentAt: string;
}

interface ConversationResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export default function ConversationsTab() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadConversations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/conversations?limit=20", {
          signal: controller.signal,
        });
        const result: ConversationResponse<{
          conversations: ConversationSummary[];
        }> = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || "Could not load conversations.");
        }
        setConversations(result.data.conversations);
        setSelectedId((current) => {
          if (current && result.data?.conversations.some((item) => item.id === current)) {
            return current;
          }
          return result.data?.conversations[0]?.id ?? null;
        });
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load conversations.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadConversations();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();
    const loadMessages = async () => {
      setIsDetailLoading(true);
      setDetailError(null);
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(selectedId)}`,
          { signal: controller.signal },
        );
        const result: ConversationResponse<{
          messages: ConversationMessage[];
        }> = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || "Could not load this conversation.");
        }
        setMessages(result.data.messages);
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this conversation.",
        );
      } finally {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      }
    };

    void loadMessages();
    return () => controller.abort();
  }, [selectedId, refreshKey]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.chatbotName,
        conversation.visitorId,
        conversation.lastMessage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [conversations, search]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            Conversations
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Browse visitor chats and review their message history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={isLoading || isDetailLoading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw
            size={14}
            className={isLoading || isDetailLoading ? "animate-spin" : ""}
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            Retry
          </Button>
        </div>
      ) : (
        <section className="grid min-h-[560px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-zinc-200 md:border-r md:border-b-0">
            <div className="border-b border-zinc-100 p-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
                className="h-9 rounded-lg pl-3 text-sm"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4" role="status">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-[76px] animate-pulse rounded-xl bg-zinc-100"
                    />
                  ))}
                  <span className="sr-only">Loading conversations...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Search className="mx-auto size-5 text-zinc-400" />
                  <p className="mt-3 text-sm font-medium text-zinc-700">
                    {conversations.length === 0
                      ? "No conversations yet"
                      : "No matching conversations"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {conversations.length === 0
                      ? "Visitor chats will appear here after someone messages your chatbot."
                      : "Try searching for a different visitor, chatbot, or message."}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    aria-current={selectedId === conversation.id ? "true" : undefined}
                    className={`w-full border-b border-zinc-100 px-4 py-4 text-left transition hover:bg-zinc-50 ${
                      selectedId === conversation.id
                        ? "bg-blue-50/70 hover:bg-blue-50"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <UserRound size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-900">
                            Visitor {conversation.visitorId.slice(0, 8)}
                          </span>
                          <span className="shrink-0 text-[10px] text-zinc-400">
                            {formatRelativeTime(conversation.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {conversation.chatbotName}
                        </span>
                        <span className="mt-1.5 block truncate text-xs text-zinc-500">
                          {conversation.lastMessage || "No messages"}
                        </span>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {!isLoading && conversations.length > 0 && (
              <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-400">
                Showing {filteredConversations.length} of {conversations.length}
              </p>
            )}
          </aside>

          <div className="flex min-h-[440px] min-w-0 flex-col">
            {selectedConversation ? (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-900">
                      Visitor {selectedConversation.visitorId.slice(0, 8)}
                    </h3>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {selectedConversation.chatbotName} · Started{" "}
                      {new Date(selectedConversation.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${
                      selectedConversation.status === "open"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {selectedConversation.status}
                  </span>
                </header>
                <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/60 p-5">
                  {detailError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                      {detailError}
                    </div>
                  ) : isDetailLoading ? (
                    <p className="text-center text-sm text-zinc-500" role="status">
                      Loading messages...
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="py-12 text-center text-sm text-zinc-500">
                      This conversation has no saved messages.
                    </p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === "visitor"
                            ? "justify-end"
                            : message.role === "system"
                              ? "justify-center"
                              : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                            message.role === "visitor"
                              ? "rounded-br-md bg-blue-600 text-white"
                              : message.role === "system"
                                ? "bg-amber-50 text-amber-800"
                                : "rounded-bl-md border border-zinc-200 bg-white text-zinc-800"
                          }`}
                        >
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                            {message.role}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {message.content}
                          </p>
                          <time
                            dateTime={message.sentAt}
                            className="mt-2 block text-right text-[10px] opacity-60"
                          >
                            {new Date(message.sentAt).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    ))
                  )}
                  {detailError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRefreshKey((current) => current + 1)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
                <footer className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
                  <MessageSquareText size={14} />
                  {messages.length} {messages.length === 1 ? "message" : "messages"} loaded
                  {messages.length >= 500 && " · showing the latest 500"}
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <MessageSquareText className="size-8 text-zinc-300" />
                <p className="mt-3 text-sm font-medium text-zinc-700">
                  Select a conversation
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose a visitor chat to view its message history.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}
