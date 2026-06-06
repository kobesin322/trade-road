"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { removeDailyOverview, saveDailyOverview } from "@/app/actions/daily-overview";
import { RichTextEditor } from "@/components/journal/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DailyOverview } from "@/lib/daily-overview-types";
import type { Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

type DailyOverviewPanelProps = {
  canUsePersonalJournal: boolean;
  demoTradesEnabled: boolean;
  personalTrades: Trade[];
  dailyOverviews: DailyOverview[];
  initialDate?: string;
  onSaved: () => void;
  onSelectTrade?: (trade: Trade) => void;
};

function emptyFields() {
  return {
    tradePerformanceHtml: "",
    preTradeListHtml: "",
    marketAnalysisHtml: "",
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
    linkedTradeIds: [...overview.linkedTradeIds],
  };
}

export function DailyOverviewPanel({
  canUsePersonalJournal,
  demoTradesEnabled,
  personalTrades,
  dailyOverviews,
  initialDate,
  onSaved,
  onSelectTrade,
}: DailyOverviewPanelProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(initialDate ?? today);
  const [fields, setFields] = useState(emptyFields);
  const [message, setMessage] = useState<string | null>(null);
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

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    setFields(overviewToFields(currentOverview));
    setMessage(null);
  }, [selectedDate, currentOverview]);

  const disabled = !canUsePersonalJournal || demoTradesEnabled;

  function toggleLinkedTrade(tradeId: string) {
    setFields((prev) => {
      const linked = prev.linkedTradeIds.includes(tradeId)
        ? prev.linkedTradeIds.filter((id) => id !== tradeId)
        : [...prev.linkedTradeIds, tradeId];
      return { ...prev, linkedTradeIds: linked };
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveDailyOverview({
        date: selectedDate,
        tradePerformanceHtml: fields.tradePerformanceHtml || null,
        preTradeListHtml: fields.preTradeListHtml || null,
        marketAnalysisHtml: fields.marketAnalysisHtml || null,
        linkedTradeIds: fields.linkedTradeIds,
      });
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
            Turn demo trades off and use a Supabase account to write one daily overview per calendar
            day.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-cyan-300/20">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Daily Overview</CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              One journal entry per day — performance recap, pre-trade plan, and market context.
            </p>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-zinc-300">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-200" />
              Overview date
            </span>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full bg-zinc-950 lg:w-48"
            />
          </label>
        </div>

        {sortedOverviewDates.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {sortedOverviewDates.map((overview) => (
              <button
                key={overview.id}
                type="button"
                onClick={() => setSelectedDate(overview.date)}
                className={cn(
                  "rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white",
                  selectedDate === overview.date && "border-cyan-300/50 bg-cyan-300/15 text-cyan-100",
                )}
              >
                {format(parseISO(overview.date), "MMM d, yyyy")}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="grid gap-6">
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
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-300">Market analysis</span>
          <RichTextEditor
            value={fields.marketAnalysisHtml}
            onChange={(html) => setFields((prev) => ({ ...prev, marketAnalysisHtml: html }))}
            placeholder="Macro context, sector rotation, volatility, key events..."
          />
        </div>

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
                  <label
                    key={trade.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
                      checked
                        ? "border-cyan-300/40 bg-cyan-300/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLinkedTrade(trade.id)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950 text-cyan-300"
                      />
                      <div>
                        <div className="font-bold text-white">{trade.pair}</div>
                        <div className="text-xs text-zinc-500">
                          {trade.strategy} · {trade.position}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={trade.outcome === "WIN" ? "win" : "loss"}>{trade.outcome}</Badge>
                      {onSelectTrade ? (
                        <Button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            onSelectTrade(trade);
                          }}
                          className="h-8 bg-white/5 px-2 text-xs text-zinc-200"
                        >
                          Open
                        </Button>
                      ) : null}
                    </div>
                  </label>
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
  );
}
