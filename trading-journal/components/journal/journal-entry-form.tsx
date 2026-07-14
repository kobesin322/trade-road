"use client";

import { format } from "date-fns";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { deleteJournalEntry, saveJournalEntry } from "@/app/actions/journal";
import { ScreenshotGallery } from "@/components/journal/screenshot-gallery";
import { RichTextEditor } from "@/components/journal/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  JOURNAL_PAIR_OPTIONS,
  JOURNAL_STRATEGIES,
  type JournalEntryInput,
  type JournalScreenshotUpload,
  type JournalStrategy,
  type TradeScreenshot,
} from "@/lib/journal-constants";
import { useCustomWatchlist } from "@/lib/hooks/use-custom-watchlist";
import type { Trade, TradeOutcome } from "@/lib/trades";
import { cn } from "@/lib/utils";

type PendingScreenshot = {
  id: string;
  name: string;
  previewUrl: string;
  dataUrl: string;
};

type JournalEntryFormProps = {
  mode: "create" | "edit";
  trade?: Trade | null;
  onCancel: () => void;
  onSaved: (trade: Trade) => void;
  onDeleted?: () => void;
};

function emptyForm(): JournalEntryInput {
  return {
    pair: "BTC-USD",
    date: format(new Date(), "yyyy-MM-dd"),
    strategy: "BouncyBall Breakout",
    outcome: "WIN",
    profitPercent: 0,
    profitAmount: 0,
    position: "LONG",
    journalHtml: "",
    screenshots: [],
  };
}

function tradeToForm(trade: Trade): JournalEntryInput {
  return {
    id: trade.id,
    pair: trade.pair,
    date: trade.date,
    strategy: trade.strategy,
    outcome: trade.outcome,
    profitPercent: trade.profitPercent,
    profitAmount: trade.profitAmount,
    position: trade.position,
    journalHtml: trade.journalHtml ?? "",
    screenshots: trade.screenshots ?? [],
  };
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read screenshot."));
    reader.readAsDataURL(file);
  });
}

export function JournalEntryForm({
  mode,
  trade,
  onCancel,
  onSaved,
  onDeleted,
}: JournalEntryFormProps) {
  const { items: customWatchlist } = useCustomWatchlist();
  const [form, setForm] = useState<JournalEntryInput>(() =>
    trade ? tradeToForm(trade) : emptyForm(),
  );
  const [pendingScreenshots, setPendingScreenshots] = useState<PendingScreenshot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(trade ? tradeToForm(trade) : emptyForm());
    setPendingScreenshots([]);
    setMessage(null);
  }, [trade, mode]);

  const totalScreenshots = form.screenshots.length + pendingScreenshots.length;

  const uploads = useMemo<JournalScreenshotUpload[]>(
    () =>
      pendingScreenshots.map((shot) => ({
        name: shot.name,
        dataUrl: shot.dataUrl,
      })),
    [pendingScreenshots],
  );

  const pairOptions = useMemo(
    () => [
      ...JOURNAL_PAIR_OPTIONS,
      ...(customWatchlist.length
        ? [
            {
              group: "Your Watchlist",
              symbols: customWatchlist.map((item) => item.yahooSymbol),
            },
          ]
        : []),
    ],
    [customWatchlist],
  );

  function updateField<K extends keyof JournalEntryInput>(key: K, value: JournalEntryInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function removeExistingScreenshot(target: TradeScreenshot) {
    updateField(
      "screenshots",
      form.screenshots.filter((shot) => shot.url !== target.url),
    );
  }

  function removePendingScreenshot(id: string) {
    setPendingScreenshots((current) => {
      const next = current.filter((shot) => shot.id !== id);
      const removed = current.find((shot) => shot.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  async function onPickScreenshots(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    if (totalScreenshots + files.length > 6) {
      setMessage("You can attach up to 6 screenshots per journal entry.");
      return;
    }

    const nextPending: PendingScreenshot[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      nextPending.push({
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        dataUrl,
      });
    }

    setPendingScreenshots((current) => [...current, ...nextPending]);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveJournalEntry(form, uploads);
      setMessage(result.message);
      if (result.ok) {
        onSaved(result.trade);
      }
    });
  }

  function handleDelete() {
    if (!form.id) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await deleteJournalEntry(form.id!);
      setMessage(result.message);
      if (result.ok) {
        onDeleted?.();
      }
    });
  }

  return (
    <Card className="sticky top-4 h-fit overflow-hidden border-cyan-300/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{mode === "create" ? "Create journal" : "Edit journal"}</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              One journal entry per trade. Pair options include your saved watchlist tickers.
            </p>
          </div>
          <Button type="button" onClick={onCancel} className="h-9 w-9 bg-white/5 p-0 text-zinc-200">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="grid gap-1 text-sm font-semibold text-zinc-300">
          Pair / ticker
          <select
            value={form.pair}
            onChange={(event) => updateField("pair", event.target.value)}
            className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
          >
            {pairOptions.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.symbols.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Date
            <Input
              type="date"
              value={form.date}
              onChange={(event) => updateField("date", event.target.value)}
              className="bg-zinc-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Strategy
            <select
              value={form.strategy}
              onChange={(event) => updateField("strategy", event.target.value as JournalStrategy)}
              className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
            >
              {JOURNAL_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Outcome
            <select
              value={form.outcome}
              onChange={(event) => updateField("outcome", event.target.value as TradeOutcome)}
              className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
            >
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Position
            <select
              value={form.position}
              onChange={(event) => updateField("position", event.target.value as "LONG" | "SHORT")}
              className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Profit %
            <Input
              type="number"
              step="0.1"
              value={form.profitPercent}
              onChange={(event) => updateField("profitPercent", Number(event.target.value))}
              className="bg-zinc-950"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-zinc-300">
          Profit amount ($)
          <Input
            type="number"
            step="1"
            value={form.profitAmount}
            onChange={(event) => updateField("profitAmount", Number(event.target.value))}
            className="bg-zinc-950"
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-300">Screenshots (optional)</span>
            <Badge tone="neutral">{totalScreenshots}/6</Badge>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
            <ImagePlus className="h-4 w-4" />
            Add screenshot(s)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => void onPickScreenshots(event)}
            />
          </label>
          {(form.screenshots.length > 0 || pendingScreenshots.length > 0) && (
            <ScreenshotGallery
              items={[
                ...form.screenshots.map((shot) => ({
                  key: shot.url,
                  url: shot.url,
                  name: shot.name,
                })),
                ...pendingScreenshots.map((shot) => ({
                  key: shot.id,
                  url: shot.previewUrl,
                  name: shot.name,
                })),
              ]}
              onRemove={(key) => {
                const existing = form.screenshots.find((shot) => shot.url === key);
                if (existing) {
                  removeExistingScreenshot(existing);
                  return;
                }
                removePendingScreenshot(key);
              }}
            />
          )}
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-300">Journal notes</span>
          <RichTextEditor
            value={form.journalHtml}
            onChange={(html) => updateField("journalHtml", html)}
            placeholder="Setup, trigger, emotions, lessons learned..."
          />
        </div>

        {message ? (
          <p
            className={cn(
              "text-sm",
              message.includes("created") || message.includes("updated")
                ? "text-emerald-300"
                : "text-amber-200",
            )}
          >
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Save journal" : "Update journal"}
          </Button>
          {mode === "edit" && form.id ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
