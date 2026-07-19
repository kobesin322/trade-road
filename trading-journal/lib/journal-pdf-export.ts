import { format, parseISO } from "date-fns";

import type { Trade } from "@/lib/trades";

export const MAX_PDF_EXPORT_TRADES = 10;

const PAGE_MARGIN = 18;
const LINE_HEIGHT = 5.5;
const CONTENT_WIDTH = 210 - PAGE_MARGIN * 2;

type ImagePayload = {
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG" | "PNG" | "WEBP";
};

function formatMoney(value: number) {
  const prefix = value >= 0 ? "$" : "-$";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function htmlToPlainText(html: string) {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent ?? container.innerText ?? "").replace(/\s+/g, " ").trim();
}

async function loadImageFromUrl(url: string): Promise<ImagePayload | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Image load failed"));
        element.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }

      context.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      return {
        dataUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        format: "JPEG",
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

class PdfWriter {
  private y = PAGE_MARGIN;
  private readonly doc: import("jspdf").jsPDF;

  constructor(doc: import("jspdf").jsPDF) {
    this.doc = doc;
  }

  private ensureSpace(height: number) {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.y + height > pageHeight - PAGE_MARGIN) {
      this.doc.addPage();
      this.y = PAGE_MARGIN;
    }
  }

  addTitle(text: string) {
    this.ensureSpace(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    this.doc.setTextColor(20, 20, 20);
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += 10;
  }

  addSubtitle(text: string) {
    this.ensureSpace(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(90, 90, 90);
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += 7;
  }

  addSectionHeading(text: string) {
    this.ensureSpace(10);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(PAGE_MARGIN, this.y, PAGE_MARGIN + CONTENT_WIDTH, this.y);
    this.y += 6;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(30, 30, 30);
    this.doc.text(text, PAGE_MARGIN, this.y);
    this.y += 7;
  }

  addKeyValue(label: string, value: string) {
    this.ensureSpace(LINE_HEIGHT + 1);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.setTextColor(70, 70, 70);
    this.doc.text(`${label}:`, PAGE_MARGIN, this.y);

    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(20, 20, 20);
    const lines = this.doc.splitTextToSize(value, CONTENT_WIDTH - 42);
    this.doc.text(lines, PAGE_MARGIN + 42, this.y);
    this.y += Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);
  }

  addParagraph(text: string) {
    if (!text.trim()) {
      return;
    }

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(30, 30, 30);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH);

    for (const line of lines) {
      this.ensureSpace(LINE_HEIGHT);
      this.doc.text(line, PAGE_MARGIN, this.y);
      this.y += LINE_HEIGHT;
    }

    this.y += 2;
  }

  addBullet(text: string) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(30, 30, 30);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH - 8);

    for (let index = 0; index < lines.length; index += 1) {
      this.ensureSpace(LINE_HEIGHT);
      const prefix = index === 0 ? "• " : "  ";
      this.doc.text(`${prefix}${lines[index]}`, PAGE_MARGIN, this.y);
      this.y += LINE_HEIGHT;
    }
  }

  async addImage(label: string, image: ImagePayload) {
    const maxWidth = CONTENT_WIDTH;
    const maxHeight = 120;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;

    this.ensureSpace(height + 10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(70, 70, 70);
    this.doc.text(label, PAGE_MARGIN, this.y);
    this.y += 5;

    this.ensureSpace(height + 4);
    this.doc.addImage(image.dataUrl, image.format, PAGE_MARGIN, this.y, width, height, undefined, "FAST");
    this.y += height + 6;
  }

  addPageBreak() {
    this.doc.addPage();
    this.y = PAGE_MARGIN;
  }
}

