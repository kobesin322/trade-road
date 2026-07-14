"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/ls-portfolio";
import { bookSliceLabel, rsTone } from "@/lib/ls-portfolio-summary";
import type { BookAttribution, PortfolioSummary } from "@/lib/ls-portfolio-types";
import { BOOK_TYPE_LABELS } from "@/lib/ls-portfolio-types";
import { cn } from "@/lib/utils";

type PortfolioSummaryPanelProps = {
  selectedDate: string;
  onRefreshToken?: number;
};

async function fetchSummary(date: string) {
  const res = await fetch(`/api/ls-portfolio/summary?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Unable to load portfolio summary.");
  }
  return data as PortfolioSummary;
}

export function PortfolioSummaryPanel({ selectedDate, onRefreshToken }: PortfolioSummaryPanelProps) {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchSummary(selectedDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary load failed.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load, onRefreshToken]);

  if (loading && !summary) {
    return (
      <div className="flex min-h-64 items-center justify-center text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Card className="border-rose-400/30 bg-rose-500/10">
        <CardContent className="pt-6 text-rose-100">{error}</CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const { pools, attribution, risk, relative_strength } = summary;
  const attributionChart = buildAttributionChartData(attribution);
  const pnlChart = buildPnlChartData(attribution);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryKpi
          label="Long book P&L"
          value={formatCurrency(attribution.long_total.unrealized_pnl)}
          sub={`MV ${formatCurrency(attribution.long_total.market_value, true)} · ${attribution.long_total.position_count} pos`}
          tone={attribution.long_total.unrealized_pnl >= 0 ? "long" : "short"}
          icon={TrendingUp}
        />
        <SummaryKpi
          label="Short book P&L"
          value={formatCurrency(attribution.short_total.unrealized_pnl)}
          sub={`MV ${formatCurrency(attribution.short_total.market_value, true)} · ${attribution.short_total.position_count} pos`}
          tone={attribution.short_total.unrealized_pnl >= 0 ? "long" : "short"}
          icon={TrendingDown}
        />
        <SummaryKpi
          label="Total risk (stops)"
          value={formatCurrency(risk.total_risk_dollars)}
          sub={
            risk.avg_risk_per_trade !== null
              ? `Avg ${formatCurrency(risk.avg_risk_per_trade, true)}/trade · ${formatPercent(risk.risk_pct_of_total_pool, 1)} of pool`
              : `${risk.positions_without_stop} without stops`
          }
          tone="neutral"
          icon={Shield}
        />
        <SummaryKpi
          label="Net unrealized P&L"
          value={formatCurrency(pools.total_unrealized_pnl)}
          sub={`Gross ${formatCurrency(pools.gross_exposure, true)} · Net ${formatCurrency(pools.net_exposure, true)}`}
          tone={pools.total_unrealized_pnl >= 0 ? "long" : "short"}
          icon={Activity}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Core vs Tactical allocation</CardTitle>
            <p className="text-sm text-zinc-400">Market value by book and side</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attributionChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="market_value" name="Market value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {attributionChart.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">P&L attribution</CardTitle>
            <p className="text-sm text-zinc-400">Unrealized P&L by book and side</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(Number(v), true)}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="unrealized_pnl" name="Unrealized P&L" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {pnlChart.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-300" />
              <CardTitle className="text-base">Book breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(
              [
                ["core_long", "core", "long", "#34d399"],
                ["core_short", "core", "short", "#fb7185"],
                ["tactical_long", "tactical", "long", "#6ee7b7"],
                ["tactical_short", "tactical", "short", "#fda4af"],
              ] as const
            ).map(([key, book, side, color]) => {
              const slice = attribution[key];
              return (
                <BookRow
                  key={key}
                  label={bookSliceLabel(book, side)}
                  color={color}
                  slice={slice}
                />
              );
            })}
            <div className="mt-2 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
              <BookTotal label="Core total" slice={attribution.core_total} tone="core" />
              <BookTotal label="Tactical total" slice={attribution.tactical_total} tone="tactical" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-300" />
              <CardTitle className="text-base">Risk per trade</CardTitle>
            </div>
            <p className="text-sm text-zinc-400">
              Dollar risk from entry to stop · {risk.positions_with_stop} of {summary.positions.length} with stops
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {risk.max_risk_position ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                  Largest risk
                </div>
                <div className="mt-1 font-mono text-lg font-black text-white">
                  {risk.max_risk_position.symbol}{" "}
                  <span className="text-sm font-normal text-zinc-400">
                    ({risk.max_risk_position.side})
                  </span>
                </div>
                <div className="mt-1 font-mono text-rose-200">
                  {formatCurrency(risk.max_risk_position.risk_dollars)}
                </div>
              </div>
            ) : null}

            {summary.positions.length === 0 ? (
              <p className="text-sm text-zinc-500">Add positions with stop losses to see risk metrics.</p>
            ) : (
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                {[...summary.positions]
                  .sort((a, b) => (b.risk_dollars ?? 0) - (a.risk_dollars ?? 0))
                  .map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{position.symbol}</span>
                        <Badge tone={position.book_type === "core" ? "win" : "neutral"}>
                          {BOOK_TYPE_LABELS[position.book_type]}
                        </Badge>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        {position.risk_dollars !== null ? (
                          <>
                            <div className="text-rose-200">{formatCurrency(position.risk_dollars)}</div>
                            {position.risk_pct_of_pool !== null ? (
                              <div className="text-[10px] text-zinc-500">
                                {formatPercent(position.risk_pct_of_pool, 1)} of pool
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-zinc-500">No stop</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Relative strength vs QQQ</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">
                {relative_strength
                  ? `${relative_strength.range} trailing return spread · QQQ ${formatPercent(relative_strength.benchmark_return_pct)}`
                  : "Benchmark data unavailable"}
              </p>
            </div>
            {relative_strength ? <Badge tone="neutral">RS spread</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {!relative_strength || relative_strength.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Add positions to compare performance vs QQQ.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Book</th>
                    <th className="px-2 py-2">Return</th>
                    <th className="px-2 py-2">QQQ</th>
                    <th className="px-2 py-2">RS spread</th>
                  </tr>
                </thead>
                <tbody>
                  {relative_strength.rows.map((row) => {
                    const tone = rsTone(row.rs_spread);
                    return (
                      <tr key={row.position_id} className="border-b border-white/5">
                        <td className="px-2 py-3 font-mono font-bold">{row.symbol}</td>
                        <td className="px-2 py-3">
                          <Badge tone={row.book_type === "core" ? "win" : "neutral"}>
                            {BOOK_TYPE_LABELS[row.book_type]}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 font-mono tabular-nums">
                          {formatPercent(row.position_return_pct)}
                        </td>
                        <td className="px-2 py-3 font-mono tabular-nums text-zinc-400">
                          {formatPercent(row.benchmark_return_pct)}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-mono font-bold tabular-nums",
                              tone === "outperform" && "text-emerald-300",
                              tone === "underperform" && "text-rose-300",
                              tone === "neutral" && "text-zinc-300",
                            )}
                          >
                            {row.rs_spread >= 0 ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {formatPercent(row.rs_spread)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildAttributionChartData(attribution: BookAttribution) {
  return [
    { key: "core_long", label: "Core L", market_value: attribution.core_long.market_value, fill: "#34d399" },
    { key: "core_short", label: "Core S", market_value: attribution.core_short.market_value, fill: "#fb7185" },
    {
      key: "tactical_long",
      label: "Tac L",
      market_value: attribution.tactical_long.market_value,
      fill: "#6ee7b7",
    },
    {
      key: "tactical_short",
      label: "Tac S",
      market_value: attribution.tactical_short.market_value,
      fill: "#fda4af",
    },
  ];
}

function buildPnlChartData(attribution: BookAttribution) {
  return [
    {
      key: "core_long",
      label: "Core L",
      unrealized_pnl: attribution.core_long.unrealized_pnl,
      fill: attribution.core_long.unrealized_pnl >= 0 ? "#34d399" : "#f87171",
    },
    {
      key: "core_short",
      label: "Core S",
      unrealized_pnl: attribution.core_short.unrealized_pnl,
      fill: attribution.core_short.unrealized_pnl >= 0 ? "#34d399" : "#f87171",
    },
    {
      key: "tactical_long",
      label: "Tac L",
      unrealized_pnl: attribution.tactical_long.unrealized_pnl,
      fill: attribution.tactical_long.unrealized_pnl >= 0 ? "#6ee7b7" : "#fb7185",
    },
    {
      key: "tactical_short",
      label: "Tac S",
      unrealized_pnl: attribution.tactical_short.unrealized_pnl,
      fill: attribution.tactical_short.unrealized_pnl >= 0 ? "#6ee7b7" : "#fb7185",
    },
  ];
}

function SummaryKpi({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "long" | "short" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        tone === "long" && "border-emerald-400/20 bg-emerald-500/5",
        tone === "short" && "border-rose-400/20 bg-rose-500/5",
        tone === "neutral" && "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="mt-1 font-mono text-xl font-black tabular-nums text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function BookRow({
  label,
  color,
  slice,
}: {
  label: string;
  color: string;
  slice: BookAttribution["core_long"];
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <span className="text-xs text-zinc-500">{slice.position_count} pos</span>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-bold tabular-nums text-white">
          {formatCurrency(slice.market_value, true)}
        </div>
        <div
          className={cn(
            "font-mono text-xs tabular-nums",
            slice.unrealized_pnl >= 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {formatCurrency(slice.unrealized_pnl)}
        </div>
      </div>
    </div>
  );
}

function BookTotal({
  label,
  slice,
  tone,
}: {
  label: string;
  slice: BookAttribution["core_total"];
  tone: "core" | "tactical";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "core" ? "border-emerald-400/20 bg-emerald-500/5" : "border-cyan-400/20 bg-cyan-500/5",
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-white">{formatCurrency(slice.market_value, true)}</div>
      <div
        className={cn(
          "font-mono text-sm",
          slice.unrealized_pnl >= 0 ? "text-emerald-300" : "text-rose-300",
        )}
      >
        P&L {formatCurrency(slice.unrealized_pnl)}
      </div>
    </div>
  );
}
