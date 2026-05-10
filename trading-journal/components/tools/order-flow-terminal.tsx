"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Circle,
  Loader2,
  Pause,
  Play,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "BCHUSDT",
  "DOTUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "ATOMUSDT",
  "NEARUSDT",
  "APTUSDT",
  "SHIBUSDT",
  "PEPEUSDT",
] as const;
const BINANCE_VENUES = [
  {
    name: "Binance Global",
    restBase: "https://api.binance.com",
    wsBase: "wss://stream.binance.com:9443/ws",
  },
  {
    name: "Binance US",
    restBase: "https://api.binance.us",
    wsBase: "wss://stream.binance.us:9443/ws",
  },
] as const;
const BOOK_LIMIT = 1000;
const DISPLAY_LEVELS = 14;
const IMBALANCE_LEVELS = 20;
const HEATMAP_COLUMNS = 36;
const HEATMAP_LEVELS_PER_SIDE = 12;
const HEATMAP_INTERVAL_MS = 1500;

type SymbolOption = (typeof SYMBOLS)[number];
type ConnectionStatus = "idle" | "connecting" | "syncing" | "live" | "reconnecting" | "error" | "closed";
type RawLevel = [string, string];

type BinanceDepthSnapshot = {
  lastUpdateId: number;
  bids: RawLevel[];
  asks: RawLevel[];
};

type BinanceDepthUpdate = {
  e: "depthUpdate";
  E: number;
  s: string;
  U: number;
  u: number;
  b: RawLevel[];
  a: RawLevel[];
};

type BookLevel = {
  price: number;
  size: number;
  cumulative: number;
  notional: number;
  wallScore: number;
};

type BookMetrics = {
  bestBid: number | null;
  bestAsk: number | null;
  bidDepth: number;
  askDepth: number;
  imbalance: number;
  midPrice: number | null;
  spread: number | null;
  spreadBps: number | null;
  walls: Array<BookLevel & { side: "bid" | "ask" }>;
};

type RenderedBook = {
  bids: BookLevel[];
  asks: BookLevel[];
  metrics: BookMetrics;
};

type HeatmapCell = {
  price: number;
  side: "bid" | "ask";
  size: number;
};

type HeatmapColumn = {
  timestamp: number;
  cells: Record<string, HeatmapCell>;
};

type NqQuote = {
  change: number | null;
  changePercent: number | null;
  currency: string;
  exchange: string;
  price: number;
  source: string;
  symbol: string;
  timestamp: string;
};

function applyLevels(book: Map<number, number>, levels: RawLevel[]) {
  for (const [priceText, sizeText] of levels) {
    const price = Number(priceText);
    const size = Number(sizeText);

    if (!Number.isFinite(price) || !Number.isFinite(size)) {
      continue;
    }

    if (size === 0) {
      book.delete(price);
    } else {
      book.set(price, size);
    }
  }
}

function toBookLevels(book: Map<number, number>, side: "bid" | "ask", limit = DISPLAY_LEVELS) {
  const sorted = Array.from(book.entries())
    .sort(([leftPrice], [rightPrice]) =>
      side === "bid" ? rightPrice - leftPrice : leftPrice - rightPrice,
    )
    .slice(0, limit);

  let cumulative = 0;
  const averageSize =
    sorted.reduce((sum, [, size]) => sum + size, 0) / Math.max(sorted.length, 1);

  return sorted.map(([price, size]) => {
    cumulative += size;

    return {
      price,
      size,
      cumulative,
      notional: price * size,
      wallScore: averageSize > 0 ? size / averageSize : 0,
    };
  });
}

function sumDepth(levels: BookLevel[], depth = IMBALANCE_LEVELS) {
  return levels.slice(0, depth).reduce((sum, level) => sum + level.size, 0);
}

