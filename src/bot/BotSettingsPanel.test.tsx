import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BotSettingsPanel from "./BotSettingsPanel";

describe("BotSettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders all four fields", () => {
    render(<BotSettingsPanel onConnect={() => {}} />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/topic/i)).toBeDefined();
    expect(screen.getByLabelText(/model/i)).toBeDefined();
    expect(screen.getByLabelText(/prompt/i)).toBeDefined();
  });

  it("renders a Connect button", () => {
    render(<BotSettingsPanel onConnect={() => {}} />);
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders a Browse button for the prompt field", () => {
    render(<BotSettingsPanel onConnect={() => {}} />);
    expect(screen.getByRole("button", { name: /browse/i })).toBeDefined();
  });

  it("Connect button is disabled when fields are empty", () => {
    render(<BotSettingsPanel onConnect={() => {}} />);
    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Connect button is enabled when all four fields are filled", async () => {
    const user = userEvent.setup();
    render(<BotSettingsPanel onConnect={() => {}} />);

    await user.type(screen.getByLabelText(/name/i), "Bob");
    await user.type(screen.getByLabelText(/topic/i), "chat");
    await user.type(screen.getByLabelText(/model/i), "claude-haiku-4-5-20251001");
    // Simulate file selection by directly setting promptPath via the hidden input
    // We'll use a programmatic approach since file pickers can't be driven by userEvent
    const promptInput = screen.getByLabelText(/prompt/i) as HTMLInputElement;
    await user.type(promptInput, "/prompts/friendly.md");

    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onConnect with all four values when Connect is clicked", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(<BotSettingsPanel onConnect={onConnect} />);

    await user.type(screen.getByLabelText(/name/i), "Bob");
    await user.type(screen.getByLabelText(/topic/i), "chat");
    await user.type(screen.getByLabelText(/model/i), "claude-haiku-4-5-20251001");
    const promptInput = screen.getByLabelText(/prompt/i) as HTMLInputElement;
    await user.type(promptInput, "/prompts/friendly.md");

    // We need promptContent to be set too. Simulate it by triggering file read
    // The component will have empty promptContent since no real file was picked,
    // but the path is set. For this test we only verify the shape of the call.
    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledOnce();
    const arg = onConnect.mock.calls[0][0];
    expect(arg.name).toBe("Bob");
    expect(arg.topic).toBe("chat");
    expect(arg.model).toBe("claude-haiku-4-5-20251001");
    expect(arg.promptPath).toBe("/prompts/friendly.md");
  });

  it("saves all four values to localStorage history on connect", async () => {
    const user = userEvent.setup();
    render(<BotSettingsPanel onConnect={() => {}} />);

    await user.type(screen.getByLabelText(/name/i), "Bob");
    await user.type(screen.getByLabelText(/topic/i), "chat");
    await user.type(screen.getByLabelText(/model/i), "claude-haiku-4-5-20251001");
    const promptInput = screen.getByLabelText(/prompt/i) as HTMLInputElement;
    await user.type(promptInput, "/prompts/friendly.md");

    await user.click(screen.getByRole("button", { name: /connect/i }));

    const stored = JSON.parse(localStorage.getItem("socialbot:bot-history") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Bob");
    expect(stored[0].model).toBe("claude-haiku-4-5-20251001");
    expect(stored[0].promptPath).toBe("/prompts/friendly.md");
  });

  it("shows model history in datalist from localStorage", async () => {
    localStorage.setItem(
      "socialbot:bot-history",
      JSON.stringify([
        {
          name: "Bob",
          topic: "chat",
          model: "claude-haiku-4-5-20251001",
          promptPath: "/prompts/a.md",
          promptContent: "A",
        },
      ]),
    );

    render(<BotSettingsPanel onConnect={() => {}} />);

    await waitFor(() => {
      const options = document.querySelectorAll("#model-history option");
      const values = Array.from(options).map((o) => o.getAttribute("value"));
      expect(values).toContain("claude-haiku-4-5-20251001");
    });
  });

  it("shows prompt path history in datalist from localStorage", async () => {
    localStorage.setItem(
      "socialbot:bot-history",
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

    render(<BotSettingsPanel onConnect={() => {}} />);

    await waitFor(() => {
      const options = document.querySelectorAll("#prompt-path-history option");
      const values = Array.from(options).map((o) => o.getAttribute("value"));
      expect(values).toContain("/prompts/friendly.md");
    });
  });
});
