import { useState, useCallback } from "react";

/** A bot session entry stored in localStorage history. */
export interface BotHistoryEntry {
  name: string;
  topic: string;
  model: string;
  promptPath: string;
  promptContent: string;
}

const STORAGE_KEY = "socialbot:bot-history";

function loadHistory(): BotHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Partial<BotHistoryEntry>[]).map((e) => ({
      name: e.name ?? "",
      topic: e.topic ?? "",
      model: e.model ?? "",
      promptPath: e.promptPath ?? "",
      promptContent: e.promptContent ?? "",
    }));
  } catch {
    return [];
  }
}

function saveHistory(entries: BotHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

interface UseBotSettingsHistoryResult {
  history: BotHistoryEntry[];
  /** Unique model strings from history, most recent first. */
  modelHistory: string[];
  /** Unique promptPath strings from history, most recent first. */
  promptPathHistory: string[];
  /** Add a new entry, deduplicating by all four identity fields. */
  addEntry: (entry: BotHistoryEntry) => void;
}

/**
 * Custom hook for reading and writing the bot settings history stored in
 * localStorage under the key ``"socialbot:bot-history"``. Entries include name,
 * topic, model, promptPath, and promptContent. Duplicate entries (same
 * name+topic+model+promptPath) are moved to the front.
 */
export function useBotSettingsHistory(): UseBotSettingsHistoryResult {
  const [history, setHistory] = useState<BotHistoryEntry[]>(() => loadHistory());

  const addEntry = useCallback((entry: BotHistoryEntry) => {
    setHistory((prev) => {
      const filtered = prev.filter(
        (e) =>
          !(
            e.name === entry.name &&
            e.topic === entry.topic &&
            e.model === entry.model &&
            e.promptPath === entry.promptPath
          ),
      );
      const updated = [entry, ...filtered];
      saveHistory(updated);
      return updated;
    });
  }, []);

  const modelHistory = Array.from(new Set(history.map((e) => e.model))).filter(Boolean);
  const promptPathHistory = Array.from(new Set(history.map((e) => e.promptPath))).filter(Boolean);

  return { history, modelHistory, promptPathHistory, addEntry };
}
