import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAvailableModels } from "./useAvailableModels";

describe("useAvailableModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with ['None'] before fetch resolves", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAvailableModels([]));
    expect(result.current[0]).toBe("None");
  });

  it("includes server models after fetch resolves", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ models: ["claude-haiku-4-5-20251001", "gpt-4o"] }),
    } as Response);

    const { result } = renderHook(() => useAvailableModels([]));

    await waitFor(() => {
      expect(result.current).toContain("claude-haiku-4-5-20251001");
    });
    expect(result.current).toContain("gpt-4o");
    expect(result.current[0]).toBe("None");
  });

  it("falls back to ['None'] when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAvailableModels([]));

    await waitFor(() => {
      // After failing, still just ['None']
      expect(result.current).toEqual(["None"]);
    });
  });

  it("appends history models not already in the list", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ models: ["claude-haiku-4-5-20251001"] }),
    } as Response);

    const { result } = renderHook(() =>
      useAvailableModels(["claude-haiku-4-5-20251001", "my-custom-model"]),
    );

    await waitFor(() => {
      expect(result.current).toContain("claude-haiku-4-5-20251001");
    });
    // custom model from history should be appended (not a duplicate)
    expect(result.current).toContain("my-custom-model");
    // no duplicates
    const haiku = result.current.filter((m) => m === "claude-haiku-4-5-20251001");
    expect(haiku).toHaveLength(1);
  });

  it("does not duplicate 'None'", async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ models: [] }),
    } as Response);

    const { result } = renderHook(() => useAvailableModels([]));

    await waitFor(() => {
      expect(result.current).toEqual(["None"]);
    });
  });
});
