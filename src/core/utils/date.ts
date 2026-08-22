/** Local date helpers — all check-ins are by calendar date YYYY-MM-DD in local time. */

export function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  // use local date, not UTC: construct via local getters
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function getWeekDates(anchorISO: string): string[] {
  // 7 days ending at anchor (inclusive)
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) out.push(addDaysISO(anchorISO, -i));
  return out;
}

export function currentTimeInputValue(): string {
  const n = new Date();
  const hh = String(n.getHours()).padStart(2, "0");
  const mm = String(n.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function timeInputToISO(dateISO: string, timeHHmm: string): string {
  // returns ISO string in local time, stored as ISO
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = timeHHmm.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return dt.toISOString();
}

export function isoToTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
