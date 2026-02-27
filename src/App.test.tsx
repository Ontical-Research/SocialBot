import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

vi.mock("./nats/client", () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
}));

function mockFetch(config = {}, models: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url === "/api/models") {
        return Promise.resolve({ json: () => Promise.resolve({ models }) } as Response);
      }
      // /config.json
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as Response);
    }),
  );
}

async function selectModelOption(user: ReturnType<typeof userEvent.setup>, modelValue: string) {
  const select = await screen.findByLabelText(/model/i);
  await waitFor(() => {
    expect(Array.from(select.options).map((o) => o.value)).toContain(modelValue);
  });
  await user.selectOptions(select, modelValue);
}

const defaultConfig = { name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" };

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch(defaultConfig, []);
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the unified settings panel on startup", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders name, topic, model and prompt inputs", async () => {
    render(<App />);
    expect(await screen.findByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/topic/i)).toBeDefined();
    expect(await screen.findByLabelText(/model/i)).toBeDefined();
    expect(screen.getByLabelText(/prompt/i)).toBeDefined();
  });

  it("human path: renders ChatView after connecting with model=None", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByLabelText(/model/i); // wait for initial render

    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.type(screen.getByLabelText(/topic/i), "chat.room1");
    // model stays "None"

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ models: [] }),
      } as Response),
    );

    await user.click(screen.getByRole("button", { name: /connect/i }));

    // ChatView shows the topic in the header
    await waitFor(() => {
      expect(screen.getByText(/chat\.room1/i)).toBeDefined();
    });
  });

  it("bot path: renders BotChatView after connecting with a model and prompt", async () => {
    // Pre-populate prompt history
    localStorage.setItem(
      "socialbot:bot-history",
      JSON.stringify([
        {
          name: "Bot",
          topic: "chat",
          natsUrl: "ws://localhost:9222",
          model: "claude-haiku-4-5-20251001",
          promptPath: "prompts/friendly.md",
          promptContent: "Be friendly.",
        },
      ]),
    );
    mockFetch(defaultConfig, ["claude-haiku-4-5-20251001"]);

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/name/i), "Bot");
    await user.type(screen.getByLabelText(/topic/i), "chat");

    await selectModelOption(user, "claude-haiku-4-5-20251001");

    await user.selectOptions(screen.getByLabelText(/prompt/i), "prompts/friendly.md");

    await user.click(screen.getByRole("button", { name: /connect/i }));

    // BotChatView shows the model name in the status bar
    await waitFor(() => {
      expect(screen.getByText("claude-haiku-4-5-20251001")).toBeDefined();
    });
  });
});
