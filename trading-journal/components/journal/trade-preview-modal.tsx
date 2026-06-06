"use client";

import { format, parseISO } from "date-fns";
import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { ScreenshotGallery } from "@/components/journal/screenshot-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openTradeJournalInNewTab } from "@/lib/journal-navigation";
import type { Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type TradePreviewModalProps = {
  trade: Trade | null;
  onClose: () => void;
};

export function TradePreviewModal({ trade, onClose }: TradePreviewModalProps) {
  useEffect(() => {
    if (!trade) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, trade]);

  if (!trade) {
    return null;
  }

  const screenshots =
    trade.screenshots?.map((shot) => ({
      key: shot.url,
      url: shot.url,
      name: shot.name,
    })) ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Trade preview ${trade.pair}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-300/25 bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-white">{trade.pair}</h2>
              <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {format(parseISO(trade.date), "EEEE, MMM d, yyyy")} · {trade.position} ·{" "}
              {trade.strategy}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10"
            aria-label="Close trade preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.05] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Return</div>
              <div
                className={cn(
                  "mt-2 text-2xl font-black",
                  trade.profitPercent >= 0 ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {formatPercent(trade.profitPercent)}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.05] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Profit</div>
              <div
                className={cn(
                  "mt-2 text-2xl font-black",
                  trade.profitAmount >= 0 ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {formatMoney(trade.profitAmount)}
              </div>
            </div>
          </div>

          {trade.journalHtml ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Journal
              </div>
              <div
                className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-200 prose-p:my-2 prose-ul:my-2"
                dangerouslySetInnerHTML={{ __html: trade.journalHtml }}
              />
            </div>
          ) : null}

          {screenshots.length > 0 ? (
            <div className="grid gap-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Screenshots
              </div>
              <ScreenshotGallery items={screenshots} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              onClick={() => openTradeJournalInNewTab(trade.id)}
              className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            >
              <ExternalLink className="h-4 w-4" />
              Open in journal
            </Button>
            <Button type="button" onClick={onClose} className="bg-white/5 text-zinc-100">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
