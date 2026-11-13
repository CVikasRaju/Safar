import { useCallback, useEffect, useState } from "react";
import type { JourneyWatch } from "../../domain/types/journey";
import { WATCHES_UPDATED_EVENT, loadWatches } from "./journeyWatch";

export function useJourneyWatches(): JourneyWatch[] {
  const [watches, setWatches] = useState<JourneyWatch[]>(() => loadWatches());

  useEffect(() => {
    const refresh = () => setWatches(loadWatches());
    window.addEventListener(WATCHES_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(WATCHES_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return watches;
}

const READ_KEY = "safar-student-alert-reads-v1";

function loadReadIds(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export interface AlertReadState {
  readIds: string[];
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
}

/** Read/unread tracking for student alerts; purely presentational UI state. */
export function useAlertReadState(): AlertReadState {
  const [readIds, setReadIds] = useState<string[]>(() => loadReadIds());

  const persist = useCallback((ids: string[]) => {
    setReadIds(ids);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage failures; read state is cosmetic.
    }
  }, []);

  const isRead = useCallback((id: string) => readIds.includes(id), [readIds]);
  const markRead = useCallback(
    (id: string) => {
      if (readIds.includes(id)) return;
      persist([...readIds, id]);
    },
    [persist, readIds],
  );
  const markAllRead = useCallback(
    (ids: string[]) => {
      const merged = [...new Set([...readIds, ...ids])];
      persist(merged);
    },
    [persist, readIds],
  );

  return { readIds, isRead, markRead, markAllRead };
}
