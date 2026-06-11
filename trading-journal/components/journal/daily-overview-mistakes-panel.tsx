"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TRADING_MISTAKE_OPTIONS } from "@/lib/trading-mistakes";
import { cn } from "@/lib/utils";

type DailyOverviewMistakesPanelProps = {
  mistakeFlags: string[];
  mistakesNotes: string;
  disabled?: boolean;
  onToggle: (key: string) => void;
  onNotesChange: (notes: string) => void;
};

export function DailyOverviewMistakesPanel({
  mistakeFlags,
  mistakesNotes,
  disabled,
  onToggle,
  onNotesChange,
}: DailyOverviewMistakesPanelProps) {
  return (
    <div className="grid gap-4 rounded-3xl border border-rose-400/25 bg-gradient-to-br from-rose-500/10 via-transparent to-amber-500/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
            <span className="text-sm font-bold text-zinc-200">Mistakes today</span>
            {mistakeFlags.length > 0 ? (
              <Badge tone="loss">
                {mistakeFlags.length} marked
              </Badge>
            ) : (
              <Badge tone="win">Clean sheet</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Tick any mistakes you made today — honest review builds edge.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TRADING_MISTAKE_OPTIONS.map((option) => {
          const checked = mistakeFlags.includes(option.key);
          return (
            <label
              key={option.key}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition",
                checked
                  ? "border-rose-400/40 bg-rose-500/15"
                  : "border-white/10 bg-black/20 hover:border-white/20",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(option.key)}
                className="h-4 w-4 rounded border-white/20 accent-rose-400"
              />
              <span className={cn("text-sm font-semibold", checked ? "text-rose-100" : "text-zinc-300")}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-zinc-300">Additional notes</span>
        <textarea
          value={mistakesNotes}
          disabled={disabled}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Other mistakes, triggers, or what to fix tomorrow..."
          className="min-h-24 rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-white placeholder:text-zinc-600"
        />
      </label>
    </div>
  );
}
