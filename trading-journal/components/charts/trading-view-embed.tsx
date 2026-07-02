"use client";

import { useEffect, useId, useRef } from "react";

type TradingViewWidget = new (options: Record<string, unknown>) => void;

declare global {
  interface Window {
    TradingView?: {
      widget: TradingViewWidget;
    };
  }
}

let tradingViewScriptPromise: Promise<void> | null = null;

function loadTradingViewScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.TradingView?.widget) {
    return Promise.resolve();
  }

  if (tradingViewScriptPromise) {
    return tradingViewScriptPromise;
  }

  tradingViewScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-traderoad-tv="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TradingView script failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.dataset.traderoadTv = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed to load."));
    document.body.appendChild(script);
  });

  return tradingViewScriptPromise;
}

type TradingViewEmbedProps = {
  symbol: string;
  interval?: string;
  className?: string;
  hideSideToolbar?: boolean;
  hideTopToolbar?: boolean;
};

export function TradingViewEmbed({
  symbol,
  interval = "15",
  className,
  hideSideToolbar = false,
  hideTopToolbar = false,
}: TradingViewEmbedProps) {
  const reactId = useId();
  const containerId = `traderoad-tv-${reactId.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    void loadTradingViewScript()
      .then(() => {
        if (cancelled || !container || !window.TradingView?.widget) {
          return;
        }

        container.innerHTML = "";
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: hideSideToolbar,
          hide_top_toolbar: hideTopToolbar,
          withdateranges: true,
          details: !hideTopToolbar,
          hotlist: false,
          calendar: false,
          container_id: containerId,
        });
      })
      .catch(() => {
        if (container) {
          container.innerHTML =
            '<div class="flex h-full items-center justify-center text-sm text-zinc-400">TradingView chart unavailable.</div>';
        }
      });

    return () => {
      cancelled = true;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [containerId, hideSideToolbar, hideTopToolbar, interval, symbol]);

  return <div id={containerId} ref={containerRef} className={className ?? "h-[420px] w-full"} />;
}
