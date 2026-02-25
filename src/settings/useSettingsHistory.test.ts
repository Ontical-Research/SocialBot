import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSettingsHistory } from "./useSettingsHistory";

const STORAGE_KEY = "socialbot:history";

describe("useSettingsHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty history initially when localStorage is empty", () => {
    const { result } = renderHook(() => useSettingsHistory());
    expect(result.current.history).toEqual([]);
  });

  it("adds an entry to history", () => {
    const { result } = renderHook(() => useSettingsHistory());

    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });

    expect(result.current.history).toEqual([{ name: "Alice", topic: "chat.room1" }]);
  });

  it("adds multiple entries, most recent first", () => {
    const { result } = renderHook(() => useSettingsHistory());

    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });
    act(() => {
      result.current.addEntry({ name: "Bob", topic: "chat.room2" });
    });

    expect(result.current.history).toEqual([
      { name: "Bob", topic: "chat.room2" },
      { name: "Alice", topic: "chat.room1" },
    ]);
  });

  it("deduplicates identical name+topic pairs (moves to front)", () => {
    const { result } = renderHook(() => useSettingsHistory());

    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });
    act(() => {
      result.current.addEntry({ name: "Bob", topic: "chat.room2" });
    });
    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });

    expect(result.current.history).toEqual([
      { name: "Alice", topic: "chat.room1" },
      { name: "Bob", topic: "chat.room2" },
    ]);
    expect(result.current.history).toHaveLength(2);
  });

  it("does not add a duplicate of the exact same entry", () => {
    const { result } = renderHook(() => useSettingsHistory());

    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });
    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });

    expect(result.current.history).toHaveLength(1);
  });

  it("persists entries to localStorage", () => {
    const { result } = renderHook(() => useSettingsHistory());

    act(() => {
      result.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toEqual([{ name: "Alice", topic: "chat.room1" }]);
  });

  it("reads existing history from localStorage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { name: "Bob", topic: "chat.room2" },
        { name: "Alice", topic: "chat.room1" },
      ]),
    );

    const { result } = renderHook(() => useSettingsHistory());

    expect(result.current.history).toEqual([
      { name: "Bob", topic: "chat.room2" },
      { name: "Alice", topic: "chat.room1" },
    ]);
  });

  it("persists across hook re-renders (simulated remount)", () => {
    const { result: result1 } = renderHook(() => useSettingsHistory());

    act(() => {
      result1.current.addEntry({ name: "Alice", topic: "chat.room1" });
    });

    // Simulate a new component instance reading from localStorage
    const { result: result2 } = renderHook(() => useSettingsHistory());
    expect(result2.current.history).toEqual([{ name: "Alice", topic: "chat.room1" }]);
  });
});
