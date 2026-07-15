"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  Calculator,
  Link2,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { saveJournalEntry } from "@/app/actions/journal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  JOURNAL_PAIR_OPTIONS,
  JOURNAL_STRATEGIES,
  type JournalStrategy,
} from "@/lib/journal-constants";
import { useCustomWatchlist } from "@/lib/hooks/use-custom-watchlist";
import {
  buildCalculatorJournalHtml,
  computeRiskCalculator,
  formatRiskRatio,
  type RiskCalculatorSide,
} from "@/lib/risk-calculator";
import type { Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

type RiskCalculatorUtilityProps = {
  canUsePersonalJournal: boolean;
  onTradeCreated: (trade: Trade) => void;
};

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: number | null, compact = false) {
  if (value === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number | null) {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function RiskCalculatorUtility({
  canUsePersonalJournal,
  onTradeCreated,
}: RiskCalculatorUtilityProps) {
  const { items: customWatchlist } = useCustomWatchlist();
  const [side, setSide] = useState<RiskCalculatorSide>("LONG");
  const [risk, setRisk] = useState("100");
  const [capital, setCapital] = useState("10000");
  const [leverage, setLeverage] = useState("1");
  const [entry, setEntry] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [strategy, setStrategy] = useState<JournalStrategy>(JOURNAL_STRATEGIES[0]);
  const [pair, setPair] = useState("TSLA");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pairOptions = useMemo(
    () => [
      ...JOURNAL_PAIR_OPTIONS,
      ...(customWatchlist.length
        ? [{ group: "Your Watchlist", symbols: customWatchlist.map((item) => item.yahooSymbol) }]
        : []),
    ],
    [customWatchlist],
  );

  const input = useMemo(
    () => ({
      side,
      riskDollars: parseNumber(risk),
      capital: parseNumber(capital),
      leverage: parseNumber(leverage, 1),
      entry: parseNumber(entry),
      takeProfit: parseNumber(takeProfit),
      stopLoss: parseNumber(stopLoss),
    }),
    [side, risk, capital, leverage, entry, takeProfit, stopLoss],
  );

  const result = useMemo(() => computeRiskCalculator(input), [input]);

  function handleCreateTrade() {
    if (!canUsePersonalJournal) {
      setMessage("Sign in with Supabase to save journal entries.");
      return;
    }
    if (!result.valid || result.tpPercent === null || result.expectedProfitDollars === null) {
      setMessage("Fix calculator inputs before creating a trade.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await saveJournalEntry(
        {
          pair,
          date: format(new Date(), "yyyy-MM-dd"),
          strategy,
          outcome: "WIN",
          profitPercent: result.tpPercent ?? 0,
          profitAmount: result.expectedProfitDollars ?? 0,
          position: side,
          stopLoss: parseNumber(stopLoss) || null,
          takeProfit: parseNumber(takeProfit) || null,
          riskRewardRatio: result.rewardRiskRatio,
          levelPushes: [],
          journalHtml: buildCalculatorJournalHtml(input, result),
          screenshots: [],
        },
        [],
      );

      if (!response.ok) {
        setMessage(response.message);
        return;
      }

      setMessage("Trade journal created.");
      onTradeCreated(response.trade);
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Calculator className="h-5 w-5 text-cyan-300" />
            <CardTitle className="text-xl">Risk Calculator</CardTitle>
            <Badge tone="neutral">Position sizing · R:R</Badge>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Size from dollar risk, capital, and leverage. Enter entry with TP/SL to see targets and
            reward-to-risk.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,380px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-2">
              {(["LONG", "SHORT"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition",
                    side === value && value === "LONG" && "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
                    side === value && value === "SHORT" && "border-rose-400/50 bg-rose-500/15 text-rose-100",
                    side !== value && "border-white/10 text-zinc-400 hover:bg-white/5",
                  )}
                >
                  {value === "LONG" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {value}
                </button>
              ))}
            </div>

            <FieldRow label="Risk ($)" value={risk} onChange={setRisk} type="number" />
            <FieldRow label="Capital ($)" value={capital} onChange={setCapital} type="number" />
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm font-semibold text-zinc-300">
                <span>Leverage</span>
                <span className="font-mono text-cyan-200">{parseNumber(leverage, 1)}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={parseNumber(leverage, 1)}
                onChange={(e) => setLeverage(e.target.value)}
                className="w-full accent-cyan-400"
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className="font-mono"
              />
            </div>
            <FieldRow label="Entry price ($)" value={entry} onChange={setEntry} type="number" step="any" />
            <FieldRow label="Take profit ($)" value={takeProfit} onChange={setTakeProfit} type="number" step="any" />
            <FieldRow label="Stop loss ($)" value={stopLoss} onChange={setStopLoss} type="number" step="any" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-400/15">
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {result.errors.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {result.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile
                label="Take profit"
                value={formatPct(result.tpPercent)}
                sub="from entry"
                tone="long"
              />
              <ResultTile
                label="Stop loss"
                value={formatPct(result.slPercent)}
                sub="from entry"
                tone="short"
              />
              <ResultTile
                label="R:R ratio"
                value={formatRiskRatio(result.rewardRiskRatio)}
                sub="reward per $1 risked"
                tone="neutral"
                highlight
              />
              <ResultTile
                label="Expected profit"
                value={formatUsd(result.expectedProfitDollars)}
                sub="at take-profit"
                tone="long"
              />
            </div>

            <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
              <StatLine label="Position size" value={result.positionSize?.toLocaleString() ?? "—"} />
              <StatLine label="Notional value" value={formatUsd(result.notionalValue)} />
              <StatLine label="Buying power" value={formatUsd(result.buyingPower)} />
              <StatLine
                label="Uses leverage"
                value={result.usesLeveragePct !== null ? `${result.usesLeveragePct}%` : "—"}
              />
              <StatLine
                label="Risk of capital"
                value={result.riskPercentOfCapital !== null ? `${result.riskPercentOfCapital}%` : "—"}
              />
            </div>

            <Button
              type="button"
              onClick={() => setLinkOpen((open) => !open)}
              className="w-full bg-violet-400/15 text-violet-100 hover:bg-violet-400/25"
            >
              <Link2 className="h-4 w-4" />
              {linkOpen ? "Hide link to trade" : "Link to a trade"}
            </Button>

            {linkOpen ? (
              <div className="grid gap-4 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
                <p className="text-sm text-zinc-400">
                  Pre-fill a journal entry with calculator targets. Outcome defaults to WIN (plan at
                  TP).
                </p>
                <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                  Strategy
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as JournalStrategy)}
                    className="rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white"
                  >
                    {JOURNAL_STRATEGIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-300">
                  Ticker
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-white"
                  >
                    {pairOptions.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.symbols.map((symbol) => (
                          <option key={symbol} value={symbol}>
                            {symbol}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {message ? (
                  <p
                    className={cn(
                      "text-sm",
                      message.includes("created") ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {message}
                  </p>
                ) : null}
                <Button
                  type="button"
                  disabled={!result.valid || isPending || !canUsePersonalJournal}
                  onClick={handleCreateTrade}
                  className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Create trade journal
                </Button>
                {!canUsePersonalJournal ? (
                  <p className="text-xs text-zinc-500">Sign in to save personal journal entries.</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-zinc-300">
      {label}
      <Input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 font-mono"
      />
    </label>
  );
}

function ResultTile({
  label,
  value,
  sub,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "long" | "short" | "neutral";
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "long" && "border-emerald-400/20 bg-emerald-500/5",
        tone === "short" && "border-rose-400/20 bg-rose-500/5",
        tone === "neutral" && "border-white/10 bg-white/[0.03]",
        highlight && "ring-1 ring-cyan-400/30",
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-black tabular-nums text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-zinc-200">{value}</span>
    </div>
  );
}
