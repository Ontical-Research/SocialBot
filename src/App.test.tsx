import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "./App";
import type { UnifiedEntry } from "./settings/useUnifiedSettingsHistory";

// ---------------------------------------------------------------------------
// Mock NatsClient
// ---------------------------------------------------------------------------

vi.mock("./nats/NatsClient", () => ({
  NatsClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const defaultConfig = { natsUrl: "ws://localhost:9222", agents: [] };

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

    await screen.findByLabelText(/model/i);

    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.type(screen.getByLabelText(/topic/i), "chat.room1");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ models: [] }),
      } as Response),
    );

    await user.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByText(/chat\.room1/i)).toBeDefined();
    });
  });

  it("bot path: renders BotChatView after connecting with a model and prompt", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("claude-haiku-4-5-20251001")).toBeDefined();
    });
  });

  it("shows a '+' button to add a new tab", async () => {
    render(<App />);
    await screen.findByRole("button", { name: /connect/i });
    expect(screen.getByRole("button", { name: /\+/ })).toBeDefined();
  });

  it("adds a new tab when '+' is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: /connect/i });

    const addButton = screen.getByRole("button", { name: /\+/ });
    await user.click(addButton);

    // Should now have two "New agent" tabs in the tab strip
    const newAgentLabels = screen.getAllByText(/new agent/i);
    expect(newAgentLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a remove button on each tab", async () => {
    render(<App />);
    await screen.findByRole("button", { name: /connect/i });
    // There should be a remove/close button in the tab strip
    expect(screen.getByRole("button", { name: /remove tab|×/i })).toBeDefined();
  });

  it("shows confirmation before removing a tab", async () => {
    const user = userEvent.setup();
    // Add a second tab first so we can remove one
    render(<App />);
    await screen.findByRole("button", { name: /connect/i });

    await user.click(screen.getByRole("button", { name: /\+/ }));

    // Click the remove button on the first tab
    const removeButtons = screen.getAllByRole("button", { name: /remove tab|×/i });
    await user.click(removeButtons[0]);

    // Should show a confirmation
    expect(screen.getByText(/confirm/i)).toBeDefined();
  });

  it("does not remove the last remaining tab", async () => {
    render(<App />);
    await screen.findByRole("button", { name: /connect/i });

    // There's only one tab — its remove button should be disabled or hidden
    const removeButton = screen.getByRole("button", { name: /remove tab|×/i });
    expect(removeButton.hasAttribute("disabled")).toBe(true);
  });

  it("rejects duplicate names on connect", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText(/model/i);

    // Connect the first tab as Alice
    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.type(screen.getByLabelText(/topic/i), "chat");
    await user.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => {
      expect(screen.getByText(/chat/i)).toBeDefined();
    });

    // Add a second tab
    await user.click(screen.getByRole("button", { name: /\+/ }));

    // Try to connect as Alice again
    const nameInputs = screen.getAllByLabelText(/name/i);
    // The second (new) tab's form input should be visible
    const newNameInput = nameInputs[nameInputs.length - 1];
    await user.type(newNameInput, "Alice");
    await user.type(
      screen.getAllByLabelText(/topic/i)[screen.getAllByLabelText(/topic/i).length - 1],
      "chat",
    );

    // Connect button should be disabled due to duplicate name
    const connectButtons = screen.getAllByRole("button", { name: /connect/i });
    expect(connectButtons[connectButtons.length - 1].hasAttribute("disabled")).toBe(true);
  });

  it("pre-populates tabs from initialAgents prop, skipping login form", async () => {
    const agents: UnifiedEntry[] = [
      {
        name: "Alice",
        topic: "chat",
        natsUrl: "ws://localhost:9222",
        model: "",
        promptPath: "",
        promptContent: "",
      },
    ];

    render(<App initialAgents={agents} />);

    // Alice's tab should appear in the tab strip with her name
    await waitFor(() => {
      // Alice's name appears in the tab label
      expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    });

    // No Connect button visible (we're already on chat view)
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
    });
  });
});
