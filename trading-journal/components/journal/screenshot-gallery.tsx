"use client";

import { X, ZoomIn } from "lucide-react";
import { useMemo, useState } from "react";

import { ImageLightbox, type LightboxImage } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";

type ScreenshotItem = {
  key: string;
  url: string;
  name: string;
};

type ScreenshotGalleryProps = {
  items: ScreenshotItem[];
  onRemove?: (key: string) => void;
  thumbClassName?: string;
  className?: string;
};

export function ScreenshotGallery({
  items,
  onRemove,
  thumbClassName = "h-28",
  className,
}: ScreenshotGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const lightboxImages = useMemo<LightboxImage[]>(
    () => items.map((item) => ({ url: item.url, alt: item.name })),
    [items],
  );

  if (!items.length) {
    return null;
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
        {items.map((item, index) => (
          <div
            key={item.key}
            className="group relative overflow-hidden rounded-2xl border border-white/10"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="block w-full text-left"
              aria-label={`View ${item.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.name}
                className={cn("w-full object-cover transition group-hover:scale-[1.02]", thumbClassName)}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/35">
                <ZoomIn className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" />
              </span>
            </button>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
