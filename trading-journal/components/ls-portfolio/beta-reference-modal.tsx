"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  formatMarketCap,
  formatVolume,
  type BetaReferenceSummary,
} from "@/lib/ls-portfolio-beta-reference";
import { formatPercent } from "@/lib/ls-portfolio";
import { cn } from "@/lib/utils";

type BetaReferenceModalProps = {
  open: boolean;
  onClose: () => void;
  snapshotDate: string;
};

function fmtBeta(value: number | null, digits = 2) {
  if (value === null) {
    return "—";
  }
  return value.toFixed(digits);
}

function fmtCorr(value: number | null) {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

function fmtPctOffHigh(value: number | null) {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function BetaReferenceModal({ open, onClose, snapshotDate }: BetaReferenceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BetaReferenceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ls-portfolio/beta-reference?date=${encodeURIComponent(snapshotDate)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Unable to load beta reference.");
      }
      setSummary(data as BetaReferenceSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [snapshotDate]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Beta reference (BETA)"
      wide
      className="max-w-6xl"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-zinc-400">
            Market context for tickers in this snapshot — sensitivity vs{" "}
            <span className="font-mono text-cyan-200">SPY</span>, sector concentration, liquidity,
            extension from 52-week high, and signed beta contribution to the book.
          </p>
          <Badge tone="neutral">BETA draft</Badge>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile
                label="Net portfolio beta"
                value={fmtBeta(summary.net_beta)}
                hint="Long − short weighted vs SPY"
              />
              <SummaryTile
                label="Long book beta"
                value={fmtBeta(summary.long_beta)}
                hint="Long positions only"
                tone="long"
              />
              <SummaryTile
                label="Short book beta"
                value={fmtBeta(summary.short_beta)}
                hint="Short positions (signed)"
                tone="short"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    <th className="px-3 py-3">Symbol</th>
                    <th className="px-3 py-3">Side</th>
                    <th className="px-3 py-3 text-right">Port. wt</th>
                    <th className="px-3 py-3 text-right">Beta vs SPY</th>
                    <th className="px-3 py-3 text-right">60d corr</th>
                    <th className="px-3 py-3">Sector</th>
                    <th className="px-3 py-3 text-right">Mkt cap</th>
                    <th className="px-3 py-3 text-right">Avg vol</th>
                    <th className="px-3 py-3 text-right">vs 52W H</th>
                    <th className="px-3 py-3 text-right">β contrib</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                        No positions in this snapshot — add tickers to populate reference rows.
                      </td>
                    </tr>
                  ) : (
                    summary.rows.map((row) => (
                      <tr key={`${row.symbol}-${row.side}`} className="border-b border-white/5">
                        <td className="px-3 py-3 font-mono font-bold text-white">{row.symbol}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                              row.side === "long"
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-rose-500/15 text-rose-200",
                            )}
                          >
                            {row.side}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-300">
                          {formatPercent(row.portfolio_weight_pct, 1)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-cyan-100">
                          {fmtBeta(row.beta_spy)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">
                          {fmtCorr(row.corr_spy_60d)}
                        </td>
                        <td className="px-3 py-3 text-zinc-400">{row.sector ?? "—"}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">
                          {formatMarketCap(row.market_cap)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-zinc-400">
                          {formatVolume(row.avg_volume_20d)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right font-mono tabular-nums",
                            row.pct_from_52w_high !== null && row.pct_from_52w_high > -10
                              ? "text-amber-200"
                              : "text-zinc-400",
                          )}
                        >
                          {fmtPctOffHigh(row.pct_from_52w_high)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right font-mono tabular-nums font-bold",
                            row.beta_contribution === null
                              ? "text-zinc-500"
                              : row.beta_contribution >= 0
                                ? "text-emerald-200"
                                : "text-rose-200",
                          )}
                        >
                          {fmtBeta(row.beta_contribution, 3)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs leading-relaxed text-zinc-500">{summary.disclaimer}</p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "long" | "short";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "long" && "border-emerald-400/20 bg-emerald-500/10",
        tone === "short" && "border-rose-400/20 bg-rose-500/10",
        tone === "neutral" && "border-white/10 bg-black/25",
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}
