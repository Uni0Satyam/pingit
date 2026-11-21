"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Coins,
  MessageSquareText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalyticsTabProps {
  totalCount: number;
  activeCount: number;
  draftCount: number;
}

interface UsageSummary {
  totalRecords: number;
  totalCredits: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  costCurrency: string | null;
}

interface UsageRecord {
  id: string;
  chatbotId: string;
  chatbotName: string;
  units: number;
  unitType: "request" | "token";
  creditsCharged: number;
  occurredAt: string;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costAmount: number | null;
  costCurrency: string | null;
}

interface UsageDay {
  date: string;
  requests: number;
  credits: number;
  tokens: number;
}

interface UsageResponse {
  success: boolean;
  message: string;
  data?: {
    summary: UsageSummary;
    records: UsageRecord[];
    dailyTrend: UsageDay[];
  };
}

type UsageMetricKey = "credits" | "requests" | "tokens";

const EMPTY_SUMMARY: UsageSummary = {
  totalRecords: 0,
  totalCredits: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalCost: 0,
  costCurrency: null,
};

const CHART_METRICS: { key: UsageMetricKey; label: string }[] = [
  { key: "credits", label: "Credits" },
  { key: "requests", label: "Requests" },
  { key: "tokens", label: "Tokens" },
];

export default function AnalyticsTab({
  totalCount,
  activeCount,
  draftCount,
}: AnalyticsTabProps) {
  const [usage, setUsage] = useState<UsageSummary>(EMPTY_SUMMARY);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [dailyTrend, setDailyTrend] = useState<UsageDay[]>([]);
  const [selectedMetric, setSelectedMetric] =
    useState<UsageMetricKey>("credits");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadUsage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/usage-record?limit=20", {
          signal: controller.signal,
        });
        const result: UsageResponse = await response.json();
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || "Could not load usage records.");
        }

        setUsage(result.data.summary);
        setRecords(result.data.records);
        setDailyTrend(result.data.dailyTrend);
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load usage records.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void loadUsage();
    return () => controller.abort();
  }, [refreshKey]);

  const periodTotals = useMemo(
    () =>
      dailyTrend.reduce(
        (totals, day) => ({
          credits: totals.credits + day.credits,
          requests: totals.requests + day.requests,
          tokens: totals.tokens + day.tokens,
        }),
        { credits: 0, requests: 0, tokens: 0 },
      ),
    [dailyTrend],
  );
  const hasTrendData = dailyTrend.some(
    (day) => day.credits > 0 || day.requests > 0 || day.tokens > 0,
  );
  const refreshUsage = () => setRefreshKey((current) => current + 1);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">Analytics</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
              Understand your chatbot activity
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Each request shows input/output tokens and credits charged.
              Estimated service cost uses configured model and infrastructure
              rates; it is separate from your credit price.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
              Last 14 days
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshUsage}
              disabled={isLoading}
              className="gap-1.5 text-xs"
              aria-label="Refresh analytics"
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Usage summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Credits used"
          value={periodTotals.credits}
          detail="In the last 14 days"
          icon={Coins}
          accent="blue"
        />
        <SummaryCard
          label="Requests"
          value={periodTotals.requests}
          detail="In the last 14 days"
          icon={MessageSquareText}
          accent="violet"
        />
        <SummaryCard
          label="Tokens processed"
          value={periodTotals.tokens}
          detail="In the last 14 days"
          icon={Activity}
          accent="emerald"
        />
        <SummaryCard
          label="Chatbots"
          value={totalCount}
          detail={`${activeCount} active · ${draftCount} drafts`}
          icon={Bot}
          accent="amber"
        />
      </section>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refreshUsage}>
            Retry
          </Button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                Usage over time
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Daily activity for the last 14 days
              </p>
            </div>
            <div
              className="inline-flex rounded-lg bg-zinc-100 p-1"
              aria-label="Choose chart metric"
            >
              {CHART_METRICS.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  aria-pressed={selectedMetric === metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    selectedMetric === metric.key
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div
              className="m-5 h-64 animate-pulse rounded-xl bg-zinc-100 sm:m-6"
              role="status"
              aria-label="Loading analytics chart"
            />
          ) : hasTrendData ? (
            <UsageChart days={dailyTrend} metric={selectedMetric} />
          ) : (
            <div className="m-5 flex min-h-56 flex-col items-center justify-center rounded-xl bg-zinc-50 px-6 text-center sm:m-6">
              <Sparkles size={22} className="text-zinc-400" />
              <p className="mt-3 text-sm font-medium text-zinc-700">
                Your analytics will appear here
              </p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Once visitors start chatting with your bot, you&apos;ll see
                activity and usage trends for the past 14 days.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              Recent activity
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Latest chatbot requests across your account
            </p>
          </div>
          {usage.costCurrency && (
            <p className="text-xs text-zinc-500">
              Estimated service cost: {usage.totalCost.toFixed(4)}{" "}
              {usage.costCurrency}
            </p>
          )}
        </div>

        {isLoading ? (
          <p className="px-5 py-6 text-sm text-zinc-500" role="status">
            Loading recent activity...
          </p>
        ) : records.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Chat requests will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">Chatbot</th>
                  <th className="px-5 py-3 font-medium">Usage</th>
                  <th className="px-5 py-3 font-medium">Credits</th>
                  <th className="px-5 py-3 font-medium">Estimated cost</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((record) => (
                  <tr key={record.id} className="text-zinc-700">
                    <td className="px-5 py-3 font-medium">
                      {record.chatbotName}
                    </td>
                    <td className="px-5 py-3">
                      {record.units.toLocaleString()} {record.unitType}
                      {record.unitType === "token" &&
                        ` (${record.inputTokens.toLocaleString()} in / ${record.outputTokens.toLocaleString()} out)`}
                    </td>
                    <td className="px-5 py-3">
                      {record.creditsCharged.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      {record.costAmount === null
                        ? "—"
                        : `${record.costAmount.toFixed(4)} ${record.costCurrency || ""}`}
                    </td>
                    <td className="px-5 py-3">
                      {[record.provider, record.model]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {new Date(record.occurredAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-zinc-500">
              Showing {records.length} of {usage.totalRecords} requests.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
  accent: "blue" | "violet" | "emerald" | "amber";
}) {
  const accentStyles = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  }[accent];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
            {value.toLocaleString()}
          </p>
        </div>
        <span className={`rounded-xl p-2.5 ${accentStyles}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function UsageChart({
  days,
  metric,
}: {
  days: UsageDay[];
  metric: UsageMetricKey;
}) {
  const width = 900;
  const height = 280;
  const padding = { top: 20, right: 24, bottom: 38, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...days.map((day) => day[metric]));
  const yMax = Math.ceil(maxValue / 4) * 4;
  const points = days.map((day, index) => {
    const x = padding.left + (index / Math.max(1, days.length - 1)) * chartWidth;
    const y =
      padding.top + chartHeight - (day[metric] / yMax) * chartHeight;
    return { x, y, day };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;
  const ticks = [0, 1, 2, 3, 4];
  const metricLabel =
    CHART_METRICS.find((item) => item.key === metric)?.label ?? "Credits";

  return (
    <div className="px-3 py-5 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">
          {metricLabel} per day
        </p>
        <p className="text-xs text-zinc-400">UTC</p>
      </div>
      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Line chart showing daily ${metricLabel.toLowerCase()} over the last 14 days`}
          className="h-auto w-full"
        >
          <defs>
            <linearGradient id="analytics-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const fraction = tick / 4;
            const y = padding.top + chartHeight * (1 - fraction);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={padding.left + chartWidth}
                  y1={y}
                  y2={y}
                  stroke="#e4e4e7"
                  strokeDasharray={tick === 0 ? undefined : "3 5"}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-400 text-[10px]"
                >
                  {Math.round(yMax * fraction).toLocaleString()}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill="url(#analytics-chart-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map(({ x, y, day }, index) => (
            <g key={day.date}>
              <circle
                cx={x}
                cy={y}
                r="3.5"
                fill="#fff"
                stroke="#2563eb"
                strokeWidth="2"
              >
                <title>
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString()}:{" "}
                  {day[metric].toLocaleString()} {metricLabel.toLowerCase()}
                </title>
              </circle>
              {(index % 2 === 0 || index === points.length - 1) && (
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-zinc-400 text-[10px]"
                >
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", timeZone: "UTC" },
                  )}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