function buildRenderedBook(bidsBook: Map<number, number>, asksBook: Map<number, number>): RenderedBook {
  const bids = toBookLevels(bidsBook, "bid", DISPLAY_LEVELS);
  const asks = toBookLevels(asksBook, "ask", DISPLAY_LEVELS);
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const bidDepth = sumDepth(toBookLevels(bidsBook, "bid", IMBALANCE_LEVELS));
  const askDepth = sumDepth(toBookLevels(asksBook, "ask", IMBALANCE_LEVELS));
  const totalDepth = bidDepth + askDepth;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spreadBps = spread !== null && midPrice ? (spread / midPrice) * 10_000 : null;
  const imbalance = totalDepth > 0 ? ((bidDepth - askDepth) / totalDepth) * 100 : 0;
  const walls = [
    ...bids.filter((level) => level.wallScore >= 2).map((level) => ({ ...level, side: "bid" as const })),
    ...asks.filter((level) => level.wallScore >= 2).map((level) => ({ ...level, side: "ask" as const })),
  ]
    .sort((left, right) => right.wallScore - left.wallScore)
    .slice(0, 4);

  return {
    bids,
    asks,
    metrics: {
      bestBid,
      bestAsk,
      bidDepth,
      askDepth,
      imbalance,
      midPrice,
      spread,
      spreadBps,
      walls,
    },
  };
}

function formatPrice(value: number | null) {
  if (value === null) {
    return "--";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: value > 100 ? 2 : 5,
    minimumFractionDigits: value > 100 ? 2 : 3,
  });
}

function formatSize(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 10 ? 2 : 5,
  });
}

function formatSignedPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatOptionalChange(value: number | null) {
  if (value === null) {
    return "--";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function priceKey(price: number) {
  return price.toFixed(8);
}

function buildHeatmapRows(bids: BookLevel[], asks: BookLevel[]) {
  return [
    ...asks.slice(0, HEATMAP_LEVELS_PER_SIDE).reverse().map((level) => ({
      price: level.price,
      side: "ask" as const,
    })),
    ...bids.slice(0, HEATMAP_LEVELS_PER_SIDE).map((level) => ({
      price: level.price,
      side: "bid" as const,
    })),
  ];
}

function buildHeatmapColumn(bids: BookLevel[], asks: BookLevel[]): HeatmapColumn {
  const cells: Record<string, HeatmapCell> = {};

  for (const level of asks.slice(0, HEATMAP_LEVELS_PER_SIDE)) {
    cells[priceKey(level.price)] = {
      price: level.price,
      side: "ask",
      size: level.size,
    };
  }

  for (const level of bids.slice(0, HEATMAP_LEVELS_PER_SIDE)) {
    cells[priceKey(level.price)] = {
      price: level.price,
      side: "bid",
      size: level.size,
    };
  }

  return {
    timestamp: Date.now(),
    cells,
  };
}

function heatmapCellStyle(cell: HeatmapCell | undefined, maxSize: number) {
  if (!cell) {
    return {
      background: "rgba(255,255,255,0.025)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.025)",
    };
  }

  const weight = Math.min(1, Math.sqrt(cell.size / Math.max(maxSize, 0.0000001)));
  const alpha = 0.12 + weight * 0.78;
  const glow = 4 + weight * 18;
  const color = cell.side === "bid" ? "34,197,94" : "244,63,94";

  return {
    background: `linear-gradient(180deg, rgba(${color},${Math.min(0.95, alpha + 0.08)}), rgba(${color},${alpha}))`,
    boxShadow: `0 0 ${glow}px rgba(${color},${weight * 0.42}), inset 0 0 0 1px rgba(${color},${0.18 + weight * 0.28})`,
  };
}

function getStatusCopy(status: ConnectionStatus) {
  const labels: Record<ConnectionStatus, string> = {
    idle: "Idle",
    connecting: "Connecting",
    syncing: "Syncing",
    live: "Live",
    reconnecting: "Reconnecting",
    error: "Error",
    closed: "Closed",
  };

  return labels[status];
}

function statusTone(status: ConnectionStatus) {
  if (status === "live") {
    return "text-emerald-300";
  }

  if (status === "error") {
    return "text-rose-300";
  }

  if (status === "connecting" || status === "syncing" || status === "reconnecting") {
    return "text-amber-200";
  }

  return "text-zinc-400";
}

function isDepthUpdate(value: unknown): value is BinanceDepthUpdate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BinanceDepthUpdate>;
  return (
    candidate.e === "depthUpdate" &&
    typeof candidate.U === "number" &&
    typeof candidate.u === "number" &&
    Array.isArray(candidate.b) &&
    Array.isArray(candidate.a)
  );
}

function validateSnapshot(value: unknown): BinanceDepthSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Binance returned an empty snapshot.");
  }

  const snapshot = value as Partial<BinanceDepthSnapshot>;
  if (
    typeof snapshot.lastUpdateId !== "number" ||
    !Array.isArray(snapshot.bids) ||
    !Array.isArray(snapshot.asks)
  ) {
    throw new Error("Binance depth snapshot had an unexpected shape.");
  }

  return {
    lastUpdateId: snapshot.lastUpdateId,
    bids: snapshot.bids,
    asks: snapshot.asks,
  };
}

