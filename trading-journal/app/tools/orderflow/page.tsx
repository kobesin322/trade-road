import { Activity, CheckCircle2, Gauge, Layers3 } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Order Flow | Trading Tools",
  description: "Level 3 order flow and market microstructure workspace.",
};

const priceLevels = ["67,245.0", "67,240.5", "67,236.0", "67,231.5", "67,227.0", "67,222.5"];
const timeBuckets = ["09:30", "09:31", "09:32", "09:33", "09:34", "09:35", "09:36"];

export default function OrderFlowToolPage() {
  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-slate-950 to-rose-500/10">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="blue">Coming in Step 3</Badge>
              <CardTitle className="mt-4 text-3xl font-black sm:text-4xl">
                Live Level 3 Order Flow Visualizer
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                This workspace is scaffolded for Binance order book streaming,
                price-by-time liquidity heatmaps, depth views, imbalance, and
                large-wall detection.
              </p>
            </div>
            <Activity className="h-12 w-12 text-cyan-200/80" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-4">
              <div className="grid grid-cols-8 gap-1 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                <span>Price</span>
                {timeBuckets.map((bucket) => (
                  <span key={bucket}>{bucket}</span>
                ))}
              </div>
              <div className="mt-2 grid gap-1">
                {priceLevels.map((price, rowIndex) => (
                  <div key={price} className="grid grid-cols-8 gap-1">
                    <div className="flex items-center text-xs font-black text-zinc-400">
                      {price}
                    </div>
                    {timeBuckets.map((bucket, columnIndex) => {
                      const isAsk = rowIndex < 3;
                      const intensity = 12 + ((rowIndex + columnIndex) % 4) * 12;

                      return (
                        <div
                          key={`${price}-${bucket}`}
                          className={
                            isAsk
                              ? "h-10 rounded-lg border border-rose-300/10 bg-rose-400/25"
                              : "h-10 rounded-lg border border-emerald-300/10 bg-emerald-400/25"
                          }
                          style={{ opacity: intensity / 50 }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {[
                ["Bid depth", "38.4 BTC", "text-emerald-300"],
                ["Ask depth", "31.7 BTC", "text-rose-300"],
                ["Imbalance", "+9.5%", "text-cyan-200"],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {label}
                  </div>
                  <div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {["Binance WebSocket", "Order book state", "Depth and imbalance"].map((item) => (
          <Card key={item}>
            <CardContent className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-200" />
              <span className="font-semibold text-zinc-200">{item}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-yellow-300/20 bg-yellow-300/10">
        <CardContent className="flex items-center gap-3 text-sm text-yellow-50">
          <Layers3 className="h-5 w-5" />
          Step 3 will replace this scaffold with a live liquidity heatmap, order
          book table, depth chart, and microstructure metrics.
        </CardContent>
      </Card>

      <Card className="border-cyan-300/20 bg-cyan-300/10">
        <CardContent className="flex items-center gap-3 text-sm text-cyan-50">
          <Gauge className="h-5 w-5" />
          This route is ready for the real-time client component that will own the
          WebSocket lifecycle.
        </CardContent>
      </Card>
    </section>
  );
}
