import { BarChart3, CheckCircle2, RadioTower } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Correlation Matrix | Trading Tools",
  description: "Pearson correlation matrix workspace for statistical arbitrage research.",
};

const previewSymbols = ["TSLA", "NVDA", "AAPL", "BTC", "ETH"];

export default function CorrelationToolPage() {
  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden border-emerald-300/20 bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-slate-950">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="win">Coming in Step 2</Badge>
              <CardTitle className="mt-4 text-3xl font-black sm:text-4xl">
                Live Pearson Correlation Matrix
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                This workspace is scaffolded for symbol selection, mock price feeds,
                Pearson calculation, timeframe controls, and the London Strategic
                Edge-style heatmap.
              </p>
            </div>
            <BarChart3 className="h-12 w-12 text-emerald-200/80" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-4">
            <div className="grid grid-cols-6 gap-2 text-center text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              <span />
              {previewSymbols.map((symbol) => (
                <span key={symbol}>{symbol}</span>
              ))}
            </div>
            <div className="mt-2 grid gap-2">
              {previewSymbols.map((rowSymbol, rowIndex) => (
                <div key={rowSymbol} className="grid grid-cols-6 gap-2">
                  <div className="flex items-center text-xs font-black text-zinc-400">
                    {rowSymbol}
                  </div>
                  {previewSymbols.map((columnSymbol, columnIndex) => {
                    const distance = Math.abs(rowIndex - columnIndex);
                    const value = rowSymbol === columnSymbol ? "1.00" : (0.92 - distance * 0.17).toFixed(2);

                    return (
                      <div
                        key={`${rowSymbol}-${columnSymbol}`}
                        className="rounded-xl border border-white/5 bg-emerald-400/20 px-2 py-4 text-xs font-black text-emerald-50"
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {["Multi-select symbols", "Pearson utility", "Auto-refresh controls"].map((item) => (
          <Card key={item}>
            <CardContent className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-200" />
              <span className="font-semibold text-zinc-200">{item}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-cyan-300/20 bg-cyan-300/10">
        <CardContent className="flex items-center gap-3 text-sm text-cyan-50">
          <RadioTower className="h-5 w-5" />
          Step 2 will replace this scaffold with live controls, mock data, and
          browser-side correlation computation.
        </CardContent>
      </Card>
    </section>
  );
}
