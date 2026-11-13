/**
 * Time and ID helpers.
 *
 * The prototype treats a journey as same-day travel. All internal journey
 * arithmetic uses minutes since midnight and converts back to ISO local
 * date-time strings at the boundary.
 */

export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error(`Invalid time "${time}". Expected "HH:MM".`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time "${time}". Expected a 24-hour clock time.`);
  }
  return hours * 60 + minutes;
}

export function isValidTime(time: string): boolean {
  try {
    timeToMinutes(time);
    return true;
  } catch {
    return false;
  }
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function isoAt(date: string, minutesOfDay: number): string {
  return `${date}T${minutesToTime(minutesOfDay)}:00`;
}

export function isoFromTime(date: string, time: string): string {
  return isoAt(date, timeToMinutes(time));
}

/** Reads the local clock time of an ISO date-time as minutes since midnight. */
export function isoToMinutes(iso: string): number {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) throw new Error(`Invalid ISO date-time "${iso}".`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isoDatePart(iso: string): string {
  const date = iso.slice(0, 10);
  if (!isValidDate(date)) throw new Error(`Invalid ISO date-time "${iso}".`);
  return date;
}

export function todayISO(clock: Date = new Date()): string {
  const year = clock.getFullYear();
  const month = String(clock.getMonth() + 1).padStart(2, "0");
  const day = String(clock.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysISO(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function nowISO(clock: Date = new Date()): string {
  const date = todayISO(clock);
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(
    clock.getMinutes(),
  ).padStart(2, "0")}`;
  return isoAt(date, timeToMinutes(time));
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** Deterministic incremental ID, e.g. nextId("rpt", ["rpt-1", "rpt-2"]) -> "rpt-3". */
export function nextId(prefix: string, existingIds: Iterable<string>): string {
  let max = 0;
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
  for (const id of existingIds) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${max + 1}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number): number {
  return Math.round(value);
}
