/** Format a stored number for display in a free-text decimal field. */
export function decimalInputString(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

/** Parse user text into a number. Returns null for empty or incomplete input. */
export function parseDecimalInput(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse optional numeric field — blank input becomes null. */
export function parseOptionalDecimalInput(text: string): number | null {
  if (!text.trim()) {
    return null;
  }
  return parseDecimalInput(text);
}

/** Parse required numeric field with a user-facing label for errors. */
export function parseRequiredDecimalInput(
  text: string,
  label: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const parsed = parseDecimalInput(text);
  if (parsed === null) {
    return { ok: false, message: `${label} must be a valid number.` };
  }
  return { ok: true, value: parsed };
}
