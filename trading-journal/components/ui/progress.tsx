import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
};

export function Progress({ value, className, ...props }: ProgressProps) {
  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full bg-white/10 shadow-inner shadow-black/50",
        className,
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-300 shadow-[0_0_18px_rgba(34,211,238,0.75)] transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
