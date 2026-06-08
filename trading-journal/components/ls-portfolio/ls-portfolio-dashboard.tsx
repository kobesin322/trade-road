"use client";

import { format, parseISO } from "date-fns";
import {
  ArrowDownUp,
  BarChart3,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AddPositionModal,
  RebalanceModal,
  TakeProfitModal,
} from "@/components/ls-portfolio/ls-portfolio-modals";
import { BetaReferenceModal } from "@/components/ls-portfolio/beta-reference-modal";
import { PortfolioDayConditionPanel } from "@/components/ls-portfolio/portfolio-day-condition-panel";
import { PortfolioWeightedBetaPanel } from "@/components/ls-portfolio/portfolio-weighted-beta-panel";
import {
  formatOverviewDayLabel,
  OverviewDatePicker,
} from "@/components/journal/overview-date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal, Toast } from "@/components/ui/modal";
import {
  computeAllPositions,
  computePools,
  formatCurrency,
  formatEventSummary,
  formatPercent,
} from "@/lib/ls-portfolio";
import type { ComputedPosition, PortfolioDayCondition, PortfolioSnapshot, PositionSide } from "@/lib/ls-portfolio-types";
import type { BetaReferenceSummary } from "@/lib/ls-portfolio-beta-reference";
import { dayConditionHasContent, portfolioToDayCondition } from "@/lib/portfolio-day-condition";
import { cn } from "@/lib/utils";

type SideFilter = "all" | PositionSide;
type PortfolioTab = "book" | "condition";

const PORTFOLIO_TABS: { id: PortfolioTab; label: string }[] = [
  { id: "book", label: "L/S Book" },
  { id: "condition", label: "Day condition" },
];

type LSPortfolioDashboardProps = {
  selectedDate: string;
  onDateChange: (date: string) => void;
  canUsePersonalJournal: boolean;
  onSnapshotDatesChange?: (dates: string[]) => void;
};

