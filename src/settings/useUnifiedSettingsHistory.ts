import { useState, useCallback } from "react";
import { type HistoryEntry } from "./useSettingsHistory";
import { type BotHistoryEntry } from "../bot/useBotSettingsHistory";

/** A unified session entry covering both human and bot modes. */
export interface UnifiedEntry {
  name: string;
  topic: string;
  natsUrl: string;
  /** Empty string means human mode. */
  model: string;
  promptPath: string;
  promptContent: string;
}

const HUMAN_KEY = "socialbot:history";
const BOT_KEY = "socialbot:bot-history";

function loadHumanHistory(): UnifiedEntry[] {
  try {
    const raw = localStorage.getItem(HUMAN_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Partial<HistoryEntry>[]).map((e) => ({
      name: e.name ?? "",
      topic: e.topic ?? "",
      natsUrl: e.natsUrl ?? "ws://localhost:9222",
      model: "",
      promptPath: "",
      promptContent: "",
    }));
  } catch {
    return [];
  }
}

function loadBotHistory(): UnifiedEntry[] {
  try {
    const raw = localStorage.getItem(BOT_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Partial<BotHistoryEntry>[]).map((e) => ({
      name: e.name ?? "",
      topic: e.topic ?? "",
      natsUrl: "ws://localhost:9222",
      model: e.model ?? "",
      promptPath: e.promptPath ?? "",
      promptContent: e.promptContent ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Merge human history and bot history into a single list. Bot-history wins on
 * duplicate name+topic pairs.
 */
function loadMergedHistory(): UnifiedEntry[] {
  const human = loadHumanHistory();
  const bot = loadBotHistory();

  // Start with bot entries; add human entries only where there is no same-key bot entry
  const botKeys = new Set(bot.map((e) => `${e.name}\0${e.topic}`));
  const humanOnly = human.filter((e) => !botKeys.has(`${e.name}\0${e.topic}`));
  return [...bot, ...humanOnly];
}

function saveHumanHistory(entry: UnifiedEntry): void {
  try {
    const existing: HistoryEntry[] = (() => {
      const raw = localStorage.getItem(HUMAN_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as HistoryEntry[];
    })();
    const filtered = existing.filter((e) => !(e.name === entry.name && e.topic === entry.topic));
    const updated: HistoryEntry[] = [
      { name: entry.name, topic: entry.topic, natsUrl: entry.natsUrl },
      ...filtered,
    ];
    localStorage.setItem(HUMAN_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

function saveBotHistory(entry: UnifiedEntry): void {
  try {
    const existing: BotHistoryEntry[] = (() => {
      const raw = localStorage.getItem(BOT_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as BotHistoryEntry[];
    })();
    const filtered = existing.filter((e) => !(e.name === entry.name && e.topic === entry.topic));
    const updated: BotHistoryEntry[] = [
      {
        name: entry.name,
        topic: entry.topic,
        model: entry.model,
        promptPath: entry.promptPath,
        promptContent: entry.promptContent,
      },
      ...filtered,
    ];
    localStorage.setItem(BOT_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

interface UseUnifiedSettingsHistoryResult {
  /** Merged history from both human and bot storage, most recent first. */
  history: UnifiedEntry[];
  /** Unique model strings from bot entries, most recent first, excluding empty. */
  modelHistory: string[];
  /** Unique prompt path+content pairs from bot entries. */
  promptHistory: Array<{ promptPath: string; promptContent: string }>;
  /** Add a new entry; routes to the appropriate storage key based on model. */
  addEntry: (entry: UnifiedEntry) => void;
}

/**
 * Unified settings history hook. Reads from both ``"socialbot:history"`` (human) and
 * ``"socialbot:bot-history"`` (bot) on init, merging them with bot-history winning on
 * duplicates. Writes back to the appropriate key based on whether ``model`` is set.
 */
export function useUnifiedSettingsHistory(): UseUnifiedSettingsHistoryResult {
  const [history, setHistory] = useState<UnifiedEntry[]>(() => loadMergedHistory());

  const addEntry = useCallback((entry: UnifiedEntry) => {
    if (entry.model === "") {
      saveHumanHistory(entry);
    } else {
      saveBotHistory(entry);
    }
    setHistory((prev) => {
      const filtered = prev.filter((e) => !(e.name === entry.name && e.topic === entry.topic));
      return [entry, ...filtered];
    });
  }, []);

  const modelHistory = Array.from(new Set(history.map((e) => e.model).filter(Boolean)));

  const seenPaths = new Set<string>();
  const promptHistory = history
    .filter((e) => e.promptPath && !seenPaths.has(e.promptPath) && seenPaths.add(e.promptPath))
    .map((e) => ({ promptPath: e.promptPath, promptContent: e.promptContent }));

  return { history, modelHistory, promptHistory, addEntry };
}
