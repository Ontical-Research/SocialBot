import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "./useTheme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mq = {
    matches: prefersDark,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    },
  };
  vi.stubGlobal("matchMedia", (query: string) => {
    if (query === "(prefers-color-scheme: dark)") return mq;
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  });
  return {
    fireChange: (newMatches: boolean) => {
      listeners.forEach((cb) => {
        cb({ matches: newMatches } as MediaQueryListEvent);
      });
    },
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it("defaults to dark when system prefers dark (no localStorage)", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defaults to light when system prefers light (no localStorage)", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("respects saved 'dark' preference over system light", () => {
    localStorage.setItem("socialbot:theme", "dark");
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it("respects saved 'light' preference over system dark", () => {
    localStorage.setItem("socialbot:theme", "light");
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });

  it("toggle() dark→light updates isDark, localStorage, and documentElement", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem("socialbot:theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggle() light→dark updates isDark, localStorage, and documentElement", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem("socialbot:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("system-pref change event updates isDark when no localStorage preference", () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    // The mount effect writes the initial value to localStorage. Remove it so
    // the change-event handler sees "no user preference" and responds.
    localStorage.removeItem("socialbot:theme");

    act(() => {
      fireChange(true);
    });

    expect(result.current.isDark).toBe(true);
  });

  it("system-pref change is ignored after user explicitly sets preference", () => {
    const { fireChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    // User explicitly sets dark
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem("socialbot:theme")).toBe("dark");

    // System flips to light — should be ignored
    act(() => {
      fireChange(false);
    });

    expect(result.current.isDark).toBe(true);
  });
});
