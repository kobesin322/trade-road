"use client";

import { Brain, Gauge, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatOverviewDayLabel } from "@/components/journal/overview-date-picker";
import {
  countActiveFlags,
  confidenceLabel,
  portfolioToDayCondition,
} from "@/lib/portfolio-day-condition";
import { DAY_CONDITION_FLAGS, type Portfolio, type PortfolioDayCondition } from "@/lib/ls-portfolio-types";
import { cn } from "@/lib/utils";

type PortfolioDayConditionPanelProps = {
  portfolio: Portfolio;
  selectedDate: string;
  disabled?: boolean;
  saving?: boolean;
  onSave: (patch: Partial<PortfolioDayCondition>) => Promise<void>;
};

function clampConfidence(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function PortfolioDayConditionPanel({
  portfolio,
  selectedDate,
  disabled,
  saving,
  onSave,
}: PortfolioDayConditionPanelProps) {
  const [local, setLocal] = useState<PortfolioDayCondition>(() => portfolioToDayCondition(portfolio));

  useEffect(() => {
    setLocal(portfolioToDayCondition(portfolio));
  }, [portfolio]);

  const persist = useCallback(
    async (patch: Partial<PortfolioDayCondition>) => {
      const next = { ...local, ...patch };
      setLocal(next);
      await onSave(patch);
    },
    [local, onSave],
  );

  const activeFlags = countActiveFlags(local);

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-rose-400/20 bg-gradient-to-br from-rose-500/10 via-transparent to-amber-500/5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Brain className="h-5 w-5 text-rose-300" />
                <CardTitle className="text-xl">Today&apos;s condition</CardTitle>
                {activeFlags > 0 ? (
                  <Badge tone="loss">{activeFlags} flag{activeFlags === 1 ? "" : "s"}</Badge>
                ) : (
                  <Badge tone="win">Clear</Badge>
                )}
              </div>
              <p className="mt-2 text-2xl font-black text-white">{formatOverviewDayLabel(selectedDate)}</p>
              <p className="mt-1 text-sm text-zinc-400">
                Honest self-check before or after the session — saved per snapshot day.
              </p>
            </div>
            {saving ? <Badge tone="neutral">Saving…</Badge> : null}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior flags</CardTitle>
          <p className="text-sm text-zinc-400">Tick anything that applied today.</p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {DAY_CONDITION_FLAGS.map((flag) => {
            const checked = local[flag.key];
            return (
              <label
                key={flag.key}
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
                  disabled={disabled || saving}
                  onChange={(e) => void persist({ [flag.key]: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 accent-rose-400"
                />
                <span className={cn("text-sm font-semibold", checked ? "text-rose-100" : "text-zinc-300")}>
                  {flag.label}
                </span>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConfidenceBar
          label="Confidence in market"
          hint="How tradable / clear is the environment today?"
          value={local.market_confidence}
          disabled={disabled || saving}
          tone="cyan"
          onChange={(value) => void persist({ market_confidence: value })}
        />
        <ConfidenceBar
          label="Confidence in myself"
          hint="Process, discipline, and emotional state — not P&L."
          value={local.self_confidence}
          disabled={disabled || saving}
          tone="emerald"
          onChange={(value) => void persist({ self_confidence: value })}
        />
      </div>

      <Card className="border-white/10 bg-black/20">
        <CardContent className="grid gap-2 pt-6 text-sm text-zinc-400">
          <div className="flex items-center gap-2 font-semibold text-zinc-300">
            <Gauge className="h-4 w-4 text-cyan-300" />
            Quick read
          </div>
          <p>
            Market:{" "}
            <span className="font-mono font-bold text-cyan-100">
              {local.market_confidence}% — {confidenceLabel(local.market_confidence)}
            </span>
            {" · "}
            Self:{" "}
            <span className="font-mono font-bold text-emerald-100">
              {local.self_confidence}% — {confidenceLabel(local.self_confidence)}
            </span>
          </p>
          {activeFlags > 0 ? (
            <p className="text-rose-200/90">
              {activeFlags} behavior flag{activeFlags === 1 ? "" : "s"} marked — review before sizing up
              tomorrow.
            </p>
          ) : (
            <p>No behavior flags — process looks clean on paper.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfidenceBar({
  label,
  hint,
  value,
  disabled,
  tone,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  disabled?: boolean;
  tone: "cyan" | "emerald";
  onChange: (value: number) => void;
}) {
  return (
    <Card
      className={cn(
        tone === "cyan" && "border-cyan-400/20 bg-cyan-500/5",
        tone === "emerald" && "border-emerald-400/20 bg-emerald-500/5",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-sm text-zinc-400">{hint}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            {confidenceLabel(value)}
          </span>
          <span
            className={cn(
              "font-mono text-2xl font-black tabular-nums",
              tone === "cyan" ? "text-cyan-100" : "text-emerald-100",
            )}
          >
            {value}%
          </span>
        </div>
        <Progress
          value={value}
          className={cn("h-3", tone === "cyan" ? "[&>div]:from-cyan-400 [&>div]:via-cyan-300" : "")}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onChange(clampConfidence(value - 5))}
            className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200"
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(clampConfidence(Number(e.target.value)))}
            className={cn("flex-1", tone === "cyan" ? "accent-cyan-400" : "accent-emerald-400")}
          />
          <Button
            type="button"
            disabled={disabled}
            onClick={() => onChange(clampConfidence(value + 5))}
            className="h-9 w-9 shrink-0 bg-white/5 p-0 text-zinc-200"
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
