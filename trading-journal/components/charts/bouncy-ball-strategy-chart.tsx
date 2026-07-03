"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";

import { Badge } from "@/components/ui/badge";
import type { OrderFlowBar, StrategySignal } from "@/lib/orderflow/types";

type BouncyBallStrategyChartProps = {
  bars: OrderFlowBar[];
  signals: StrategySignal[];
  tickerLabel: string;
  className?: string;
};

function toChartTime(timestamp: number): UTCTimestamp {
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function buildMarkers(bars: OrderFlowBar[], signals: StrategySignal[]): SeriesMarker<UTCTimestamp>[] {
  const barMarkers = new Map<number, SeriesMarker<UTCTimestamp>>();

  for (const bar of bars) {
    const time = toChartTime(bar.timestamp);

    if (bar.isSupportTouch) {
      barMarkers.set(bar.timestamp, {
        time,
        position: "belowBar",
        color: "#34d399",
        shape: "circle",
        text: "Bounce",
      });
    }

    if (bar.isResistanceTouch) {
      barMarkers.set(bar.timestamp, {
        time,
        position: "aboveBar",
        color: "#fb7185",
        shape: "circle",
        text: "Reject",
      });
    }

    if (bar.deltaDivergence === "bullish") {
      barMarkers.set(bar.timestamp, {
        time,
        position: "belowBar",
        color: "#22d3ee",
        shape: "square",
        text: "CVD+",
      });
    }

    if (bar.deltaDivergence === "bearish") {
      barMarkers.set(bar.timestamp, {
        time,
        position: "aboveBar",
        color: "#e879f9",
        shape: "square",
        text: "CVD−",
      });
    }
  }

  const markers = [...barMarkers.values()];

  for (const signal of signals) {
    markers.push({
      time: toChartTime(signal.timestamp),
      position: signal.direction === "long" ? "belowBar" : "aboveBar",
      color: signal.direction === "long" ? "#4ade80" : "#f87171",
      shape: signal.direction === "long" ? "arrowUp" : "arrowDown",
      text: signal.direction === "long" ? "Long" : "Short",
    });
  }

  return markers.sort((left, right) => (left.time as number) - (right.time as number));
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function BouncyBallStrategyChart({
  bars,
  signals,
  tickerLabel,
  className,
}: BouncyBallStrategyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const supportSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const resistanceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<{ setMarkers: (markers: SeriesMarker<UTCTimestamp>[]) => void } | null>(null);

  const candleData = useMemo(
    () =>
      bars.map((bar) => ({
        time: toChartTime(bar.timestamp),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    [bars],
  );

  const supportData = useMemo(
    () =>
      bars
        .filter((bar) => bar.supportLevel !== undefined)
        .map((bar) => ({
          time: toChartTime(bar.timestamp),
          value: bar.supportLevel as number,
        })),
    [bars],
  );

  const resistanceData = useMemo(
    () =>
      bars
        .filter((bar) => bar.resistanceLevel !== undefined)
        .map((bar) => ({
          time: toChartTime(bar.timestamp),
          value: bar.resistanceLevel as number,
        })),
    [bars],
  );

  const markers = useMemo(() => buildMarkers(bars, signals), [bars, signals]);
  const recentSignals = useMemo(() => signals.slice(-6), [signals]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(34,211,238,0.35)" },
        horzLine: { color: "rgba(34,211,238,0.35)" },
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#fb7185",
    });

    const supportLine = chart.addSeries(LineSeries, {
      color: "rgba(52,211,153,0.55)",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const resistanceLine = chart.addSeries(LineSeries, {
      color: "rgba(251,113,133,0.55)",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    supportSeriesRef.current = supportLine;
    resistanceSeriesRef.current = resistanceLine;
    markersRef.current = createSeriesMarkers(candles, []);

    return () => {
      markersRef.current = null;
      candleSeriesRef.current = null;
      supportSeriesRef.current = null;
      resistanceSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const candles = candleSeriesRef.current;
    const supportLine = supportSeriesRef.current;
    const resistanceLine = resistanceSeriesRef.current;
    const chart = chartRef.current;

    if (!candles || !supportLine || !resistanceLine || !chart) {
      return;
    }

    candles.setData(candleData);
    supportLine.setData(supportData);
    resistanceLine.setData(resistanceData);
    markersRef.current?.setMarkers(markers);

    for (const line of priceLinesRef.current) {
      candles.removePriceLine(line);
    }
    priceLinesRef.current = [];

    for (const signal of recentSignals) {
      priceLinesRef.current.push(
        candles.createPriceLine({
          price: signal.entry,
          color: "#22d3ee",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Entry",
        }),
        candles.createPriceLine({
          price: signal.stopLoss,
          color: "#f87171",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "SL",
        }),
        candles.createPriceLine({
          price: signal.takeProfit,
          color: "#4ade80",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "TP",
        }),
      );
    }

    chart.timeScale().fitContent();
  }, [candleData, markers, recentSignals, resistanceData, supportData]);

  if (!bars.length) {
    return (
      <div className="flex min-h-[480px] items-center justify-center text-sm text-zinc-500">
        Load ticker data to visualize the Bouncy Ball strategy.
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">Bouncy Ball overlay</Badge>
          <Badge tone="blue">{tickerLabel}</Badge>
        </div>
        <div className="flex flex-wrap gap-4">
          <LegendItem color="#34d399" label="Support bounce" />
          <LegendItem color="#fb7185" label="Resistance reject" />
          <LegendItem color="#22d3ee" label="Bullish CVD div" />
          <LegendItem color="#4ade80" label="Long entry" />
          <LegendItem color="#f87171" label="Short entry / SL" />
          <LegendItem color="#4ade80" label="Take profit" />
        </div>
      </div>
      <div ref={containerRef} className="h-[480px] w-full overflow-hidden rounded-2xl" />
      <p className="mt-3 text-xs text-zinc-500">
        TradingView&apos;s free embed cannot draw custom strategy markers. This chart uses TradingView
        Lightweight Charts with your computed bounce touches, CVD divergences, entries, and SL/TP levels
        for {tickerLabel}.
      </p>
    </div>
  );
}