async function fetchSnapshot(date: string) {
  const res = await fetch(`/api/ls-portfolio?date=${encodeURIComponent(date)}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Unable to load snapshot.");
  }
  return data as PortfolioSnapshot;
}

async function fetchBetaSummary(date: string) {
  const res = await fetch(`/api/ls-portfolio/beta-reference?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as BetaReferenceSummary;
}

export function LSPortfolioDashboard({
  selectedDate,
  onDateChange,
  canUsePersonalJournal,
  onSnapshotDatesChange,
}: LSPortfolioDashboardProps) {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null,
  );
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [takeProfitPos, setTakeProfitPos] = useState<ComputedPosition | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashPool, setCashPool] = useState<"long" | "short">("long");
  const [cashAmount, setCashAmount] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const [betaRefOpen, setBetaRefOpen] = useState(false);
  const [betaSummary, setBetaSummary] = useState<BetaReferenceSummary | null>(null);
  const [betaLoading, setBetaLoading] = useState(false);
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("book");
  const [conditionSaving, setConditionSaving] = useState(false);

  const showToast = useCallback((message: string, tone: "success" | "error" | "info" = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const loadBetaSummary = useCallback(async (date: string) => {
    setBetaLoading(true);
    try {
      setBetaSummary(await fetchBetaSummary(date));
    } catch {
      setBetaSummary(null);
    } finally {
      setBetaLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot(selectedDate);
      setSnapshot(data);
      onSnapshotDatesChange?.(data.snapshot_dates);
      void loadBetaSummary(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, onSnapshotDatesChange, loadBetaSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pools = useMemo(
    () => (snapshot ? computePools(snapshot.positions, snapshot.portfolio) : null),
    [snapshot],
  );

  const computed = useMemo(
    () => (snapshot ? computeAllPositions(snapshot.positions, snapshot.portfolio) : []),
    [snapshot],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return computed.filter((p) => {
      if (sideFilter !== "all" && p.side !== sideFilter) {
        return false;
      }
      if (q && !p.symbol.includes(q)) {
        return false;
      }
      return true;
    });
  }, [computed, search, sideFilter]);

  async function mutate(url: string, init?: RequestInit, successMsg?: string) {
    setActionLoading(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Request failed.");
      }
      setSnapshot(data);
      onSnapshotDatesChange?.(data.snapshot_dates);
      if (successMsg) {
        showToast(successMsg, "success");
      }
      void loadBetaSummary(selectedDate);
      return data as PortfolioSnapshot;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Request failed.", "error");
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  function withDate(body: Record<string, unknown> = {}) {
    return JSON.stringify({ ...body, date: selectedDate });
  }

  async function updateTargetRatio(longRatio: number) {
    await mutate(
      "/api/ls-portfolio",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: withDate({ target_long_ratio: longRatio }),
      },
      "Target ratio updated for this day.",
    );
  }

  async function saveDayCondition(patch: Partial<PortfolioDayCondition>) {
    setConditionSaving(true);
    try {
      await mutate("/api/ls-portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: withDate(patch),
      });
    } finally {
      setConditionSaving(false);
    }
  }

  async function updatePositionField(
    position: ComputedPosition,
    field: "quantity" | "current_price" | "avg_entry_price" | "stop_loss_price",
    raw: string,
  ) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    if ((field === "avg_entry_price" || field === "current_price") && value <= 0) {
      return;
    }

    setSavingId(position.id);
    const prev = snapshot;
    if (prev) {
      setSnapshot({
        ...prev,
        positions: prev.positions.map((p) =>
          p.id === position.id ? { ...p, [field]: value } : p,
        ),
      });
    }

    try {
      await mutate(
        `/api/ls-portfolio/positions/${position.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: withDate({ [field]: value }),
        },
      );
    } catch {
      if (prev) {
        setSnapshot(prev);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function deletePosition(position: ComputedPosition) {
    if (!window.confirm(`Delete ${position.symbol} from portfolio?`)) {
      return;
    }
    await mutate(
      `/api/ls-portfolio/positions/${position.id}?date=${encodeURIComponent(selectedDate)}`,
      { method: "DELETE" },
      "Position removed.",
    );
  }

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-64 items-center justify-center text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <Card className="border-rose-400/30 bg-rose-500/10">
        <CardContent className="grid gap-3 pt-6">
          <p className="text-rose-100">{error}</p>
          {!canUsePersonalJournal ? (
            <p className="text-sm text-zinc-400">Sign in with Supabase to use daily portfolio snapshots.</p>
          ) : null}
          <Button type="button" onClick={() => void refresh()} className="w-fit bg-white/10">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot || !pools) {
    return null;
  }

  const driftWarn = Math.abs(pools.drift) > 0.05;
  const allocationData = [
    { name: "Long MV", value: pools.long_mv, fill: "#10b981" },
    { name: "Short MV", value: pools.short_mv, fill: "#f43f5e" },
    { name: "Long Cash", value: snapshot.portfolio.long_cash, fill: "#6ee7b7" },
    { name: "Short Cash", value: snapshot.portfolio.short_cash, fill: "#fda4af" },
  ].filter((d) => d.value > 0);

  const ratioComparisonData = [
    {
      side: "Long",
      target: snapshot.portfolio.target_long_ratio * 100,
      actual: pools.current_long_pct * 100,
    },
    {
      side: "Short",
      target: snapshot.portfolio.target_short_ratio * 100,
      actual: (1 - pools.current_long_pct) * 100,
    },
  ];

  const poolComparisonData = [
    {
      side: "Long",
      target: pools.total_pool * snapshot.portfolio.target_long_ratio,
      actual: pools.long_pool,
    },
    {
      side: "Short",
      target: pools.total_pool * snapshot.portfolio.target_short_ratio,
      actual: pools.short_pool,
    },
  ];

  const dayCondition = portfolioToDayCondition(snapshot.portfolio);
  const hasDayCondition = dayConditionHasContent(dayCondition);

  return (
    <div className="grid gap-6">
      <Toast message={toast?.message ?? null} tone={toast?.tone} />

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_1fr]">
        <OverviewDatePicker
          selectedDate={selectedDate}
          onSelectDate={onDateChange}
          snapshotDates={snapshot.snapshot_dates}
        />
        <Card className="overflow-hidden border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-transparent to-emerald-500/5">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Scale className="h-5 w-5 text-amber-300" />
                  <CardTitle className="text-xl">Daily L/S Snapshot</CardTitle>
                  <Badge tone="neutral">{snapshot.positions.length} positions</Badge>
                </div>
                <p className="mt-2 text-2xl font-black text-white">{formatOverviewDayLabel(selectedDate)}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  End-of-day book for review — target ratio varies by market regime.
                </p>
              </div>
              <TargetRatioEditor
                longRatio={snapshot.portfolio.target_long_ratio}
                disabled={!canUsePersonalJournal || actionLoading}
                onChange={(longRatio) => void updateTargetRatio(longRatio)}
              />
            </div>
          </CardHeader>
        </Card>
      </div>

      <nav className="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-white/10 bg-black/30 p-2">
        {PORTFOLIO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPortfolioTab(tab.id)}
            className={cn(
              "relative rounded-xl px-3 py-3 text-sm font-bold transition",
              portfolioTab === tab.id
                ? tab.id === "condition"
                  ? "bg-rose-400/20 text-rose-50 shadow-[0_0_18px_rgba(251,113,133,0.2)]"
                  : "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                : "text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            {tab.label}
            {tab.id === "condition" && hasDayCondition ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400" />
            ) : null}
          </button>
        ))}
      </nav>

      {portfolioTab === "condition" ? (
        <PortfolioDayConditionPanel
          portfolio={snapshot.portfolio}
          selectedDate={selectedDate}
          disabled={!canUsePersonalJournal}
          saving={conditionSaving}
          onSave={saveDayCondition}
        />
      ) : (
        <>
      <Card className="overflow-hidden border-emerald-400/20">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-zinc-400">
              Saved {format(parseISO(snapshot.portfolio.updated_at), "MMM d · h:mm a")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => showToast("Coming soon — edit current price inline.", "info")}
                className="bg-white/5 text-zinc-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh prices
              </Button>
              <Button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  void mutate(
                    "/api/ls-portfolio/copy-previous",
                    { method: "POST", headers: { "Content-Type": "application/json" }, body: withDate() },
                    "Copied from previous day.",
                  )
                }
                className="bg-white/5 text-zinc-200"
              >
                Copy prior day
              </Button>
              <Button
                type="button"
                onClick={() => setBetaRefOpen(true)}
                className="bg-violet-400/15 text-violet-100"
              >
                <BarChart3 className="h-4 w-4" />
                Beta reference
              </Button>
              <Button type="button" onClick={() => setRebalanceOpen(true)} className="bg-cyan-300/15 text-cyan-100">
                <ArrowDownUp className="h-4 w-4" />
                Rebalance
              </Button>
              <Button
                type="button"
                onClick={() => setAddOpen(true)}
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              >
                <Plus className="h-4 w-4" />
                Add position
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Long pool"
          value={formatCurrency(pools.long_pool)}
          sub={`${formatPercent(pools.current_long_pct * 100, 1)} of total`}
          tone="long"
        />
        <KpiCard
          label="Short pool"
          value={formatCurrency(pools.short_pool)}
          sub={`${formatPercent((1 - pools.current_long_pct) * 100, 1)} of total`}
          tone="short"
        />
        <KpiCard
          label="Unrealized P&L"
          value={formatCurrency(pools.total_unrealized_pnl)}
          sub={`Gross ${formatCurrency(pools.gross_exposure, true)}`}
          tone={pools.total_unrealized_pnl >= 0 ? "long" : "short"}
        />
        <KpiCard
          label="Net exposure"
          value={formatCurrency(pools.net_exposure)}
          sub={`Cash L ${formatCurrency(snapshot.portfolio.long_cash, true)} · S ${formatCurrency(snapshot.portfolio.short_cash, true)}`}
          tone="neutral"
        />
      </div>

      <PortfolioWeightedBetaPanel
        summary={betaSummary}
        loading={betaLoading}
        onOpenReference={() => setBetaRefOpen(true)}
      />

      {/* Ratio bar + drift */}
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-zinc-300">Long / Short ratio</span>
            {driftWarn ? (
              <Badge tone="loss">Drift {formatPercent(pools.drift * 100, 1)} — consider rebalance</Badge>
            ) : (
              <Badge tone="win">On target</Badge>
            )}
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${pools.current_long_pct * 100}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              style={{ left: `${pools.target_long_pct * 100}%` }}
              title="Target"
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-zinc-500">
            <span>Long {formatPercent(pools.current_long_pct * 100, 1)}</span>
            <span>Target {formatPercent(pools.target_long_pct * 100, 0)}</span>
            <span>Short {formatPercent((1 - pools.current_long_pct) * 100, 1)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Positions table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Positions</CardTitle>
              <div className="flex flex-wrap gap-2">
                {(["all", "long", "short"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSideFilter(filter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]",
                      sideFilter === filter
                        ? filter === "long"
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                          : filter === "short"
                            ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
                            : "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 text-zinc-500",
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <label className="relative mt-2 block max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol…"
                className="pl-9 font-mono"
              />
            </label>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <EmptyState
                onSeed={() =>
                  void mutate(
                    "/api/ls-portfolio/seed",
                    { method: "POST", headers: { "Content-Type": "application/json" }, body: withDate() },
                    "Demo snapshot seeded.",
                  )
                }
                loading={actionLoading}
              />
            ) : (
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Entry</th>
                    <th className="px-2 py-2">Current</th>
                    <th className="px-2 py-2">MV</th>
                    <th className="px-2 py-2">P&L</th>
                    <th className="px-2 py-2">% Pool</th>
                    <th className="px-2 py-2">Stop</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((position) => (
                    <tr key={position.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black",
                            position.side === "long"
                              ? "border-emerald-400/40 text-emerald-200"
                              : "border-rose-400/40 text-rose-200",
                          )}
                        >
                          {position.side === "long" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {position.symbol}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <InlineNum
                          value={position.quantity}
                          saving={savingId === position.id}
                          onSave={(v) => void updatePositionField(position, "quantity", v)}
                        />
                      </td>
                      <td className="px-2 py-3 font-mono tabular-nums text-zinc-400">
                        {formatCurrency(position.avg_entry_price)}
                      </td>
                      <td className="px-2 py-3">
                        <InlineNum
                          value={position.current_price}
                          saving={savingId === position.id}
                          onSave={(v) => void updatePositionField(position, "current_price", v)}
                        />
                      </td>
                      <td className="px-2 py-3 font-mono tabular-nums">{formatCurrency(position.market_value)}</td>
                      <td
                        className={cn(
                          "px-2 py-3 font-mono font-bold tabular-nums",
                          position.unrealized_pnl >= 0 ? "text-emerald-300" : "text-rose-300",
                        )}
                      >
                        {formatCurrency(position.unrealized_pnl)}
                        <div className="text-[10px] font-normal opacity-70">
                          {formatPercent(position.pnl_percent)}
                        </div>
                      </td>
                      <td className="px-2 py-3 font-mono text-zinc-400">
                        {formatPercent(position.percent_of_pool, 1)}
                      </td>
                      <td className="px-2 py-3">
                        <InlineNum
                          value={position.stop_loss_price ?? ""}
                          saving={savingId === position.id}
                          placeholder="—"
                          onSave={(v) => void updatePositionField(position, "stop_loss_price", v || "0")}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            onClick={() => setTakeProfitPos(position)}
                            className="h-8 px-2 text-xs bg-emerald-500/15 text-emerald-100"
                          >
                            Profit
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void deletePosition(position)}
                            className="h-8 px-2 text-xs bg-white/5 text-zinc-400"
                          >
                            Del
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Allocation chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {allocationData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-zinc-400">
              {allocationData.map((d) => (
                <div key={d.name} className="flex justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                    {d.name}
                  </span>
                  <span className="font-mono">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 border-t border-white/10 pt-6">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Target vs actual (%)
                </p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratioComparisonData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="side" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(value) => `${Number(value ?? 0).toFixed(1)}%`}
                        contentStyle={{
                          background: "#09090b",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                      <Bar dataKey="target" name="Target" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Pool size ($)
                </p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={poolComparisonData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="side" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
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
                      <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                      <Bar dataKey="target" name="Target" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="actual" name="Actual" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                  Allocation breakdown ($)
                </p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={allocationData} layout="vertical" barCategoryGap="16%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCurrency(Number(v), true)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#a1a1aa", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                        contentStyle={{
                          background: "#09090b",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                        {allocationData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setCashOpen(true)}
              className="mt-4 w-full bg-white/5 text-zinc-200"
            >
              Adjust cash
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Event log */}
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setShowEvents((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="text-base">Activity log</CardTitle>
            <span className="text-xs text-zinc-500">{showEvents ? "Hide" : "Show"}</span>
          </button>
        </CardHeader>
        {showEvents ? (
          <CardContent className="grid gap-2">
            {snapshot.events.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              snapshot.events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-zinc-200">{formatEventSummary(event)}</span>
                  <span className="text-xs font-mono text-zinc-500">
                    {format(parseISO(event.created_at), "MMM d · h:mm a")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        ) : null}
      </Card>
        </>
      )}

      <BetaReferenceModal
        open={betaRefOpen}
        onClose={() => setBetaRefOpen(false)}
        snapshotDate={selectedDate}
        summary={betaSummary}
      />

      <TakeProfitModal
        open={Boolean(takeProfitPos)}
        position={takeProfitPos}
        snapshot={snapshot}
        onClose={() => setTakeProfitPos(null)}
        loading={actionLoading}
        onConfirm={async (payload) => {
          await mutate(
            "/api/ls-portfolio/take-profit",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: withDate(payload),
            },
            `Took profit on ${takeProfitPos?.symbol}.`,
          );
          setTakeProfitPos(null);
        }}
      />

      <AddPositionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={actionLoading}
        onSubmit={async (payload) => {
          await mutate(
            "/api/ls-portfolio/positions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: withDate(payload),
            },
            `${payload.symbol} added.`,
          );
          setAddOpen(false);
        }}
      />

      <RebalanceModal
        open={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        snapshot={snapshot}
        loading={actionLoading}
        onConfirm={async () => {
          await mutate(
            "/api/ls-portfolio/rebalance",
            { method: "POST", headers: { "Content-Type": "application/json" }, body: withDate() },
            "Pools rebalanced.",
          );
          setRebalanceOpen(false);
        }}
      />

      <Modal open={cashOpen} onClose={() => setCashOpen(false)} title="Adjust cash">
        <div className="grid gap-4">
          <div className="flex gap-2">
            {(["long", "short"] as const).map((pool) => (
              <button
                key={pool}
                type="button"
                onClick={() => setCashPool(pool)}
                className={cn(
                  "flex-1 rounded-2xl border py-2 text-sm font-bold capitalize",
                  cashPool === pool ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/10 text-zinc-500",
                )}
              >
                {pool} cash
              </button>
            ))}
          </div>
          <Field label="Amount (+ deposit / − withdraw)" value={cashAmount} onChange={setCashAmount} type="number" />
          <Button
            type="button"
            disabled={actionLoading}
            onClick={() =>
              void mutate(
                "/api/ls-portfolio/cash",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: withDate({ pool: cashPool, amount: Number(cashAmount) }),
                },
                "Cash updated.",
              ).then(() => setCashOpen(false))
            }
            className="bg-cyan-300 text-slate-950"
          >
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "long" | "short" | "neutral";
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
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-black tabular-nums text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function InlineNum({
  value,
  onSave,
  saving,
  placeholder,
}: {
  value: number | string;
  onSave: (v: string) => void;
  saving?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <input
      type="number"
      step="any"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== String(value)) {
          onSave(local);
        }
      }}
      className={cn(
        "w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 font-mono text-xs tabular-nums text-white",
        saving && "opacity-50",
      )}
    />
  );
}

function TargetRatioEditor({
  longRatio,
  disabled,
  onChange,
}: {
  longRatio: number;
  disabled?: boolean;
  onChange: (longRatio: number) => void;
}) {
  const longPct = Math.round(longRatio * 100);
  const shortPct = 100 - longPct;
  const [longText, setLongText] = useState(String(longPct));
  const [shortText, setShortText] = useState(String(shortPct));

  useEffect(() => {
    setLongText(String(Math.round(longRatio * 100)));
    setShortText(String(Math.round((1 - longRatio) * 100)));
  }, [longRatio]);

  function clampPct(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  function applyLongPct(pct: number) {
    onChange(clampPct(pct) / 100);
  }

  function applyShortPct(pct: number) {
    onChange(clampPct(100 - pct) / 100);
  }

  function commitLongText() {
    const parsed = Number(longText.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(parsed)) {
      setLongText(String(longPct));
      return;
    }
    applyLongPct(parsed);
  }

  function commitShortText() {
    const parsed = Number(shortText.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(parsed)) {
      setShortText(String(shortPct));
      return;
    }
    applyShortPct(parsed);
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <span className="text-sm font-semibold text-zinc-300">Target Long / Short</span>
      {(
        [
          {
            label: "Long",
            text: longText,
            setText: setLongText,
            onDec: () => applyLongPct(longPct - 5),
            onInc: () => applyLongPct(longPct + 5),
            onCommit: commitLongText,
            tone: "text-emerald-200",
          },
          {
            label: "Short",
            text: shortText,
            setText: setShortText,
            onDec: () => applyShortPct(shortPct - 5),
            onInc: () => applyShortPct(shortPct + 5),
            onCommit: commitShortText,
            tone: "text-rose-200",
          },
        ] as const
      ).map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className={cn("w-12 text-sm font-bold", row.tone)}>{row.label}</span>
          <Button
            type="button"
            disabled={disabled}
            onClick={row.onDec}
            className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200 hover:bg-white/10"
            aria-label={`Decrease ${row.label.toLowerCase()} target`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="relative flex-1">
            <Input
              value={row.text}
              disabled={disabled}
              inputMode="numeric"
              onChange={(e) => row.setText(e.target.value)}
              onBlur={row.onCommit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  row.onCommit();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="pr-7 text-center font-mono font-bold tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              %
            </span>
          </div>
          <Button
            type="button"
            disabled={disabled}
            onClick={row.onInc}
            className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200 hover:bg-white/10"
            aria-label={`Increase ${row.label.toLowerCase()} target`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onSeed, loading }: { onSeed: () => void; loading: boolean }) {
  return (
    <div className="grid gap-4 py-12 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-cyan-300" />
      <div>
        <p className="text-lg font-black text-white">No positions yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Seed a demo book for this day — TSLA, COIN, SCCO, CRCL, IREN longs and SNDK, EWY shorts.
        </p>
      </div>
      <Button
        type="button"
        disabled={loading}
        onClick={onSeed}
        className="mx-auto bg-cyan-300 text-slate-950 hover:bg-cyan-200"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Seed demo data
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-zinc-300">
      {label}
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="bg-zinc-900 font-mono" />
    </label>
  );
}
