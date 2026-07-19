"use client";

import { format } from "date-fns";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { deleteJournalEntry, saveJournalEntry } from "@/app/actions/journal";
import { ScreenshotGallery } from "@/components/journal/screenshot-gallery";
import {
  JournalLevelPushesEditor,
  type LevelPushFormRow,
} from "@/components/journal/journal-level-pushes-editor";
import { RichTextEditor } from "@/components/journal/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import {
  JOURNAL_PAIR_OPTIONS,
  SYSTEM_JOURNAL_STRATEGIES,
  TRADE_SELF_RATING_FIELDS,
  TRADE_SELF_RATINGS,
  TRADE_SPECIES,
  isSystemJournalStrategy,
  type JournalEntryInput,
  type JournalScreenshotUpload,
  type TradeLevelPushInput,
  type TradeScreenshot,
  type TradeSelfRating,
  type TradeSpecies,
} from "@/lib/journal-constants";
import { useJournalStrategies } from "@/lib/hooks/use-journal-strategies";
import {
  decimalInputString,
  parseOptionalDecimalInput,
  parseRequiredDecimalInput,
} from "@/lib/decimal-input";
import { useCustomWatchlist } from "@/lib/hooks/use-custom-watchlist";
import type { Trade, TradeOutcome } from "@/lib/trades";
import { cn } from "@/lib/utils";

type PendingScreenshot = {
  id: string;
  name: string;
  previewUrl: string;
  dataUrl: string;
};

type JournalFormState = Omit<
  JournalEntryInput,
  | "profitPercent"
  | "profitAmount"
  | "stopLoss"
  | "takeProfit"
  | "riskRewardRatio"
  | "entryPoint"
  | "levelPushes"
> & {
  profitPercent: string;
  profitAmount: string;
  stopLoss: string;
  takeProfit: string;
  riskRewardRatio: string;
  entryPoint: string;
  levelPushes: LevelPushFormRow[];
};

type JournalEntryFormProps = {
  mode: "create" | "edit";
  trade?: Trade | null;
  canUsePersonalJournal?: boolean;
  demoTradesEnabled?: boolean;
  onCancel: () => void;
  onSaved: (trade: Trade) => void;
  onDeleted?: () => void;
};

function emptyForm(): JournalFormState {
  return {
    pair: "BTC-USD",
    date: format(new Date(), "yyyy-MM-dd"),
    strategy: "BouncyBall Breakout",
    species: "Stocks",
    outcome: "WIN",
    profitPercent: "0",
    profitAmount: "0",
    position: "LONG",
    stopLoss: "",
    takeProfit: "",
    riskRewardRatio: "",
    entryPoint: "",
    ratingOverall: null,
    ratingSizing: null,
    ratingEntry: null,
    ratingExit: null,
    levelPushes: [],
    journalHtml: "",
    screenshots: [],
  };
}

function tradeToForm(trade: Trade): JournalFormState {
  return {
    id: trade.id,
    pair: trade.pair,
    date: trade.date,
    strategy: trade.strategy,
    species: trade.species ?? "Stocks",
    outcome: trade.outcome,
    profitPercent: decimalInputString(trade.profitPercent),
    profitAmount: decimalInputString(trade.profitAmount),
    position: trade.position,
    stopLoss: decimalInputString(trade.stopLoss),
    takeProfit: decimalInputString(trade.takeProfit),
    riskRewardRatio: decimalInputString(trade.riskRewardRatio),
    entryPoint: decimalInputString(trade.entryPoint),
    ratingOverall: trade.ratingOverall ?? null,
    ratingSizing: trade.ratingSizing ?? null,
    ratingEntry: trade.ratingEntry ?? null,
    ratingExit: trade.ratingExit ?? null,
    levelPushes:
      trade.levelPushes?.map((push) => ({
        id: push.id,
        clientId: push.id,
        levelType: push.levelType,
        price: decimalInputString(push.price),
        pushedAt: push.pushedAt,
        note: push.note ?? "",
      })) ?? [],
    journalHtml: trade.journalHtml ?? "",
    screenshots: trade.screenshots ?? [],
  };
}

