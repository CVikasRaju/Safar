import type { SafarState } from "../domain/types";
import { SCHEMA_VERSION, createSeedState } from "../data/seed";
import { validateState } from "../data/validation";

/**
 * Versioned LocalStorage persistence (docs/11). This is a single-browser demo
 * store, not a multi-user database; a production deployment needs a server
 * database with transactional updates.
 */
export const STORAGE_KEY = "safar-state-v1";

export interface LoadStateResult {
  state: SafarState;
  notice?: string;
  restoredFromSeed: boolean;
}

function looksLikeSafarState(value: unknown): value is SafarState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SafarState>;
  return (
    typeof candidate.schemaVersion === "number" &&
    Array.isArray(candidate.villages) &&
    Array.isArray(candidate.stops) &&
    Array.isArray(candidate.routes) &&
    Array.isArray(candidate.timetableServices) &&
    Array.isArray(candidate.buses) &&
    Array.isArray(candidate.disruptionReports) &&
    Array.isArray(candidate.incidents)
  );
}

export function loadState(storage: Storage | undefined = safeStorage()): LoadStateResult {
  const seeded = createSeedState();
  if (!storage) {
    return { state: seeded, restoredFromSeed: true };
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: seeded,
      restoredFromSeed: true,
      notice: "Browser storage is unavailable, so the demo started from seed data.",
    };
  }

  if (!raw) return { state: seeded, restoredFromSeed: true };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!looksLikeSafarState(parsed)) {
      storage.removeItem(STORAGE_KEY);
      return {
        state: seeded,
        restoredFromSeed: true,
        notice: "Saved demo data was not recognised and has been replaced with the seed dataset.",
      };
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      storage.removeItem(STORAGE_KEY);
      return {
        state: seeded,
        restoredFromSeed: true,
        notice: "Saved demo data was from an older schema version and has been reset.",
      };
    }
    const issues = validateState(parsed).filter((issue) => issue.level === "error");
    if (issues.length > 0) {
      storage.removeItem(STORAGE_KEY);
      return {
        state: seeded,
        restoredFromSeed: true,
        notice:
          "Saved demo data failed consistency checks and has been reset to the seed dataset.",
      };
    }
    return { state: parsed, restoredFromSeed: false };
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures: the app continues with seed data.
    }
    return {
      state: seeded,
      restoredFromSeed: true,
      notice: "Saved demo data could not be read and has been replaced with the seed dataset.",
    };
  }
}

export function saveState(state: SafarState, storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or privacy-mode failures must not break the portal.
  }
}

export function clearState(storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

function safeStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}
