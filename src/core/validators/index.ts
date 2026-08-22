/**
 * Validation at repository/service boundary.
 * Invalid values are rejected before persistence — never silently coerced.
 */

export function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${date}`);
  }
  const d = new Date(date);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

export function assertBristol(v: number | null | undefined): void {
  if (v == null) return;
  if (!Number.isInteger(v) || v < 1 || v > 7) throw new Error(`Bristol must be 1–7, got ${v}`);
}

export function assertPain(v: number | null | undefined): void {
  if (v == null) return;
  if (!Number.isInteger(v) || v < 0 || v > 10) throw new Error(`pain_level must be 0–10, got ${v}`);
}

export function assertNonNegativeInt(
  v: number | null | undefined,
  field: string,
): void {
  if (v == null) return;
  if (!Number.isInteger(v) || v < 0) throw new Error(`${field} must be integer >=0, got ${v}`);
}

const TIME_LABELS = [
  "Early Morning",
  "Morning",
  "Late Morning",
  "Afternoon",
  "Evening",
  "Night",
  "Late Night",
] as const;

export function assertApproximateLabel(v: string | null | undefined): void {
  if (v == null) return;
  if (!TIME_LABELS.includes(v as (typeof TIME_LABELS)[number])) {
    throw new Error(`approximate_time_label invalid: ${v}`);
  }
}

export function assertTagCategory(c: string): void {
  if (!["symptom", "food", "medication", "exercise"].includes(c)) {
    throw new Error(`Invalid tag category: ${c}`);
  }
}

export function assertSleepQuality(q: string | null | undefined): void {
  if (q == null) return;
  if (!["poor", "average", "good", "excellent"].includes(q))
    throw new Error(`Invalid sleep quality: ${q}`);
}