function useBinanceOrderBook(symbol: SymbolOption) {
  const wsRef = useRef<WebSocket | null>(null);
  const bidsRef = useRef(new Map<number, number>());
  const asksRef = useRef(new Map<number, number>());
  const bufferedEventsRef = useRef<BinanceDepthUpdate[]>([]);
  const lastUpdateIdRef = useRef(0);
  const syncedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(false);
  const venueIndexRef = useRef(0);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [renderedBook, setRenderedBook] = useState<RenderedBook>(() =>
    buildRenderedBook(new Map(), new Map()),
  );
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const [lastUpdateId, setLastUpdateId] = useState<number | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const publishBook = useCallback(() => {
    setRenderedBook(buildRenderedBook(bidsRef.current, asksRef.current));
    setLastUpdateId(lastUpdateIdRef.current || null);
  }, []);

  const resetBook = useCallback(() => {
    bidsRef.current = new Map();
    asksRef.current = new Map();
    bufferedEventsRef.current = [];
    lastUpdateIdRef.current = 0;
    syncedRef.current = false;
    setLastEventTime(null);
    setLastUpdateId(null);
    setVenueName(null);
    setRenderedBook(buildRenderedBook(new Map(), new Map()));
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    wsRef.current?.close(1000, "User disconnected");
    wsRef.current = null;
    setStatus("closed");
  }, [clearReconnectTimer]);

  const applyUpdate = useCallback(
    (update: BinanceDepthUpdate) => {
      if (update.u <= lastUpdateIdRef.current) {
        return true;
      }

      if (!syncedRef.current) {
        const expectedUpdate = lastUpdateIdRef.current + 1;
        if (update.U > expectedUpdate || update.u < expectedUpdate) {
          return false;
        }
        syncedRef.current = true;
      } else if (update.U !== lastUpdateIdRef.current + 1) {
        return false;
      }

      applyLevels(bidsRef.current, update.b);
      applyLevels(asksRef.current, update.a);
      lastUpdateIdRef.current = update.u;
      setLastEventTime(update.E);
      publishBook();
      setStatus("live");
      reconnectAttemptsRef.current = 0;
      return true;
    },
    [publishBook],
  );

  const connect = useCallback(async (venueIndex = 0) => {
    const previousSocket = wsRef.current;
    if (previousSocket) {
      previousSocket.onclose = null;
      previousSocket.onerror = null;
      previousSocket.onmessage = null;
      previousSocket.close(1000, "Starting a fresh order book sync");
      wsRef.current = null;
    }

    const venue = BINANCE_VENUES[venueIndex];
    venueIndexRef.current = venueIndex;
    shouldReconnectRef.current = true;
    clearReconnectTimer();
    resetBook();
    setError(null);
    setVenueName(venue.name);
    setStatus("connecting");

    const streamSymbol = symbol.toLowerCase();
    const socket = new WebSocket(`${venue.wsBase}/${streamSymbol}@depth@1000ms`);
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus("syncing");
    };

    socket.onmessage = (message) => {
      try {
        const parsed: unknown = JSON.parse(message.data as string);
        if (!isDepthUpdate(parsed)) {
          return;
        }

        if (!lastUpdateIdRef.current) {
          bufferedEventsRef.current = [...bufferedEventsRef.current, parsed].slice(-500);
          return;
        }

        const ok = applyUpdate(parsed);
        if (!ok) {
          setError("Depth stream sequence gap detected. Re-syncing order book.");
          void connect(venueIndexRef.current);
        }
      } catch {
        setError("Unable to parse Binance depth update.");
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setError("Binance WebSocket reported a connection error.");
    };

    socket.onclose = () => {
      if (!shouldReconnectRef.current) {
        return;
      }

      setStatus("reconnecting");
      const nextAttempt = Math.min(reconnectAttemptsRef.current + 1, 5);
      reconnectAttemptsRef.current = nextAttempt;
      reconnectTimerRef.current = window.setTimeout(() => {
        void connect(venueIndexRef.current);
      }, nextAttempt * 1000);
    };

    try {
      const response = await fetch(
        `${venue.restBase}/api/v3/depth?symbol=${symbol}&limit=${BOOK_LIMIT}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Snapshot request failed with ${response.status}.`);
      }

      const snapshot = validateSnapshot(await response.json());
      bidsRef.current = new Map();
      asksRef.current = new Map();
      applyLevels(bidsRef.current, snapshot.bids);
      applyLevels(asksRef.current, snapshot.asks);
      lastUpdateIdRef.current = snapshot.lastUpdateId;

      const bufferedEvents = bufferedEventsRef.current.filter(
        (event) => event.u > snapshot.lastUpdateId,
      );
      bufferedEventsRef.current = [];

      for (const event of bufferedEvents) {
        const ok = applyUpdate(event);
        if (!ok) {
          throw new Error("Buffered depth stream sequence did not overlap snapshot.");
        }
      }

      if (!syncedRef.current) {
        publishBook();
      }

      setStatus("live");
      reconnectAttemptsRef.current = 0;
    } catch (snapshotError) {
      const message =
        snapshotError instanceof Error
          ? snapshotError.message
          : "Unable to initialize Binance depth snapshot.";
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close(1000, "Snapshot initialization failed");
      const nextVenueIndex = venueIndex + 1;
      if (nextVenueIndex < BINANCE_VENUES.length) {
        setError(`${venue.name} unavailable (${message}). Trying ${BINANCE_VENUES[nextVenueIndex].name}.`);
        void connect(nextVenueIndex);
        return;
      }

      shouldReconnectRef.current = false;
      setStatus("error");
      setError(message);
    }
  }, [applyUpdate, clearReconnectTimer, publishBook, resetBook, symbol]);

  return {
    connect,
    disconnect,
    error,
    lastEventTime,
    lastUpdateId,
    metrics: renderedBook.metrics,
    venueName,
    bids: renderedBook.bids,
    asks: renderedBook.asks,
    status,
  };
}

