"use client";

import { format, parseISO } from "date-fns";
import { BookOpen, ExternalLink, Eye, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { removeDailyOverview, saveDailyOverview } from "@/app/actions/daily-overview";
import {
  formatOverviewDayLabel,
  OverviewDatePicker,
} from "@/components/journal/overview-date-picker";
import { RichTextEditor } from "@/components/journal/rich-text-editor";
import { DailyOverviewMistakesPanel } from "@/components/journal/daily-overview-mistakes-panel";
import {
  PendingScreenshot,
  readFileAsDataUrl,
  ScreenshotPicker,
} from "@/components/journal/screenshot-picker";
import { TradePreviewModal } from "@/components/journal/trade-preview-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyOverview } from "@/lib/daily-overview-types";
import { overviewHasContent } from "@/lib/daily-overview-utils";
import { countMistakes } from "@/lib/trading-mistakes";
import { openTradeJournalInNewTab } from "@/lib/journal-navigation";
import type { TradeScreenshot } from "@/lib/journal-constants";
import type { Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

const MAX_SCREENSHOTS_PER_SECTION = 6;

type DailyOverviewPanelProps = {
  canUsePersonalJournal: boolean;
  personalTrades: Trade[];
  dailyOverviews: DailyOverview[];
  initialDate?: string;
  onDateChange?: (date: string) => void;
  onSaved: () => void;
};

function emptyFields() {
  return {
    tradePerformanceHtml: "",
    preTradeListHtml: "",
    marketAnalysisHtml: "",
    preTradeListScreenshots: [] as TradeScreenshot[],
    marketAnalysisScreenshots: [] as TradeScreenshot[],
    mistakeFlags: [] as string[],
    mistakesNotes: "",
    linkedTradeIds: [] as string[],
  };
}

function overviewToFields(overview: DailyOverview | undefined) {
  if (!overview) {
    return emptyFields();
  }
  return {
    tradePerformanceHtml: overview.tradePerformanceHtml ?? "",
    preTradeListHtml: overview.preTradeListHtml ?? "",
    marketAnalysisHtml: overview.marketAnalysisHtml ?? "",
    preTradeListScreenshots: [...overview.preTradeListScreenshots],
    marketAnalysisScreenshots: [...overview.marketAnalysisScreenshots],
    mistakeFlags: [...overview.mistakeFlags],
    mistakesNotes: overview.mistakesNotes ?? "",
    linkedTradeIds: [...overview.linkedTradeIds],
  };
}

export function DailyOverviewPanel({
  canUsePersonalJournal,
  personalTrades,
  dailyOverviews,
  initialDate,
  onDateChange,
  onSaved,
}: DailyOverviewPanelProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(initialDate ?? today);
  const [fields, setFields] = useState(emptyFields);
  const [pendingPreTradeScreenshots, setPendingPreTradeScreenshots] = useState<PendingScreenshot[]>(
    [],
  );
  const [pendingMarketScreenshots, setPendingMarketScreenshots] = useState<PendingScreenshot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [isPending, startTransition] = useTransition();

  const overviewByDate = useMemo(
    () => new Map(dailyOverviews.map((overview) => [overview.date, overview])),
    [dailyOverviews],
  );

  const currentOverview = overviewByDate.get(selectedDate);

  const tradesOnDate = useMemo(
    () => personalTrades.filter((trade) => trade.date === selectedDate),
    [personalTrades, selectedDate],
  );

  const sortedOverviewDates = useMemo(
    () => [...dailyOverviews].sort((a, b) => b.date.localeCompare(a.date)),
    [dailyOverviews],
  );

  const tradeDates = useMemo(
    () => [...new Set(personalTrades.map((trade) => trade.date))],
    [personalTrades],
  );

  const dayTradesCount = tradesOnDate.length;

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    setFields(overviewToFields(currentOverview));
    setPendingPreTradeScreenshots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.previewUrl));
      return [];
    });
    setPendingMarketScreenshots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.previewUrl));
      return [];
    });
    setMessage(null);
  }, [selectedDate, currentOverview]);

  const disabled = !canUsePersonalJournal;

  function selectDate(date: string) {
    setSelectedDate(date);
    onDateChange?.(date);
  }

  function removePendingScreenshot(
    section: "pre-trade" | "market",
    id: string,
  ) {
    const setter =
      section === "pre-trade" ? setPendingPreTradeScreenshots : setPendingMarketScreenshots;
    setter((current) => {
      const next = current.filter((shot) => shot.id !== id);
      const removed = current.find((shot) => shot.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  async function onPickScreenshots(
    section: "pre-trade" | "market",
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) {
      return;
    }

    const existing =
      section === "pre-trade"
        ? fields.preTradeListScreenshots
        : fields.marketAnalysisScreenshots;
    const pending =
      section === "pre-trade" ? pendingPreTradeScreenshots : pendingMarketScreenshots;

    if (existing.length + pending.length + files.length > MAX_SCREENSHOTS_PER_SECTION) {
      setMessage(
        section === "pre-trade"
          ? "You can attach up to 6 screenshots in the pre-trade list section."
          : "You can attach up to 6 screenshots in the market analysis section.",
      );
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

    if (section === "pre-trade") {
      setPendingPreTradeScreenshots((current) => [...current, ...nextPending]);
    } else {
      setPendingMarketScreenshots((current) => [...current, ...nextPending]);
    }
  }

  function toggleLinkedTrade(tradeId: string) {
    setFields((prev) => {
      const linked = prev.linkedTradeIds.includes(tradeId)
        ? prev.linkedTradeIds.filter((id) => id !== tradeId)
        : [...prev.linkedTradeIds, tradeId];
      return { ...prev, linkedTradeIds: linked };
    });
  }

  function toggleMistake(key: string) {
    setFields((prev) => {
      const mistakeFlags = prev.mistakeFlags.includes(key)
        ? prev.mistakeFlags.filter((item) => item !== key)
        : [...prev.mistakeFlags, key];
      return { ...prev, mistakeFlags };
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveDailyOverview(
        {
          date: selectedDate,
          tradePerformanceHtml: fields.tradePerformanceHtml || null,
          preTradeListHtml: fields.preTradeListHtml || null,
          marketAnalysisHtml: fields.marketAnalysisHtml || null,
          preTradeListScreenshots: fields.preTradeListScreenshots,
          marketAnalysisScreenshots: fields.marketAnalysisScreenshots,
          mistakeFlags: fields.mistakeFlags,
          mistakesNotes: fields.mistakesNotes.trim() || null,
          linkedTradeIds: fields.linkedTradeIds,
        },
        {
          preTradeList: pendingPreTradeScreenshots.map((shot) => ({
            name: shot.name,
            dataUrl: shot.dataUrl,
          })),
          marketAnalysis: pendingMarketScreenshots.map((shot) => ({
            name: shot.name,
            dataUrl: shot.dataUrl,
          })),
        },
      );
      setMessage(result.message);
      if (result.ok) {
        onSaved();
      }
    });
  }

  function handleDelete() {
    if (!currentOverview) {
      return;
    }
    startTransition(async () => {
      const result = await removeDailyOverview(currentOverview.id);
      setMessage(result.message);
      if (result.ok) {
        setFields(emptyFields());
        onSaved();
      }
    });
  }

  if (disabled) {
    return (
      <Card className="overflow-hidden border-cyan-300/20">
        <CardHeader>
          <CardTitle>Daily Overview</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in with a Supabase account to write one daily overview per calendar day.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <TradePreviewModal trade={previewTrade} onClose={() => setPreviewTrade(null)} />
      <Card className="overflow-hidden border-cyan-300/20">
      <CardHeader className="border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-transparent to-cyan-500/10">
        <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_1fr]">
          <OverviewDatePicker
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            overviewDates={sortedOverviewDates.map((overview) => overview.date)}
            tradeDates={tradeDates}
          />

          <div className="flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <BookOpen className="h-5 w-5 text-violet-300" />
                <CardTitle>Daily Overview</CardTitle>
                <Badge tone={currentOverview ? "blue" : "neutral"}>
                  {currentOverview ? "Saved" : "New entry"}
                </Badge>
              </div>
              <p className="mt-2 text-2xl font-black text-white">{formatOverviewDayLabel(selectedDate)}</p>
              <p className="mt-1 text-sm text-zinc-400">
                One journal per calendar day — performance recap, pre-trade plan, and market context.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Trades this day
                </div>
                <div className="mt-1 text-xl font-black text-white">{dayTradesCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Linked
                </div>
                <div className="mt-1 text-xl font-black text-cyan-100">{fields.linkedTradeIds.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Mistakes
                </div>
                <div className="mt-1 text-xl font-black text-rose-200">
                  {countMistakes(fields.mistakeFlags)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Saved days
                </div>
                <div className="mt-1 text-xl font-black text-violet-200">{sortedOverviewDates.length}</div>
              </div>
            </div>

            {currentOverview && overviewHasContent(currentOverview) ? (
              <p className="text-xs text-zinc-500">
                Last updated {format(parseISO(currentOverview.updatedAt), "MMM d, yyyy · h:mm a")}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 pt-6">
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-300">Today&apos;s trade performance</span>
          <RichTextEditor
            value={fields.tradePerformanceHtml}
            onChange={(html) => setFields((prev) => ({ ...prev, tradePerformanceHtml: html }))}
            placeholder="What worked, what didn't, P&L summary, emotional state..."
          />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-300">Pre-trade list</span>
          <RichTextEditor
            value={fields.preTradeListHtml}
            onChange={(html) => setFields((prev) => ({ ...prev, preTradeListHtml: html }))}
            placeholder="Setups to watch, levels, invalidation rules, size plan..."
          />
          <ScreenshotPicker
            existing={fields.preTradeListScreenshots}
            pending={pendingPreTradeScreenshots}
            max={MAX_SCREENSHOTS_PER_SECTION}
            onRemoveExisting={(shot) =>
              setFields((prev) => ({
                ...prev,
                preTradeListScreenshots: prev.preTradeListScreenshots.filter(
                  (item) => item.url !== shot.url,
                ),
              }))
            }
            onRemovePending={(id) => removePendingScreenshot("pre-trade", id)}
            onPick={(event) => void onPickScreenshots("pre-trade", event)}
          />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-300">Market analysis</span>
          <RichTextEditor
            value={fields.marketAnalysisHtml}
            onChange={(html) => setFields((prev) => ({ ...prev, marketAnalysisHtml: html }))}
            placeholder="Macro context, sector rotation, volatility, key events..."
          />
          <ScreenshotPicker
            existing={fields.marketAnalysisScreenshots}
            pending={pendingMarketScreenshots}
            max={MAX_SCREENSHOTS_PER_SECTION}
            onRemoveExisting={(shot) =>
              setFields((prev) => ({
                ...prev,
                marketAnalysisScreenshots: prev.marketAnalysisScreenshots.filter(
                  (item) => item.url !== shot.url,
                ),
              }))
            }
            onRemovePending={(id) => removePendingScreenshot("market", id)}
            onPick={(event) => void onPickScreenshots("market", event)}
          />
        </div>

        <DailyOverviewMistakesPanel
          mistakeFlags={fields.mistakeFlags}
          mistakesNotes={fields.mistakesNotes}
          onToggle={toggleMistake}
          onNotesChange={(mistakesNotes) => setFields((prev) => ({ ...prev, mistakesNotes }))}
        />

        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-300">Link trades from this day</span>
            <Badge tone="neutral">{fields.linkedTradeIds.length} linked</Badge>
          </div>
          {tradesOnDate.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No personal trades on {format(parseISO(selectedDate), "MMM d, yyyy")}. Create journal
              entries for this date to link them here.
            </p>
          ) : (
            <div className="grid gap-2">
              {tradesOnDate.map((trade) => {
                const checked = fields.linkedTradeIds.includes(trade.id);
                return (
                  <div
                    key={trade.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
                      checked
                        ? "border-cyan-300/40 bg-cyan-300/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLinkedTrade(trade.id)}
                        className="h-4 w-4 shrink-0 rounded border-white/20 bg-zinc-950 text-cyan-300"
                        aria-label={`Link ${trade.pair}`}
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewTrade(trade)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-bold text-white">{trade.pair}</div>
                        <div className="text-xs text-zinc-500">
                          {trade.strategy} · {trade.position}
                        </div>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
                      <Button
                        type="button"
                        onClick={() => setPreviewTrade(trade)}
                        className="h-8 bg-white/5 px-2 text-xs text-zinc-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        type="button"
                        onClick={() => openTradeJournalInNewTab(trade.id)}
                        className="h-8 bg-cyan-300/15 px-2 text-xs text-cyan-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {message ? (
          <p
            className={cn(
              "text-sm",
              message.includes("saved") || message.includes("deleted")
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
            {currentOverview ? "Update overview" : "Save overview"}
          </Button>
          {currentOverview ? (
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
    </>
  );
}
