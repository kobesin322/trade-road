"use client";

import { useState } from "react";

import { TradingViewEmbed } from "@/components/charts/trading-view-embed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const STRATEGY_TIMEFRAMES = [
  { label: "5m", interval: "5", helper: "Micro structure" },
  { label: "15m", interval: "15", helper: "Backtest interval" },
  { label: "1H", interval: "60", helper: "Intraday bias" },
  { label: "4H", interval: "240", helper: "Swing context" },
  { label: "1D", interval: "D", helper: "Daily trend" },
] as const;

type StrategyTimeframe = (typeof STRATEGY_TIMEFRAMES)[number];
type ViewMode = "grid" | "focus";

type TradingViewMultiTimeframeProps = {
  symbol: string;
  tickerLabel: string;
  className?: string;
};

function TimeframePanel({
  frame,
  symbol,
  compact,
}: {
  frame: StrategyTimeframe;
  symbol: string;
  compact: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <div className="text-sm font-black text-white">{frame.label}</div>
          <div className="text-xs text-zinc-500">{frame.helper}</div>
        </div>
        <Badge tone="blue">{symbol}</Badge>
      </div>
      <TradingViewEmbed
        symbol={symbol}
        interval={frame.interval}
        hideSideToolbar={compact}
        hideTopToolbar={compact}
        className={compact ? "h-[280px] w-full" : "h-[430px] w-full"}
      />
    </div>
  );
}

export function TradingViewMultiTimeframe({
  symbol,
  tickerLabel,
  className,
}: TradingViewMultiTimeframeProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [focusedInterval, setFocusedInterval] = useState<StrategyTimeframe["interval"]>("15");
  const focusedFrame =
    STRATEGY_TIMEFRAMES.find((frame) => frame.interval === focusedInterval) ?? STRATEGY_TIMEFRAMES[1];

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn("px-3 py-2 text-xs", viewMode === "grid" && "border-cyan-300/60 bg-cyan-300/15")}
          >
            Multi-TF grid
          </Button>
          <Button
            type="button"
            onClick={() => setViewMode("focus")}
            className={cn("px-3 py-2 text-xs", viewMode === "focus" && "border-cyan-300/60 bg-cyan-300/15")}
          >
            Focus chart
          </Button>
        </div>
        {viewMode === "focus" ? (
          <div className="flex flex-wrap gap-2">
            {STRATEGY_TIMEFRAMES.map((frame) => (
              <Button
                key={frame.interval}
                type="button"
                onClick={() => setFocusedInterval(frame.interval)}
                className={cn(
                  "px-3 py-2 text-xs",
                  focusedInterval === frame.interval && "border-fuchsia-300/60 bg-fuchsia-300/15",
                )}
              >
                {frame.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-zinc-500">
            {tickerLabel} · 5 timeframes loaded side-by-side
          </div>
        )}
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STRATEGY_TIMEFRAMES.map((frame) => (
            <TimeframePanel key={frame.interval} frame={frame} symbol={symbol} compact />
          ))}
        </div>
      ) : (
        <TimeframePanel frame={focusedFrame} symbol={symbol} compact={false} />
      )}
    </div>
  );
}
