"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "win" | "loss" | "neutral" | "gold" | "blue";

const tones: Record<BadgeTone, string> = {
  win: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 shadow-emerald-500/10",
  loss: "border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-rose-500/10",
  neutral: "border-white/10 bg-white/10 text-zinc-200 shadow-black/20",
  gold: "border-yellow-300/40 bg-yellow-300/15 text-yellow-100 shadow-yellow-500/10",
  blue: "border-sky-300/40 bg-sky-400/15 text-sky-100 shadow-sky-500/10",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em] shadow-lg",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
