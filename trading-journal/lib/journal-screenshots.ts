import type { TradeScreenshot } from "@/lib/journal-constants";
import { createClient } from "@/lib/supabase/server";

function dataUrlToBuffer(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid screenshot data URL.");
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadJournalScreenshots(
  userId: string,
  tradeId: string,
  uploads: Array<{ name: string; dataUrl: string }>,
  keepExisting: TradeScreenshot[] = [],
): Promise<TradeScreenshot[]> {
  if (!uploads.length) {
    return keepExisting;
  }

  const supabase = await createClient();
  const saved: TradeScreenshot[] = [...keepExisting];

  for (const [index, upload] of uploads.entries()) {
    const { buffer, contentType } = dataUrlToBuffer(upload.dataUrl);
    const filename = `${Date.now()}-${index}-${sanitizeFilename(upload.name)}`;
    const path = `${userId}/${tradeId}/${filename}`;

    const { error } = await supabase.storage.from("trade-screenshots").upload(path, buffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Screenshot upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from("trade-screenshots").getPublicUrl(path);
    saved.push({
      name: upload.name,
      url: data.publicUrl,
    });
  }

  return saved;
}
