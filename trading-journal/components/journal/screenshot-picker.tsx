"use client";

import { ImagePlus } from "lucide-react";
import { useMemo } from "react";

import { ScreenshotGallery } from "@/components/journal/screenshot-gallery";
import { Badge } from "@/components/ui/badge";
import type { TradeScreenshot } from "@/lib/journal-constants";
import { cn } from "@/lib/utils";

export type PendingScreenshot = {
  id: string;
  name: string;
  previewUrl: string;
  dataUrl: string;
};

type ScreenshotPickerProps = {
  label?: string;
  existing: TradeScreenshot[];
  pending: PendingScreenshot[];
  max?: number;
  onRemoveExisting: (shot: TradeScreenshot) => void;
  onRemovePending: (id: string) => void;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
};

export async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read screenshot."));
    reader.readAsDataURL(file);
  });
}

export function ScreenshotPicker({
  label = "Screenshots (optional)",
  existing,
  pending,
  max = 6,
  onRemoveExisting,
  onRemovePending,
  onPick,
  className,
}: ScreenshotPickerProps) {
  const total = existing.length + pending.length;

  const galleryItems = useMemo(
    () => [
      ...existing.map((shot) => ({ key: shot.url, url: shot.url, name: shot.name })),
      ...pending.map((shot) => ({ key: shot.id, url: shot.previewUrl, name: shot.name })),
    ],
    [existing, pending],
  );

  function handleRemove(key: string) {
    const existingShot = existing.find((shot) => shot.url === key);
    if (existingShot) {
      onRemoveExisting(existingShot);
      return;
    }
    onRemovePending(key);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-300">{label}</span>
        <Badge tone="neutral">
          {total}/{max}
        </Badge>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
        <ImagePlus className="h-4 w-4" />
        Add screenshot(s)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </label>
      <ScreenshotGallery items={galleryItems} onRemove={handleRemove} />
    </div>
  );
}
