"use client";

import { useMemo, useState } from "react";

import type { ComputedPosition, PortfolioSnapshot, TakeProfitPreview } from "@/lib/ls-portfolio-types";
import {
  calculateRebalancePreview,
  calculateTakeProfitPreview,
  formatCurrency,
  formatPercent,
  formatQuantity,
} from "@/lib/ls-portfolio";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_TICKER_OPTIONS } from "@/lib/ticker-symbols";
import { cn } from "@/lib/utils";

type TakeProfitModalProps = {
  open: boolean;
  position: ComputedPosition | null;
  snapshot: PortfolioSnapshot;
  onClose: () => void;
  onConfirm: (payload: { position_id: string; sell_pct?: number; sell_qty?: number }) => Promise<void>;
  loading: boolean;
};

export function TakeProfitModal({
  open,
  position,
  snapshot,
  onClose,
  onConfirm,
  loading,
}: TakeProfitModalProps) {
  const [sellPct, setSellPct] = useState(30);
  const [sellQty, setSellQty] = useState<number | "">("");

  const preview = useMemo<TakeProfitPreview | null>(() => {
    if (!position) {
      return null;
    }
    return calculateTakeProfitPreview(position, snapshot.portfolio, snapshot.positions, {
      sell_pct: sellQty === "" ? sellPct : undefined,
      sell_qty: sellQty === "" ? undefined : Number(sellQty),
    });
  }, [position, sellPct, sellQty, snapshot]);

  if (!position || !preview) {
    return null;
  }

  return (
    <Modal open={open} onClose={onClose} title={`Take Profit — ${position.symbol}`} wide>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              % of position to close
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={sellPct}
              onChange={(e) => {
                setSellPct(Number(e.target.value));
                setSellQty("");
              }}
              className="mt-2 w-full accent-emerald-400"
            />
            <div className="mt-1 font-mono text-sm text-zinc-300">{sellPct}%</div>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Or qty to close
            <Input
              type="number"
              step="0.0001"
              value={sellQty}
              onChange={(e) =>
                setSellQty(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder={`Max ${formatQuantity(position.quantity)}`}
              className="bg-zinc-900 font-mono"
            />
          </label>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-400">
            Closing {formatQuantity(preview.sell_qty)} of {formatQuantity(position.quantity)}{" "}
            {position.side} · {formatQuantity(preview.remaining_qty)} remaining
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Live preview
          </div>
          <PreviewRow
            label="Realized P&L"
            value={formatCurrency(preview.realized_pnl)}
            positive={preview.realized_pnl >= 0}
          />
          <PreviewRow
            label="Cash impact"
            value={formatCurrency(preview.cash_delta)}
            positive={preview.cash_delta >= 0}
          />
          <PreviewRow
            label="Long pool"
            value={`${formatCurrency(preview.before.long_pool)} → ${formatCurrency(preview.after.long_pool)}`}
          />
          <PreviewRow
            label="Short pool"
            value={`${formatCurrency(preview.before.short_pool)} → ${formatCurrency(preview.after.short_pool)}`}
          />
          <PreviewRow
            label="Long %"
            value={`${formatPercent(preview.before.current_long_pct * 100, 1)} → ${formatPercent(preview.after.current_long_pct * 100, 1)}`}
          />
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${preview.after.current_long_pct * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={loading || preview.sell_qty <= 0}
          onClick={() =>
            void onConfirm({
              position_id: position.id,
              sell_pct: sellQty === "" ? sellPct : undefined,
              sell_qty: sellQty === "" ? undefined : Number(sellQty),
            })
          }
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
        >
          {loading ? "Processing…" : "Confirm take profit"}
        </Button>
        <Button type="button" onClick={onClose} className="bg-white/5 text-zinc-100">
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function PreviewRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          positive === true && "text-emerald-300",
          positive === false && "text-rose-300",
          positive === undefined && "text-zinc-100",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export type AddPositionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  loading: boolean;
};

export function AddPositionModal({ open, onClose, onSubmit, loading }: AddPositionModalProps) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [bookType, setBookType] = useState<"core" | "tactical">("tactical");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entry, setEntry] = useState("");
  const [current, setCurrent] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    await onSubmit({
      side,
      book_type: bookType,
      symbol,
      quantity: Number(quantity),
      avg_entry_price: Number(entry),
      current_price: Number(current || entry),
      stop_loss_price: stop ? Number(stop) : null,
      target_price: target ? Number(target) : null,
      notes: notes || null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add position">
      <div className="grid gap-4">
        <div className="flex gap-2">
          {(["long", "short"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSide(value)}
              className={cn(
                "flex-1 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition",
                side === value && value === "long" && "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
                side === value && value === "short" && "border-rose-400/50 bg-rose-500/15 text-rose-100",
                side !== value && "border-white/10 text-zinc-400",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["core", "tactical"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBookType(value)}
              className={cn(
                "flex-1 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition",
                bookType === value && value === "core" && "border-amber-400/50 bg-amber-500/15 text-amber-100",
                bookType === value && value === "tactical" && "border-violet-400/50 bg-violet-500/15 text-violet-100",
                bookType !== value && "border-white/10 text-zinc-400",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-semibold text-zinc-300">
          Symbol
          <Input
            list="ls-portfolio-tickers"
            value={symbol}
            placeholder="TSLA"
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="bg-zinc-900 font-mono uppercase"
          />
          <datalist id="ls-portfolio-tickers">
            {ALL_TICKER_OPTIONS.map((ticker) => (
              <option key={ticker} value={ticker} />
            ))}
          </datalist>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantity" value={quantity} onChange={setQuantity} type="number" />
          <Field label="Avg entry $" value={entry} onChange={setEntry} type="number" />
          <Field label="Current $" value={current} onChange={setCurrent} type="number" placeholder="= entry" />
          <Field label="Stop $" value={stop} onChange={setStop} type="number" />
          <Field label="Target $" value={target} onChange={setTarget} type="number" />
        </div>
        <label className="grid gap-1 text-sm font-semibold text-zinc-300">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-20 rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <Button
          type="button"
          disabled={loading}
          onClick={() => void handleSubmit()}
          className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
        >
          {loading ? "Adding…" : "Add position"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-zinc-300">
      {label}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 font-mono"
      />
    </label>
  );
}

export type RebalanceModalProps = {
  open: boolean;
  snapshot: PortfolioSnapshot;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
};

export function RebalanceModal({ open, snapshot, onClose, onConfirm, loading }: RebalanceModalProps) {
  const preview = useMemo(
    () => calculateRebalancePreview(snapshot.portfolio, snapshot.positions),
    [snapshot],
  );

  return (
    <Modal open={open} onClose={onClose} title="Rebalance pools" wide>
      <div className="grid gap-4">
        <p className="text-sm text-zinc-400">
          Transfer cash between Long and Short pools to hit your{" "}
          {formatPercent(snapshot.portfolio.target_long_ratio * 100, 0)} /{" "}
          {formatPercent(snapshot.portfolio.target_short_ratio * 100, 0)} target. Positions are
          unchanged.
        </p>
        {preview.direction === "none" ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">
            Portfolio is already at target ratio.
          </div>
        ) : (
          <div className="grid gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
            <PreviewRow
              label="Suggested transfer"
              value={`${formatCurrency(preview.transfer_amount)} ${preview.direction === "long_to_short" ? "Long → Short" : "Short → Long"}`}
            />
            <PreviewRow
              label="Long pool after"
              value={`${formatCurrency(preview.before.long_pool)} → ${formatCurrency(preview.after.long_pool)}`}
            />
            <PreviewRow
              label="Short pool after"
              value={`${formatCurrency(preview.before.short_pool)} → ${formatCurrency(preview.after.short_pool)}`}
            />
            <PreviewRow
              label="Long % after"
              value={formatPercent(preview.after.current_long_pct * 100, 1)}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={loading || preview.direction === "none"}
            onClick={() => void onConfirm()}
            className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
          >
            {loading ? "Rebalancing…" : "Execute rebalance"}
          </Button>
          <Button type="button" onClick={onClose} className="bg-white/5 text-zinc-100">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
