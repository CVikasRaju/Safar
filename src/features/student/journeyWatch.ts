import type { JourneyOption, JourneySearchRequest, JourneyWatch } from "../../domain/types/journey";
import { journeySignature, describeJourney, requestKey } from "../../domain/calculations/journeyPlanner";

/**
 * Saved journey searches.
 *
 * Used to detect "your journey recommendation changed" alerts. This is UI-level
 * demo state kept outside the canonical store so it never competes with shared
 * application state.
 */
export const WATCHES_STORAGE_KEY = "safar-journey-watches-v1";
export const WATCHES_UPDATED_EVENT = "safar:journey-watches-updated";
const MAX_WATCHES = 5;

function storage(): Storage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadWatches(): JourneyWatch[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(WATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is JourneyWatch => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<JourneyWatch>;
      return (
        typeof candidate.key === "string" &&
        typeof candidate.topJourneySignature === "string" &&
        typeof candidate.savedAt === "string" &&
        !!candidate.request &&
        typeof candidate.request.originVillageId === "string"
      );
    });
  } catch {
    return [];
  }
}

function persist(watches: JourneyWatch[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches));
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WATCHES_UPDATED_EVENT));
  }
}

export function watchFromJourney(
  request: JourneySearchRequest,
  journey: JourneyOption | undefined,
): JourneyWatch {
  return {
    key: requestKey(request),
    request,
    topJourneySignature: journey ? journeySignature(journey) : "none",
    topJourneyLabel: journey ? describeJourney(journey) : "No feasible journey",
    savedAt: new Date().toISOString(),
  };
}

export function saveWatch(watch: JourneyWatch): JourneyWatch[] {
  const existing = loadWatches().filter((entry) => entry.key !== watch.key);
  const next = [watch, ...existing].slice(0, MAX_WATCHES);
  persist(next);
  return next;
}

export function clearWatches(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(WATCHES_STORAGE_KEY);
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WATCHES_UPDATED_EVENT));
  }
}
