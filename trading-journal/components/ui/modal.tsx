"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
};

export function Modal({ open, onClose, title, children, className, wide }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-3xl",
          wide ? "max-w-3xl" : "max-w-xl",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Toast({
  message,
  tone = "info",
}: {
  message: string | null;
  tone?: "info" | "success" | "error";
}) {
  if (!message) {
    return null;
  }
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[90] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl",
        tone === "success" && "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
        tone === "error" && "border-rose-400/30 bg-rose-500/15 text-rose-100",
        tone === "info" && "border-cyan-400/30 bg-cyan-500/15 text-cyan-100",
      )}
    >
      {message}
    </div>
  );
}
