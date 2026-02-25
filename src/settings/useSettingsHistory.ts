import { useState, useCallback } from "react";

/** A name+topic pair stored in localStorage history. */
export interface HistoryEntry {
  name: string;
  topic: string;
}

const STORAGE_KEY = "socialbot:history";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

interface UseSettingsHistoryResult {
  /** Ordered list of history entries, most recent first. */
  history: HistoryEntry[];
  /** Add a new entry, deduplicating by name+topic (moves to front if already exists). */
  addEntry: (entry: HistoryEntry) => void;
}

/**
 * Custom hook for reading and writing the settings history stored in localStorage
 * under the key ``"socialbot:history"``. Entries are stored as a JSON array of
 * ``{name, topic}`` objects, most recent first. Duplicate name+topic pairs are
 * deduplicated — the existing entry is removed and the new one is placed at the front.
 */
export function useSettingsHistory(): UseSettingsHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const addEntry = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      // Remove any existing entry with the same name+topic
      const filtered = prev.filter((e) => !(e.name === entry.name && e.topic === entry.topic));
      const updated = [entry, ...filtered];
      saveHistory(updated);
      return updated;
    });
  }, []);

  return { history, addEntry };
}
