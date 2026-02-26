import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBotSettingsHistory } from "./useBotSettingsHistory";

const STORAGE_KEY = "socialbot:bot-history";

describe("useBotSettingsHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty history initially when localStorage is empty", () => {
    const { result } = renderHook(() => useBotSettingsHistory());
    expect(result.current.history).toEqual([]);
  });

  it("adds an entry with all four fields", () => {
    const { result } = renderHook(() => useBotSettingsHistory());

    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      });
    });

    expect(result.current.history).toEqual([
      {
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      },
    ]);
  });

  it("deduplicates by name+topic+model+promptPath (moves to front)", () => {
    const { result } = renderHook(() => useBotSettingsHistory());

    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      });
    });
    act(() => {
      result.current.addEntry({
        name: "Bot2",
        topic: "chat2",
        model: "gpt-4o",
        promptPath: "/prompts/helper.md",
        promptContent: "Be helpful.",
      });
    });
    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      });
    });

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].name).toBe("Bob");
  });

  it("persists entries to localStorage under bot-history key", () => {
    const { result } = renderHook(() => useBotSettingsHistory());

    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored[0].model).toBe("claude-haiku-4-5-20251001");
    expect(stored[0].promptPath).toBe("/prompts/friendly.md");
  });

  it("reads existing history from localStorage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          name: "Bob",
          topic: "chat",
          model: "claude-haiku-4-5-20251001",
          promptPath: "/prompts/friendly.md",
          promptContent: "Be friendly.",
        },
      ]),
    );

    const { result } = renderHook(() => useBotSettingsHistory());

    expect(result.current.history[0].model).toBe("claude-haiku-4-5-20251001");
    expect(result.current.history[0].promptPath).toBe("/prompts/friendly.md");
  });

  it("exposes unique model strings for dropdown history", () => {
    const { result } = renderHook(() => useBotSettingsHistory());

    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/a.md",
        promptContent: "A",
      });
    });
    act(() => {
      result.current.addEntry({
        name: "Bot2",
        topic: "chat2",
        model: "gpt-4o",
        promptPath: "/prompts/b.md",
        promptContent: "B",
      });
    });

    expect(result.current.modelHistory).toContain("claude-haiku-4-5-20251001");
    expect(result.current.modelHistory).toContain("gpt-4o");
  });

  it("exposes unique promptPath strings for dropdown history", () => {
    const { result } = renderHook(() => useBotSettingsHistory());

    act(() => {
      result.current.addEntry({
        name: "Bob",
        topic: "chat",
        model: "claude-haiku-4-5-20251001",
        promptPath: "/prompts/friendly.md",
        promptContent: "Be friendly.",
      });
    });
    act(() => {
      result.current.addEntry({
        name: "Bot2",
        topic: "chat2",
        model: "gpt-4o",
        promptPath: "/prompts/helper.md",
        promptContent: "Be helpful.",
      });
    });

    expect(result.current.promptPathHistory).toContain("/prompts/friendly.md");
    expect(result.current.promptPathHistory).toContain("/prompts/helper.md");
  });
});
