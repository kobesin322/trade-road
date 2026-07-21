import * as React from "react";

import { cn } from "@/lib/utils";

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:border-cyan-300/40 hover:bg-cyan-300/12 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a12] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
