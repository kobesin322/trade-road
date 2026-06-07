"use client";

import { BarChart3, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/ls-portfolio";
import type { BetaReferenceSummary } from "@/lib/ls-portfolio-beta-reference";
import { cn } from "@/lib/utils";

type PortfolioWeightedBetaPanelProps = {
  summary: BetaReferenceSummary | null;
  loading: boolean;
  onOpenReference: () => void;
};

function fmtBeta(value: number | null, digits = 2) {
  if (value === null) {
    return "—";
  }
  return value.toFixed(digits);
}

export function PortfolioWeightedBetaPanel({
  summary,
  loading,
  onOpenReference,
}: PortfolioWeightedBetaPanelProps) {
  const benchmark = summary?.benchmark ?? "SPY";

  return (
    <Card className="overflow-hidden border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/5">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Weighted portfolio beta</CardTitle>
              <Badge tone="neutral">vs {benchmark}</Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Market-value weighted sensitivity from the beta reference table.
            </p>
          </div>
          <Button
            type="button"
            onClick={onOpenReference}
            className="shrink-0 bg-violet-400/15 text-violet-100"
          >
            <BarChart3 className="h-4 w-4" />
            Full reference
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !summary || summary.formula_terms.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Add positions with beta data to compute weighted book beta.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-300">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                Formula
              </div>
              <p className="mt-2">
                β<sub>portfolio</sub> = Σ sign(side) × (MV<sub>i</sub> / Total Pool) × β
                <sub>{benchmark},i</sub>
              </p>
              <p className="mt-1 text-zinc-500">
                Long = +1 · Short = −1 · Weights use each position&apos;s market value share of the
                combined L/S pool.
              </p>
              <p className="mt-3 break-words text-cyan-100/90">
                ={" "}
                {summary.formula_terms
                  .map(
                    (term) =>
                      `${term.sign > 0 ? "+" : "−"}(${term.weight_pct.toFixed(1)}% × ${term.beta_spy.toFixed(2)})`,
                  )
                  .join(" ")}
              </p>
              <p className="mt-2 text-lg font-black text-white">
                = {fmtBeta(summary.net_beta, 3)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricTile label="Net weighted β" value={fmtBeta(summary.net_beta, 3)} highlight />
              <MetricTile label="Long contribution" value={fmtBeta(summary.long_beta, 3)} tone="long" />
              <MetricTile label="Short contribution" value={fmtBeta(summary.short_beta, 3)} tone="short" />
              <MetricTile
                label="Long book avg β"
                value={fmtBeta(summary.weighted_long_avg_beta)}
                sub="MV-weighted long names"
                tone="long"
              />
              <MetricTile
                label="Short book avg β"
                value={fmtBeta(summary.weighted_short_avg_beta)}
                sub="MV-weighted short names"
                tone="short"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2 text-right">β vs {benchmark}</th>
                    <th className="px-3 py-2 text-right">Term</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.formula_terms.map((term) => (
                    <tr key={`${term.symbol}-${term.side}`} className="border-b border-white/5">
                      <td className="px-3 py-2 font-mono font-bold text-white">{term.symbol}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                            term.side === "long"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-rose-500/15 text-rose-200",
                          )}
                        >
                          {term.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-300">
                        {formatPercent(term.weight_pct, 1)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-cyan-100">
                        {term.beta_spy.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono tabular-nums font-bold",
                          term.contribution >= 0 ? "text-emerald-200" : "text-rose-200",
                        )}
                      >
                        {term.contribution >= 0 ? "+" : ""}
                        {term.contribution.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-500/10">
                    <td colSpan={4} className="px-3 py-2 text-right font-bold text-violet-200">
                      Net β ({formatPercent(summary.beta_coverage_pct, 0)} coverage)
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-base font-black text-white">
                      {fmtBeta(summary.net_beta, 3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone = "neutral",
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "long" | "short";
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        highlight && "border-violet-400/30 bg-violet-500/15",
        tone === "long" && !highlight && "border-emerald-400/20 bg-emerald-500/10",
        tone === "short" && !highlight && "border-rose-400/20 bg-rose-500/10",
        tone === "neutral" && !highlight && "border-white/10 bg-black/25",
      )}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-black text-white">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}