function buildTradeSections(trade: Trade, index: number, total: number) {
  const sections: Array<{ heading: string; lines: string[] }> = [
    {
      heading: "Trade Overview",
      lines: [
        `Document position: Trade ${index} of ${total}`,
        `Pair: ${trade.pair}`,
        `Date: ${format(parseISO(trade.date), "EEEE, MMM d, yyyy")}`,
        `Position: ${trade.position}`,
        `Outcome: ${trade.outcome}`,
        `Strategy: ${trade.strategy}`,
      ],
    },
    {
      heading: "Performance",
      lines: [
        `Return: ${formatPercent(trade.profitPercent)}`,
        `Profit: ${formatMoney(trade.profitAmount)}`,
      ],
    },
    {
      heading: "Risk Management",
      lines: [
        `Stop Loss: ${trade.stopLoss ?? "—"}`,
        `Take Profit: ${trade.takeProfit ?? "—"}`,
        `Risk/Reward: ${trade.riskRewardRatio != null ? `${trade.riskRewardRatio}R` : "—"}`,
      ],
    },
    {
      heading: "Self-rated ranking",
      lines: [
        `Overall trade: ${trade.ratingOverall ?? "—"}`,
        `Sizing Management: ${trade.ratingSizing ?? "—"}`,
        `Entry: ${trade.ratingEntry ?? "—"}`,
        `Exit Management: ${trade.ratingExit ?? "—"}`,
      ],
    },
  ];

  if (trade.notes?.trim()) {
    sections.push({
      heading: "Notes",
      lines: [trade.notes.trim()],
    });
  }

  if ((trade.levelPushes?.length ?? 0) > 0) {
    sections.push({
      heading: "SL / TP Push History",
      lines:
        trade.levelPushes?.map((push) => {
          const timestamp = format(parseISO(push.pushedAt), "MMM d, yyyy HH:mm");
          const note = push.note?.trim() ? ` — ${push.note.trim()}` : "";
          return `${push.levelType} @ ${push.price} | ${timestamp}${note}`;
        }) ?? [],
    });
  }

  const journalText = trade.journalHtml ? htmlToPlainText(trade.journalHtml) : "";
  if (journalText) {
    sections.push({
      heading: "Journal Entry",
      lines: [journalText],
    });
  }

  return sections;
}

async function renderTrade(writer: PdfWriter, trade: Trade, index: number, total: number) {
  writer.addTitle(`Trade Journal #${index}`);
  writer.addSubtitle(`${trade.pair} · ${format(parseISO(trade.date), "MMM d, yyyy")} · ${trade.outcome}`);

  for (const section of buildTradeSections(trade, index, total)) {
    writer.addSectionHeading(section.heading);
    if (section.heading === "SL / TP Push History") {
      for (const line of section.lines) {
        writer.addBullet(line);
      }
    } else if (section.heading === "Trade Overview" || section.heading === "Performance" || section.heading === "Risk Management") {
      for (const line of section.lines) {
        const [label, ...rest] = line.split(": ");
        writer.addKeyValue(label, rest.join(": "));
      }
    } else {
      for (const line of section.lines) {
        writer.addParagraph(line);
      }
    }
  }

  const screenshots = trade.screenshots ?? [];
  if (screenshots.length > 0) {
    writer.addSectionHeading(`Screenshots (${screenshots.length})`);

    for (let shotIndex = 0; shotIndex < screenshots.length; shotIndex += 1) {
      const shot = screenshots[shotIndex];
      const image = await loadImageFromUrl(shot.url);
      if (image) {
        await writer.addImage(`Screenshot ${shotIndex + 1}: ${shot.name}`, image);
      } else {
        writer.addBullet(`Screenshot ${shotIndex + 1}: ${shot.name} (could not load image)`);
        writer.addParagraph(`URL: ${shot.url}`);
      }
    }
  }
}

function buildFilename(trades: Trade[]) {
  const stamp = format(new Date(), "yyyy-MM-dd");
  if (trades.length === 1) {
    const trade = trades[0];
    const pairSlug = trade.pair.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `traderoad-journal-${pairSlug}-${trade.date}.pdf`;
  }

  return `traderoad-journals-${trades.length}-trades-${stamp}.pdf`;
}

export async function exportTradesToPdf(trades: Trade[]): Promise<void> {
  if (trades.length === 0) {
    throw new Error("Select at least one trade to export.");
  }

  if (trades.length > MAX_PDF_EXPORT_TRADES) {
    throw new Error(`You can export up to ${MAX_PDF_EXPORT_TRADES} trade journals at once.`);
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const writer = new PdfWriter(doc);

  writer.addTitle("Trade Road — Journal Export");
  writer.addSubtitle(
    `Generated ${format(new Date(), "MMM d, yyyy HH:mm")} · ${trades.length} trade${trades.length === 1 ? "" : "s"} · For LLM analysis`,
  );
  writer.addParagraph(
    "Structured export containing trade metadata, journal notes, SL/TP history, and chart screenshots.",
  );

  for (let index = 0; index < trades.length; index += 1) {
    writer.addPageBreak();
    await renderTrade(writer, trades[index], index + 1, trades.length);
  }

  doc.save(buildFilename(trades));
}