function parseForm(
  form: JournalFormState,
): { ok: true; entry: JournalEntryInput } | { ok: false; message: string } {
  const profitPercent = parseRequiredDecimalInput(form.profitPercent, "Profit %");
  if (!profitPercent.ok) {
    return profitPercent;
  }

  const profitAmount = parseRequiredDecimalInput(form.profitAmount, "Profit amount");
  if (!profitAmount.ok) {
    return profitAmount;
  }

  const stopLoss = parseOptionalDecimalInput(form.stopLoss);
  if (form.stopLoss.trim() && stopLoss === null) {
    return { ok: false, message: "Stop loss must be a valid number." };
  }

  const takeProfit = parseOptionalDecimalInput(form.takeProfit);
  if (form.takeProfit.trim() && takeProfit === null) {
    return { ok: false, message: "Take profit must be a valid number." };
  }

  const riskRewardRatio = parseOptionalDecimalInput(form.riskRewardRatio);
  if (form.riskRewardRatio.trim() && riskRewardRatio === null) {
    return { ok: false, message: "Risk reward must be a valid number." };
  }

  const entryPoint = parseOptionalDecimalInput(form.entryPoint);
  if (form.entryPoint.trim() && entryPoint === null) {
    return { ok: false, message: "Entry point must be a valid number." };
  }

  const levelPushes: TradeLevelPushInput[] = [];
  for (const [index, push] of form.levelPushes.entries()) {
    const price = parseOptionalDecimalInput(push.price);
    if (price === null) {
      return { ok: false, message: `Push record ${index + 1} needs a valid price.` };
    }
    levelPushes.push({
      id: push.id,
      clientId: push.clientId,
      levelType: push.levelType,
      price,
      pushedAt: push.pushedAt,
      note: push.note,
    });
  }

  return {
    ok: true,
    entry: {
      id: form.id,
      pair: form.pair,
      date: form.date,
      strategy: form.strategy,
      species: form.species,
      outcome: form.outcome,
      profitPercent: profitPercent.value,
      profitAmount: profitAmount.value,
      position: form.position,
      stopLoss,
      takeProfit,
      riskRewardRatio,
      entryPoint,
      ratingOverall: form.ratingOverall,
      ratingSizing: form.ratingSizing,
      ratingEntry: form.ratingEntry,
      ratingExit: form.ratingExit,
      levelPushes,
      journalHtml: form.journalHtml,
      screenshots: form.screenshots,
    },
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
  canUsePersonalJournal = true,
  demoTradesEnabled = false,
  onCancel,
  onSaved,
  onDeleted,
}: JournalEntryFormProps) {
  const { customStrategies } = useJournalStrategies(canUsePersonalJournal && !demoTradesEnabled);
  const { items: customWatchlist } = useCustomWatchlist();
  const [form, setForm] = useState<JournalFormState>(() =>
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

  function updateField<K extends keyof JournalFormState>(key: K, value: JournalFormState[K]) {
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
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }

    startTransition(async () => {
      const result = await saveJournalEntry(parsed.entry, uploads);
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
    <Card className="sticky top-4 h-fit overflow-hidden border-cyan-300/20 lg:static lg:h-auto">
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
            Species
            <select
              value={form.species}
              onChange={(event) => updateField("species", event.target.value as TradeSpecies)}
              className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
            >
              {TRADE_SPECIES.map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-zinc-300">
          Strategy
          <select
            value={form.strategy}
            onChange={(event) => updateField("strategy", event.target.value)}
            className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
          >
            <optgroup label="System defaults">
              {SYSTEM_JOURNAL_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </optgroup>
            {customStrategies.length > 0 ? (
              <optgroup label="Your strategies">
                {customStrategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.name}>
                    {strategy.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {!isSystemJournalStrategy(form.strategy) &&
            !customStrategies.some((strategy) => strategy.name === form.strategy) ? (
              <option value={form.strategy}>{form.strategy}</option>
            ) : null}
          </select>
        </label>

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
          <label className="grid gap-1 text-sm font-semibold text-zinc-300 sm:col-span-2">
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Profit %
            <DecimalInput
              value={form.profitPercent}
              onChange={(event) => updateField("profitPercent", event.target.value)}
              className="bg-zinc-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            Profit amount ($)
            <DecimalInput
              value={form.profitAmount}
              onChange={(event) => updateField("profitAmount", event.target.value)}
              className="bg-zinc-950"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            EP (optional)
            <DecimalInput
              value={form.entryPoint}
              onChange={(event) => updateField("entryPoint", event.target.value)}
              className="bg-zinc-950"
              placeholder="Entry point"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            SL (optional)
            <DecimalInput
              value={form.stopLoss}
              onChange={(event) => updateField("stopLoss", event.target.value)}
              className="bg-zinc-950"
              placeholder="Stop loss"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            TP (optional)
            <DecimalInput
              value={form.takeProfit}
              onChange={(event) => updateField("takeProfit", event.target.value)}
              className="bg-zinc-950"
              placeholder="Take profit"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            RR (optional)
            <DecimalInput
              value={form.riskRewardRatio}
              onChange={(event) => updateField("riskRewardRatio", event.target.value)}
              className="bg-zinc-950"
              placeholder="Risk reward"
            />
          </label>
        </div>

        <JournalLevelPushesEditor
          pushes={form.levelPushes}
          onChange={(levelPushes) => updateField("levelPushes", levelPushes)}
        />

        <div className="grid gap-3">
          <div>
            <span className="text-sm font-semibold text-zinc-300">Self-rated ranking</span>
            <p className="mt-1 text-xs text-zinc-500">Optional grades for process quality.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRADE_SELF_RATING_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm font-semibold text-zinc-300">
                {field.label}
                <select
                  value={form[field.key] ?? ""}
                  onChange={(event) =>
                    updateField(
                      field.key,
                      (event.target.value || null) as TradeSelfRating | null,
                    )
                  }
                  className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="">Not rated</option>
                  {TRADE_SELF_RATINGS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

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
