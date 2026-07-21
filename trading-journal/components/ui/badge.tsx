"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "win" | "loss" | "neutral" | "gold" | "blue";

const tones: Record<BadgeTone, string> = {
  win: "border-emerald-400/35 bg-emerald-400/12 text-emerald-100",
  loss: "border-rose-400/35 bg-rose-500/12 text-rose-100",
  neutral: "border-white/10 bg-white/[0.06] text-zinc-200",
  gold: "border-amber-300/35 bg-amber-300/12 text-amber-50",
  blue: "border-cyan-300/35 bg-cyan-400/12 text-cyan-50",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