function NqFuturesSource() {
  const [quote, setQuote] = useState<NqQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/market-data/nq", { cache: "no-store" });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "NQ source unavailable.";
        throw new Error(message);
      }

      setQuote(payload as NqQuote);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "NQ source unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuote();
    const interval = window.setInterval(() => {
      void loadQuote();
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadQuote]);

  return (
    <Card className="border-sky-300/20 bg-sky-400/10">
      <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">Free NQ source</Badge>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Delayed quote only
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                {quote?.symbol ?? "NQ=F"} Nasdaq-100 E-mini
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-white">
                {quote ? formatPrice(quote.price) : "--"}
              </div>
            </div>
            <div className={cn("pb-1 font-mono text-lg font-black", (quote?.change ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>
              {quote ? `${formatOptionalChange(quote.change)} (${quote.changePercent?.toFixed(2) ?? "--"}%)` : "--"}
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Source: {quote?.source ?? "Yahoo Finance delayed futures chart with Stooq fallback"}.
            This is not CME depth or order book data.
          </p>
          <div className="mt-2 text-xs text-zinc-500">
            {quote ? `${quote.exchange} · ${quote.currency} · ${new Date(quote.timestamp).toLocaleString()}` : "Loading NQ quote..."}
          </div>
          {error ? <div className="mt-2 text-sm text-rose-200">{error}</div> : null}
        </div>
        <Button
          type="button"
          disabled={loading}
          onClick={() => void loadQuote()}
          className="bg-sky-300/15 text-sky-100 hover:bg-sky-300/25"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh NQ
        </Button>
      </CardContent>
    </Card>
  );
}

export function OrderFlowTerminal() {
  const [symbol, setSymbol] = useState<SymbolOption>("BTCUSDT");
  const { asks, bids, connect, disconnect, error, lastEventTime, lastUpdateId, metrics, status, venueName } =
    useBinanceOrderBook(symbol);
  const [heatmapColumns, setHeatmapColumns] = useState<HeatmapColumn[]>([]);
  const latestBidsRef = useRef<BookLevel[]>([]);
  const latestAsksRef = useRef<BookLevel[]>([]);
  const maxCumulative = useMemo(
    () => Math.max(1, ...bids.map((level) => level.cumulative), ...asks.map((level) => level.cumulative)),
    [asks, bids],
  );
  const isWorking = status === "connecting" || status === "syncing" || status === "reconnecting";
  const isConnected = status === "live" || isWorking;

  useEffect(() => {
    latestBidsRef.current = bids;
    latestAsksRef.current = asks;
  }, [asks, bids]);

  useEffect(() => {
    setHeatmapColumns([]);
  }, [symbol]);

  useEffect(() => {
    if (status !== "live") {
      return;
    }

    const captureHeatmapColumn = () => {
      const latestBids = latestBidsRef.current;
      const latestAsks = latestAsksRef.current;

      if (!latestBids.length || !latestAsks.length) {
        return;
      }

      setHeatmapColumns((columns) => [
        ...columns,
        buildHeatmapColumn(latestBids, latestAsks),
      ].slice(-HEATMAP_COLUMNS));
    };

    captureHeatmapColumn();
    const interval = window.setInterval(captureHeatmapColumn, HEATMAP_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [status]);

  return (
    <section className="grid gap-6">
      <NqFuturesSource />

      <Card className="overflow-hidden border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-slate-950 to-rose-500/10">
        <CardHeader>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Badge tone="blue">Step 2 live engine</Badge>
              <CardTitle className="mt-4 text-3xl font-black sm:text-4xl">
                Live Level 3 Order Flow Visualizer
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400 sm:text-base">
                Binance depth stream with snapshot-plus-delta synchronization,
                in-memory bid/ask maps, live spread, and microstructure imbalance.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Symbol
                <select
                  value={symbol}
                  disabled={isConnected}
                  onChange={(event) => setSymbol(event.target.value as SymbolOption)}
                  className="h-11 min-w-40 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-black text-white outline-none transition focus:border-cyan-300/60 disabled:opacity-60"
                >
                  {SYMBOLS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={isWorking}
                  onClick={() => {
                    if (isConnected) {
                      disconnect();
                    } else {
                      void connect();
                    }
                  }}
                  className={cn(
                    "h-11 min-w-44",
                    isConnected
                      ? "bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                      : "bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25",
                  )}
                >
                  {isWorking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isConnected ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isWorking ? "Syncing book" : isConnected ? "Disconnect" : "Connect to Binance"}
                </Button>
              </div>

              <div className="flex items-end">
                <div className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black">
                  <Circle className={cn("h-2.5 w-2.5 fill-current", statusTone(status))} />
                  <span className={statusTone(status)}>{getStatusCopy(status)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-3xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-black">Order book sync issue</div>
                <div className="mt-1 text-rose-100/80">{error}</div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 2xl:grid-cols-[1.25fr_0.95fr_0.72fr]">
            <EnginePanel
              asks={asks}
              bids={bids}
              heatmapColumns={heatmapColumns}
              maxCumulative={maxCumulative}
              metrics={metrics}
              status={status}
              symbol={symbol}
            />
            <OrderBookTable asks={asks} bids={bids} />
            <MetricsPanel
              lastEventTime={lastEventTime}
              lastUpdateId={lastUpdateId}
              metrics={metrics}
              status={status}
              venueName={venueName}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function EnginePanel({
  asks,
  bids,
  heatmapColumns,
  maxCumulative,
  metrics,
  status,
  symbol,
}: {
  asks: BookLevel[];
  bids: BookLevel[];
  heatmapColumns: HeatmapColumn[];
  maxCumulative: number;
  metrics: BookMetrics;
  status: ConnectionStatus;
  symbol: SymbolOption;
}) {
  const hasBook = asks.length > 0 && bids.length > 0;
  const depthRows = [...asks.slice(0, 8).reverse(), ...bids.slice(0, 8)];

  return (
    <Card className="overflow-hidden border-white/10 bg-black/35">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Market Liquidity Heatmap</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              Price x time resting liquidity. Heavy walls glow brighter; lighter
              positions fade into the tape.
            </p>
          </div>
          <Badge tone={status === "live" ? "win" : "neutral"}>{symbol}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasBook ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <MetricTile label="Best bid" value={formatPrice(metrics.bestBid)} tone="text-emerald-300" />
              <MetricTile label="Mid" value={formatPrice(metrics.midPrice)} tone="text-cyan-100" />
              <MetricTile label="Best ask" value={formatPrice(metrics.bestAsk)} tone="text-rose-300" />
            </div>

            <LiquidityHeatmap
              asks={asks}
              bids={bids}
              columns={heatmapColumns}
              status={status}
            />

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70">
              <div className="grid grid-cols-[0.9fr_1fr_0.9fr] bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                <span>Cum</span>
                <span className="text-center">Price</span>
                <span className="text-right">Resting</span>
              </div>
              {depthRows.map((level) => {
                const isAsk = level.price >= (metrics.midPrice ?? Number.POSITIVE_INFINITY);
                const width = `${Math.max(4, (level.cumulative / maxCumulative) * 100)}%`;

                return (
                  <div
                    key={`${isAsk ? "ask" : "bid"}-${level.price}`}
                    className="relative grid grid-cols-[0.9fr_1fr_0.9fr] items-center border-b border-white/[0.04] px-3 py-2 text-xs last:border-b-0"
                  >
                    <span
                      className={cn(
                        "absolute inset-y-1 rounded-xl opacity-45",
                        isAsk ? "right-1 bg-rose-500/30" : "left-1 bg-emerald-400/30",
                      )}
                      style={{ width }}
                    />
                    <span className="relative z-10 font-mono text-zinc-500">
                      {formatSize(level.cumulative)}
                    </span>
                    <span
                      className={cn(
                        "relative z-10 text-center font-mono font-black",
                        isAsk ? "text-rose-300" : "text-emerald-300",
                      )}
                    >
                      {formatPrice(level.price)}
                    </span>
                    <span className="relative z-10 text-right font-mono text-zinc-300">
                      {formatSize(level.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[480px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
            <RadioTower className="h-10 w-10 text-cyan-200/70" />
            <h3 className="mt-4 text-xl font-black text-white">Order book engine idle</h3>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              Select a crypto symbol and connect to Binance to load the REST depth
              snapshot, buffer WebSocket deltas, and publish a synchronized local book.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={cn("mt-2 font-mono text-lg font-black", tone)}>{value}</div>
    </div>
  );
}

function LiquidityHeatmap({
  asks,
  bids,
  columns,
  status,
}: {
  asks: BookLevel[];
  bids: BookLevel[];
  columns: HeatmapColumn[];
  status: ConnectionStatus;
}) {
  const rows = useMemo(() => buildHeatmapRows(bids, asks), [asks, bids]);
  const maxSize = useMemo(() => {
    const sizes = columns.flatMap((column) =>
      Object.values(column.cells).map((cell) => cell.size),
    );
    return Math.max(0.0000001, ...sizes);
  }, [columns]);
  const visibleColumns: HeatmapColumn[] = columns.length
    ? columns
    : Array.from({ length: HEATMAP_COLUMNS }, (_, index) => ({
        timestamp: Date.now() - (HEATMAP_COLUMNS - index) * HEATMAP_INTERVAL_MS,
        cells: {},
      }));

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/50 p-3">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Resting liquidity heatmap
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {columns.length
              ? `${columns.length} live snapshots at ${HEATMAP_INTERVAL_MS / 1000}s cadence`
              : status === "live"
                ? "Collecting live liquidity snapshots..."
                : "Connect to start collecting liquidity snapshots."}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-8 rounded-full bg-emerald-400/25" />
            Light
          </span>
          <span className="flex items-center gap-1 text-zinc-300">
            <span className="h-2.5 w-8 rounded-full bg-emerald-400/80 shadow-[0_0_14px_rgba(34,197,94,0.55)]" />
            Heavy
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[900px] gap-1"
          style={{
            gridTemplateColumns: `6rem repeat(${visibleColumns.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            Price
          </div>
          {visibleColumns.map((column, index) => (
            <div
              key={`time-${column.timestamp}-${index}`}
              className="truncate px-1 py-1 text-center text-[9px] font-bold text-zinc-600"
            >
              {index % 6 === 0 || index === visibleColumns.length - 1
                ? new Date(column.timestamp).toLocaleTimeString([], {
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : ""}
            </div>
          ))}

          {rows.map((row) => (
            <div key={`row-${row.side}-${row.price}`} className="contents">
              <div
                className={cn(
                  "flex items-center rounded-xl bg-white/[0.03] px-2 py-1 font-mono text-[10px] font-black",
                  row.side === "bid" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {formatPrice(row.price)}
              </div>
              {visibleColumns.map((column, index) => {
                const cell = column.cells[priceKey(row.price)];

                return (
                  <div
                    key={`${row.side}-${row.price}-${column.timestamp}-${index}`}
                    title={
                      cell
                        ? `${row.side.toUpperCase()} ${formatPrice(row.price)} size ${formatSize(cell.size)} @ ${new Date(column.timestamp).toLocaleTimeString()}`
                        : `${formatPrice(row.price)} no resting liquidity captured`
                    }
                    className="h-5 rounded-md transition duration-300"
                    style={heatmapCellStyle(cell, maxSize)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderBookTable({ asks, bids }: { asks: BookLevel[]; bids: BookLevel[] }) {
  return (
    <Card className="overflow-hidden border-white/10 bg-black/35">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>L3-style Order Book</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">Aggregated live price levels with cumulative depth.</p>
          </div>
          <ArrowDownUp className="h-5 w-5 text-cyan-200" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <div className="grid grid-cols-[0.9fr_0.9fr_0.9fr] bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Cum</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {asks.length || bids.length ? (
              <>
                {asks
                  .slice(0, 10)
                  .reverse()
                  .map((level) => (
                    <BookRow key={`ask-${level.price}`} level={level} side="ask" />
                  ))}
                <div className="bg-cyan-300/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                  Spread
                </div>
                {bids.slice(0, 10).map((level) => (
                  <BookRow key={`bid-${level.price}`} level={level} side="bid" />
                ))}
              </>
            ) : (
              <div className="px-4 py-16 text-center text-sm text-zinc-500">
                Connect to Binance to populate live order book levels.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookRow({ level, side }: { level: BookLevel; side: "bid" | "ask" }) {
  return (
    <div className="grid grid-cols-[0.9fr_0.9fr_0.9fr] px-3 py-2 font-mono text-xs">
      <span className={side === "bid" ? "text-emerald-300" : "text-rose-300"}>
        {formatPrice(level.price)}
      </span>
      <span className="text-right text-zinc-300">{formatSize(level.size)}</span>
      <span className="text-right text-zinc-500">{formatSize(level.cumulative)}</span>
    </div>
  );
}

function MetricsPanel({
  lastEventTime,
  lastUpdateId,
  metrics,
  status,
  venueName,
}: {
  lastEventTime: number | null;
  lastUpdateId: number | null;
  metrics: BookMetrics;
  status: ConnectionStatus;
  venueName: string | null;
}) {
  const imbalanceWidth = `${Math.min(100, Math.max(0, ((metrics.imbalance + 100) / 200) * 100))}%`;

  return (
    <div className="grid gap-4">
      <Card className="border-white/10 bg-black/35">
        <CardHeader>
          <CardTitle>Microstructure Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <MetricTile
            label="Spread"
            tone="text-cyan-100"
            value={
              metrics.spread === null
                ? "--"
                : `${formatPrice(metrics.spread)} / ${metrics.spreadBps?.toFixed(2)} bps`
            }
          />
          <MetricTile label="Bid depth" tone="text-emerald-300" value={formatSize(metrics.bidDepth)} />
          <MetricTile label="Ask depth" tone="text-rose-300" value={formatSize(metrics.askDepth)} />

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              <span>Imbalance</span>
              <span className={metrics.imbalance >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {formatSignedPercent(metrics.imbalance)}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-rose-400/25">
              <div className="h-full rounded-full bg-emerald-400/80" style={{ width: imbalanceWidth }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-black/35">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Engine Health</CardTitle>
            <Activity className={cn("h-5 w-5", statusTone(status))} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2">
            <span className="text-zinc-500">Status</span>
            <span className={cn("font-black", statusTone(status))}>{getStatusCopy(status)}</span>
          </div>
          <div className="flex justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2">
            <span className="text-zinc-500">Venue</span>
            <span className="font-semibold text-zinc-200">{venueName ?? "--"}</span>
          </div>
          <div className="flex justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2">
            <span className="text-zinc-500">Update ID</span>
            <span className="font-mono font-semibold text-zinc-200">{lastUpdateId ?? "--"}</span>
          </div>
          <div className="flex justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-2">
            <span className="text-zinc-500">Last event</span>
            <span className="font-mono font-semibold text-zinc-200">
              {lastEventTime ? new Date(lastEventTime).toLocaleTimeString() : "--"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-300/20 bg-yellow-300/10">
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-yellow-50">
            <ShieldAlert className="h-4 w-4" />
            Large order walls
          </div>
          {metrics.walls.length ? (
            metrics.walls.map((wall) => (
              <div key={`${wall.side}-${wall.price}`} className="flex justify-between gap-3 text-xs">
                <span className={wall.side === "bid" ? "text-emerald-200" : "text-rose-200"}>
                  {wall.side.toUpperCase()} {formatPrice(wall.price)}
                </span>
                <span className="font-mono text-yellow-50">{formatSize(wall.size)}</span>
              </div>
            ))
          ) : (
            <div className="text-sm text-yellow-50/70">
              No 2x local liquidity walls detected in the visible book.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-300/20 bg-cyan-300/10">
        <CardContent className="flex items-center gap-3 text-sm text-cyan-50">
          <RefreshCcw className="h-5 w-5" />
          Sequence gaps trigger an automatic REST snapshot re-sync before the book
          returns to live mode.
        </CardContent>
      </Card>
    </div>
  );
}
