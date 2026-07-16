"use client";

import { FileDown, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { exportTradesToPdf } from "@/lib/journal-pdf-export";
import type { Trade } from "@/lib/trades";
import { cn } from "@/lib/utils";

type JournalPdfExportButtonProps = {
  trades: Trade[];
  disabled?: boolean;
  label?: string;
  className?: string;
  onError?: (message: string) => void;
};

export function JournalPdfExportButton({
  trades,
  disabled = false,
  label,
  className,
  onError,
}: JournalPdfExportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const resolvedLabel =
    label ?? (trades.length === 1 ? "Export PDF" : `Export PDF (${trades.length})`);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        disabled={disabled || isPending || trades.length === 0}
        onClick={() => {
          setLocalError(null);
          startTransition(async () => {
            try {
              await exportTradesToPdf(trades);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Failed to export PDF. Please try again.";
              setLocalError(message);
              onError?.(message);
            }
          });
        }}
        className="bg-white/5 text-zinc-100"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {isPending ? "Exporting..." : resolvedLabel}
      </Button>
      {localError ? <p className="text-xs text-rose-300">{localError}</p> : null}
    </div>
  );
}
