import type { SafarState, ValidationResult } from "../domain/types";
import { STORAGE_KEY } from "../domain/constants";
import { getInitialState, type InitialStateOptions } from "../state/initialState";
import { validateState } from "../domain/validation";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadStateResult {
  state: SafarState;
  restored: boolean;
  message?: string;
  validation?: ValidationResult;
}

export interface SaveStateResult {
  ok: boolean;
  savedAt: string;
  error?: string;
}

function createMemoryStorage(seed: Record<string, string> = {}): StorageLike & {
  dump(): Record<string, string>;
} {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return Object.fromEntries(data.entries());
    },
  };
}

const fallbackStorage = createMemoryStorage();

/** Uses browser LocalStorage when available; otherwise an in-memory demo store. */
export function getDefaultStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Access to LocalStorage can throw in private/embedded contexts.
  }
  return fallbackStorage;
}

function restoreWithNotice(
  options: InitialStateOptions,
  message: string,
  validation?: ValidationResult,
): LoadStateResult {
  return {
    state: getInitialState(options),
    restored: true,
    message,
    validation,
  };
}

function parseAndValidate(
  raw: string,
): { state?: SafarState; validation: ValidationResult } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      validation: { valid: false, errors: ["Stored state is not valid JSON."], warnings: [] },
    };
  }
  const validation = validateState(parsed);
  return validation.valid ? { state: parsed as SafarState, validation } : { validation };
}

/**
 * Loads the versioned persisted state. Malformed or incompatible data is never
 * applied: the canonical seed state is restored with a non-blocking notice.
 */
export function loadState(
  storage: StorageLike = getDefaultStorage(),
  options: InitialStateOptions = {},
): LoadStateResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return restoreWithNotice(
      options,
      "Stored SAFAR state could not be read. Demo seed data was restored.",
    );
  }
  if (!raw) {
    return { state: getInitialState(options), restored: false };
  }

  const parsed = parseAndValidate(raw);
  if (!parsed.state) {
    return restoreWithNotice(
      options,
      "Stored SAFAR state was malformed or from an incompatible schema version. Demo seed data was restored.",
      parsed.validation,
    );
  }
  if (parsed.validation.warnings.length > 0) {
    return {
      state: parsed.state,
      restored: false,
      message: parsed.validation.warnings.join(" "),
      validation: parsed.validation,
    };
  }
  return { state: parsed.state, restored: false, validation: parsed.validation };
}

export function saveState(
  state: SafarState,
  storage: StorageLike = getDefaultStorage(),
): SaveStateResult {
  const savedAt = new Date().toISOString();
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, savedAt };
  } catch (error) {
    return {
      ok: false,
      savedAt,
      error:
        error instanceof Error
          ? `State could not be saved: ${error.message}`
          : "State could not be saved.",
    };
  }
}

export function clearState(storage: StorageLike = getDefaultStorage()): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; the UI can still reset in memory.
  }
}

/** Restores the exact initial demo state and persists it. */
export function resetState(
  storage: StorageLike = getDefaultStorage(),
  options: InitialStateOptions = {},
): LoadStateResult {
  const state = getInitialState(options);
  clearState(storage);
  const saved = saveState(state, storage);
  return {
    state,
    restored: true,
    message: saved.ok
      ? "Demo scenario reset to the original seed state."
      : "Demo scenario reset in memory, but the reset state could not be persisted.",
  };
}

export function exportStateAsJSON(state: SafarState): string {
  return JSON.stringify(state, null, 2);
}

export function importStateFromJSON(
  raw: string,
  options: InitialStateOptions = {},
): LoadStateResult {
  const parsed = parseAndValidate(raw);
  if (!parsed.state) {
    return restoreWithNotice(
      options,
      "Imported SAFAR state was invalid. Demo seed data was restored.",
      parsed.validation,
    );
  }
  return { state: parsed.state, restored: false, validation: parsed.validation };
}

export { STORAGE_KEY, createMemoryStorage, validateState };

export const persistenceService = {
  STORAGE_KEY,
  getDefaultStorage,
  loadState,
  saveState,
  clearState,
  resetState,
  exportStateAsJSON,
  importStateFromJSON,
  createMemoryStorage,
};
