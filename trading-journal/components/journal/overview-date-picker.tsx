"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OverviewDatePickerProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  overviewDates?: string[];
  tradeDates?: string[];
  className?: string;
};

export function OverviewDatePicker({
  selectedDate,
  onSelectDate,
  overviewDates = [],
  tradeDates = [],
  className,
}: OverviewDatePickerProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(selectedDate)));

  useEffect(() => {
    setVisibleMonth(startOfMonth(parseISO(selectedDate)));
  }, [selectedDate]);

  const overviewSet = useMemo(() => new Set(overviewDates), [overviewDates]);
  const tradeSet = useMemo(() => new Set(tradeDates), [tradeDates]);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) }),
    [visibleMonth],
  );
  const monthOffset = getDay(startOfMonth(visibleMonth));

  function shiftMonth(delta: number) {
    setVisibleMonth((current) => (delta > 0 ? addMonths(current, 1) : subMonths(current, 1)));
  }

  function goToToday() {
    const today = new Date();
    setVisibleMonth(startOfMonth(today));
    onSelectDate(format(today, "yyyy-MM-dd"));
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/80 to-black/40 p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
            {format(visibleMonth, "MMMM yyyy")}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Pick a day for your overview</div>
        </div>
        <Button
          type="button"
          onClick={() => shiftMonth(1)}
          className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={goToToday} className="h-8 bg-cyan-300/10 px-3 text-xs text-cyan-100">
          Today
        </Button>
        <Badge tone="neutral" className="text-[10px]">
          {overviewDates.length} saved
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: monthOffset }).map((_, index) => (
          <div key={`blank-${index}`} className="aspect-square rounded-xl" />
        ))}
        {monthDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const isSelected = dateKey === selectedDate;
          const hasOverview = overviewSet.has(dateKey);
          const hasTrades = tradeSet.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-bold transition",
                isSelected
                  ? "border-cyan-300/70 bg-cyan-300/20 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                  : "border-transparent text-zinc-300 hover:border-white/15 hover:bg-white/[0.06]",
                isToday(day) && !isSelected && "border-cyan-300/30 text-cyan-100",
                !isSameMonth(day, visibleMonth) && "opacity-40",
              )}
            >
              {format(day, "d")}
              <span className="mt-0.5 flex h-2 items-center gap-0.5">
                {hasOverview ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
                ) : null}
                {hasTrades ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Overview saved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Trades logged
        </span>
      </div>
    </div>
  );
}

export function formatOverviewDayLabel(date: string) {
  return format(parseISO(date), "EEEE, MMMM d, yyyy");
}
