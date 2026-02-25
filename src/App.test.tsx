import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

const mockConfig = { name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" };

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the settings panel on startup", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders name and topic inputs", async () => {
    render(<App />);
    expect(await screen.findByLabelText(/name/i)).toBeDefined();
    expect(await screen.findByLabelText(/topic/i)).toBeDefined();
  });
});
