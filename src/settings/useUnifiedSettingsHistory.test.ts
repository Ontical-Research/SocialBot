import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useUnifiedSettingsHistory } from "./useUnifiedSettingsHistory";

const HUMAN_KEY = "socialbot:history";
const BOT_KEY = "socialbot:bot-history";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useUnifiedSettingsHistory — initial state", () => {
  it("returns empty history when no storage", () => {
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.history).toEqual([]);
  });

  it("reads human entries from socialbot:history as UnifiedEntry with model=''", () => {
    localStorage.setItem(
      HUMAN_KEY,
      JSON.stringify([{ name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" }]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      name: "Alice",
      topic: "chat.room1",
      natsUrl: "ws://localhost:9222",
      model: "",
      promptPath: "",
      promptContent: "",
    });
  });

  it("reads bot entries from socialbot:bot-history", () => {
    localStorage.setItem(
      BOT_KEY,
      JSON.stringify([
        {
          name: "Bot",
          topic: "chat.room1",
          natsUrl: "ws://localhost:9222",
          model: "claude-haiku-4-5-20251001",
          promptPath: "prompts/friendly.md",
          promptContent: "Be friendly.",
        },
      ]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("bot-history wins over human history on duplicate name+topic", () => {
    localStorage.setItem(
      HUMAN_KEY,
      JSON.stringify([{ name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" }]),
    );
    localStorage.setItem(
      BOT_KEY,
      JSON.stringify([
        {
          name: "Alice",
          topic: "chat.room1",
          natsUrl: "ws://localhost:9222",
          model: "claude-sonnet-4-6",
          promptPath: "p.md",
          promptContent: "Hello",
        },
      ]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    // Should only have one entry (bot-history wins) with the bot model
    const aliceEntries = result.current.history.filter(
      (e) => e.name === "Alice" && e.topic === "chat.room1",
    );
    expect(aliceEntries).toHaveLength(1);
    expect(aliceEntries[0].model).toBe("claude-sonnet-4-6");
  });

  it("merges entries from both storage keys", () => {
    localStorage.setItem(
      HUMAN_KEY,
      JSON.stringify([{ name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" }]),
    );
    localStorage.setItem(
      BOT_KEY,
      JSON.stringify([
        {
          name: "Bot",
          topic: "chat.room2",
          natsUrl: "ws://localhost:9222",
          model: "claude-haiku-4-5-20251001",
          promptPath: "p.md",
          promptContent: "Hello",
        },
      ]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.history).toHaveLength(2);
  });
});

describe("useUnifiedSettingsHistory — modelHistory", () => {
  it("returns unique models from history, excluding empty string", () => {
    localStorage.setItem(
      BOT_KEY,
      JSON.stringify([
        {
          name: "A",
          topic: "t1",
          natsUrl: "ws://localhost:9222",
          model: "claude-haiku-4-5-20251001",
          promptPath: "p.md",
          promptContent: "",
        },
        {
          name: "B",
          topic: "t2",
          natsUrl: "ws://localhost:9222",
          model: "claude-sonnet-4-6",
          promptPath: "p.md",
          promptContent: "",
        },
      ]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.modelHistory).toContain("claude-haiku-4-5-20251001");
    expect(result.current.modelHistory).toContain("claude-sonnet-4-6");
    expect(result.current.modelHistory).not.toContain("");
  });
});

describe("useUnifiedSettingsHistory — promptHistory", () => {
  it("returns unique promptPath+promptContent pairs from history", () => {
    localStorage.setItem(
      BOT_KEY,
      JSON.stringify([
        {
          name: "A",
          topic: "t1",
          natsUrl: "ws://localhost:9222",
          model: "claude-haiku-4-5-20251001",
          promptPath: "prompts/friendly.md",
          promptContent: "Be friendly.",
        },
        {
          name: "B",
          topic: "t2",
          natsUrl: "ws://localhost:9222",
          model: "claude-sonnet-4-6",
          promptPath: "prompts/strict.md",
          promptContent: "Be strict.",
        },
      ]),
    );
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    expect(result.current.promptHistory).toHaveLength(2);
    expect(result.current.promptHistory[0].promptPath).toBe("prompts/friendly.md");
  });
});

describe("useUnifiedSettingsHistory — addEntry", () => {
  it("human entry (model='') writes to socialbot:history", () => {
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    act(() => {
      result.current.addEntry({
        name: "Alice",
        topic: "chat.room1",
        natsUrl: "ws://localhost:9222",
        model: "",
        promptPath: "",
        promptContent: "",
      });
    });
    const stored = JSON.parse(localStorage.getItem(HUMAN_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Alice");
    // Should NOT write to bot-history
    expect(localStorage.getItem(BOT_KEY)).toBeNull();
  });

  it("bot entry (model set) writes to socialbot:bot-history", () => {
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    act(() => {
      result.current.addEntry({
        name: "Bot",
        topic: "chat.room1",
        natsUrl: "ws://localhost:9222",
        model: "claude-haiku-4-5-20251001",
        promptPath: "p.md",
        promptContent: "Hello",
      });
    });
    const stored = JSON.parse(localStorage.getItem(BOT_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].model).toBe("claude-haiku-4-5-20251001");
    // Should NOT write to human history
    expect(localStorage.getItem(HUMAN_KEY)).toBeNull();
  });

  it("adding an entry updates the history in state", () => {
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    act(() => {
      result.current.addEntry({
        name: "Alice",
        topic: "chat.room1",
        natsUrl: "ws://localhost:9222",
        model: "",
        promptPath: "",
        promptContent: "",
      });
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].name).toBe("Alice");
  });

  it("deduplicates by name+topic (most recent first)", () => {
    const { result } = renderHook(() => useUnifiedSettingsHistory());
    act(() => {
      result.current.addEntry({
        name: "Alice",
        topic: "chat.room1",
        natsUrl: "ws://old",
        model: "",
        promptPath: "",
        promptContent: "",
      });
    });
    act(() => {
      result.current.addEntry({
        name: "Alice",
        topic: "chat.room1",
        natsUrl: "ws://new",
        model: "",
        promptPath: "",
        promptContent: "",
      });
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].natsUrl).toBe("ws://new");
  });
});
