/** Time and duration helpers. All demo times are local wall-clock times. */

export const MINUTES_PER_DAY = 24 * 60;

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isValidHhmm(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}

export function hhmmToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error(`Invalid time value: ${value}`);
  }
  return hours * 60 + minutes;
}

export function minutesToHhmm(minutes: number): string {
  const normalised = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad2(Math.floor(normalised / 60))}:${pad2(normalised % 60)}`;
}

export function parseIsoDate(dateISO: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) {
    throw new Error(`Invalid ISO date: ${dateISO}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseIsoDate(value);
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
  );
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function addDaysIso(dateISO: string, days: number): string {
  const { year, month, day } = parseIsoDate(dateISO);
  const date = new Date(year, month - 1, day + days);
  return toIsoDate(date);
}

/** Minutes after local midnight -> ISO timestamp on the given date (handles rollover). */
export function minutesToIso(dateISO: string, minutes: number): string {
  const { year, month, day } = parseIsoDate(dateISO);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setMinutes(minutes);
  return date.toISOString();
}

export function isoToMinutesOfDay(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${pad2(rest)} m`;
}

export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return "on time";
  const abs = Math.abs(Math.round(minutes));
  return minutes < 0 ? `${abs} min early` : `${abs} min late`;
}

export function formatDateLabel(dateISO: string): string {
  const { year, month, day } = parseIsoDate(dateISO);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  })} · ${formatClock(iso)}`;
}

export function weekdayOfIsoDate(dateISO: string): number {
  const { year, month, day } = parseIsoDate(dateISO);
  return new Date(year, month - 1, day).getDay();
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = new Date(aStart).getTime();
  const aE = new Date(aEnd).getTime();
  const bS = new Date(bStart).getTime();
  const bE = new Date(bEnd).getTime();
  return aS < bE && bS < aE;
}
