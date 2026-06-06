"use client";

import { format, parseISO } from "date-fns";
import {
  ArrowDownUp,
  Loader2,
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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  AddPositionModal,
  RebalanceModal,
  TakeProfitModal,
} from "@/components/ls-portfolio/ls-portfolio-modals";
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
import type { ComputedPosition, PortfolioSnapshot, PositionSide } from "@/lib/ls-portfolio-types";
import { cn } from "@/lib/utils";

type SideFilter = "all" | PositionSide;

async function fetchSnapshot() {
  const res = await fetch("/api/ls-portfolio", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Unable to load portfolio.");
  }
  return data as PortfolioSnapshot;
}

export function LSPortfolioDashboard() {
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

  const showToast = useCallback((message: string, tone: "success" | "error" | "info" = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (successMsg) {
        showToast(successMsg, "success");
      }
      return data as PortfolioSnapshot;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Request failed.", "error");
      throw err;
    } finally {
      setActionLoading(false);
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
          body: JSON.stringify({ [field]: value }),
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
    await mutate(`/api/ls-portfolio/positions/${position.id}`, { method: "DELETE" }, "Position removed.");
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

  return (
    <div className="grid gap-6">
      <Toast message={toast?.message ?? null} tone={toast?.tone} />

      {/* Header */}
      <Card className="overflow-hidden border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-rose-500/10">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Scale className="h-5 w-5 text-cyan-300" />
                <CardTitle className="text-2xl">{snapshot.portfolio.name}</CardTitle>
                <Badge tone="neutral">
                  Target {formatPercent(snapshot.portfolio.target_long_ratio * 100, 0)} /{" "}
                  {formatPercent(snapshot.portfolio.target_short_ratio * 100, 0)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Updated {format(parseISO(snapshot.portfolio.updated_at), "MMM d, yyyy · h:mm a")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => showToast("Coming soon — edit current price inline for now.", "info")}
                className="bg-white/5 text-zinc-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh prices
              </Button>
              <Button
                type="button"
                onClick={() => setRebalanceOpen(true)}
                className="bg-cyan-300/15 text-cyan-100"
              >
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
              <EmptyState onSeed={() => void mutate("/api/ls-portfolio/seed", { method: "POST" }, "Demo portfolio seeded.")} loading={actionLoading} />
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

      <TakeProfitModal
        open={Boolean(takeProfitPos)}
        position={takeProfitPos}
        snapshot={snapshot}
        onClose={() => setTakeProfitPos(null)}
        loading={actionLoading}
        onConfirm={async (payload) => {
          await mutate("/api/ls-portfolio/take-profit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }, `Took profit on ${takeProfitPos?.symbol}.`);
          setTakeProfitPos(null);
        }}
      />

      <AddPositionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        loading={actionLoading}
        onSubmit={async (payload) => {
          await mutate("/api/ls-portfolio/positions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }, `${payload.symbol} added.`);
          setAddOpen(false);
        }}
      />

      <RebalanceModal
        open={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        snapshot={snapshot}
        loading={actionLoading}
        onConfirm={async () => {
          await mutate("/api/ls-portfolio/rebalance", { method: "POST" }, "Pools rebalanced.");
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
                  body: JSON.stringify({ pool: cashPool, amount: Number(cashAmount) }),
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

function EmptyState({ onSeed, loading }: { onSeed: () => void; loading: boolean }) {
  return (
    <div className="grid gap-4 py-12 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-cyan-300" />
      <div>
        <p className="text-lg font-black text-white">No positions yet</p>
        <p className="mt-1 text-sm text-zinc-400">
          Seed the demo book with TSLA, COIN, SCCO, CRCL, IREN longs and SNDK, EWY shorts — ~6:4
          ratio.
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
