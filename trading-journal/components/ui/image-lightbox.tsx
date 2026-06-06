"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type LightboxImage = {
  url: string;
  alt: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
  const isOpen = index !== null && images[index];
  const current = index !== null ? images[index] : null;

  const goPrev = useCallback(() => {
    if (index === null || !onIndexChange || images.length < 2) {
      return;
    }
    onIndexChange((index - 1 + images.length) % images.length);
  }, [images.length, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null || !onIndexChange || images.length < 2) {
      return;
    }
    onIndexChange((index + 1) % images.length);
  }, [images.length, index, onIndexChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        goPrev();
      }
      if (event.key === "ArrowRight") {
        goNext();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [goNext, goPrev, isOpen, onClose]);

  if (!isOpen || !current) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/60 p-2 text-white transition hover:bg-black/80"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && onIndexChange ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 p-2 text-white transition hover:bg-black/80"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 p-2 text-white transition hover:bg-black/80"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}

      <div
        className="flex max-h-[90vh] max-w-[min(96vw,1200px)] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          className="max-h-[82vh] w-auto max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl"
        />
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <span className="font-semibold">{current.alt}</span>
          {images.length > 1 ? (
            <span className="text-zinc-500">
              {(index ?? 0) + 1} / {images.length}
            </span>
          ) : null}
        </div>
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200 underline-offset-4 hover:underline",
          )}
        >
          Open original in new tab
        </a>
      </div>
    </div>,
    document.body,
  );
}
