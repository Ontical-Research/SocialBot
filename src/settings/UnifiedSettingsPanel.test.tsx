import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UnifiedSettingsPanel from "./UnifiedSettingsPanel";

// ---------------------------------------------------------------------------
// Typed query helpers
// ---------------------------------------------------------------------------

function getSelect(label: RegExp): HTMLSelectElement {
  return screen.getByLabelText(label);
}

async function findSelect(label: RegExp): Promise<HTMLSelectElement> {
  return await screen.findByLabelText(label);
}

function getButton(name: RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name });
}

// ---------------------------------------------------------------------------
// Test fixtures & helpers
// ---------------------------------------------------------------------------

function mockFetch(models: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models }),
    } as Response),
  );
}

const BOT_HISTORY_FIXTURE = JSON.stringify([
  {
    name: "Bot",
    topic: "chat",
    model: "claude-haiku-4-5-20251001",
    promptPath: "prompts/friendly.md",
    promptContent: "Be friendly.",
  },
]);

async function selectModel(user: ReturnType<typeof userEvent.setup>, modelValue: string) {
  const select = await findSelect(/model/i);
  await waitFor(() => {
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain(modelValue);
  });
  await user.selectOptions(select, modelValue);
}

/** Render the panel and fill in name + topic for human mode. */
async function setupHumanForm(
  onConnect: () => void = () => {},
  name = "Alice",
  topic = "chat.room1",
  takenNames: string[] = [],
) {
  const user = userEvent.setup();
  render(<UnifiedSettingsPanel onConnect={onConnect} takenNames={takenNames} />);
  await screen.findByLabelText(/model/i);
  await user.type(screen.getByLabelText(/name/i), name);
  await user.type(screen.getByLabelText(/topic/i), topic);
  return user;
}

/** Render the panel in bot mode: fills name/topic and selects the model. */
async function setupBotForm(onConnect: () => void = () => {}, name = "Bot", topic = "chat") {
  mockFetch(["claude-haiku-4-5-20251001"]);
  const user = userEvent.setup();
  render(<UnifiedSettingsPanel onConnect={onConnect} />);
  await user.type(screen.getByLabelText(/name/i), name);
  await user.type(screen.getByLabelText(/topic/i), topic);
  await selectModel(user, "claude-haiku-4-5-20251001");
  return user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  mockFetch([]);
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("UnifiedSettingsPanel — rendering", () => {
  it("renders Name, Topic, Model, and Prompt fields", async () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/topic/i)).toBeDefined();
    expect(await screen.findByLabelText(/model/i)).toBeDefined();
    expect(screen.getByLabelText(/prompt/i)).toBeDefined();
  });

  it("renders a Connect button", () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("Model select has 'None' as first option", async () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    const select = await findSelect(/model/i);
    expect(select.options[0].value).toBe("None");
  });

  it("Prompt select is disabled when model is 'None'", async () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    await screen.findByLabelText(/model/i);
    expect(getSelect(/prompt/i).disabled).toBe(true);
  });
});

describe("UnifiedSettingsPanel — server models", () => {
  it("populates Model select with server models after fetch", async () => {
    mockFetch(["claude-haiku-4-5-20251001", "gpt-4o"]);
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    const select = await findSelect(/model/i);
    await waitFor(() => {
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain("claude-haiku-4-5-20251001");
      expect(values).toContain("gpt-4o");
    });
  });
});

describe("UnifiedSettingsPanel — Connect button state", () => {
  it("Connect is disabled when name or topic is empty", () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    expect(getButton(/connect/i).disabled).toBe(true);
  });

  it("Connect is enabled when name + topic filled and model is None (human mode)", async () => {
    await setupHumanForm();
    expect(getButton(/connect/i).disabled).toBe(false);
  });

  it("Connect is disabled when model is set but no prompt selected", async () => {
    await setupBotForm();
    expect(getButton(/connect/i).disabled).toBe(true);
  });
});

describe("UnifiedSettingsPanel — human mode submit", () => {
  it("calls onConnect with model='' in human mode", async () => {
    const onConnect = vi.fn();
    const user = await setupHumanForm(onConnect);

    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledOnce();
    const arg = onConnect.mock.calls[0][0];
    expect(arg.name).toBe("Alice");
    expect(arg.topic).toBe("chat.room1");
    expect(arg.model).toBe("");
  });

  it("saves human entry to socialbot:history on connect", async () => {
    const user = await setupHumanForm();
    await user.click(screen.getByRole("button", { name: /connect/i }));

    const stored = JSON.parse(localStorage.getItem("socialbot:history") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Alice");
  });
});

describe("UnifiedSettingsPanel — bot mode submit", () => {
  it("enables Prompt select and allows selecting a history prompt when model is set", async () => {
    localStorage.setItem("socialbot:bot-history", BOT_HISTORY_FIXTURE);
    const user = await setupBotForm();

    const promptSelect = getSelect(/prompt/i);
    expect(promptSelect.disabled).toBe(false);

    await user.selectOptions(promptSelect, "prompts/friendly.md");
    expect(getButton(/connect/i).disabled).toBe(false);
  });

  it("calls onConnect with model and prompt in bot mode", async () => {
    localStorage.setItem("socialbot:bot-history", BOT_HISTORY_FIXTURE);
    const onConnect = vi.fn();
    const user = await setupBotForm(onConnect);

    await user.selectOptions(getSelect(/prompt/i), "prompts/friendly.md");
    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledOnce();
    const arg = onConnect.mock.calls[0][0];
    expect(arg.model).toBe("claude-haiku-4-5-20251001");
    expect(arg.promptPath).toBe("prompts/friendly.md");
    expect(arg.promptContent).toBe("Be friendly.");
  });

  it("saves bot entry to socialbot:bot-history on connect", async () => {
    localStorage.setItem("socialbot:bot-history", BOT_HISTORY_FIXTURE);
    const user = await setupBotForm(() => {}, "NewBot", "chat2");

    await user.selectOptions(getSelect(/prompt/i), "prompts/friendly.md");
    await user.click(screen.getByRole("button", { name: /connect/i }));

    const stored = JSON.parse(localStorage.getItem("socialbot:bot-history") ?? "[]");
    const newEntry = stored.find((e: { name: string }) => e.name === "NewBot");
    expect(newEntry).toBeDefined();
    expect(newEntry.model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("UnifiedSettingsPanel — takenNames", () => {
  it("Connect is disabled when name is in takenNames", async () => {
    await setupHumanForm(() => {}, "Alice", "chat.room1", ["Alice"]);
    expect(getButton(/connect/i).disabled).toBe(true);
  });

  it("shows an error message when name is already in use", async () => {
    await setupHumanForm(() => {}, "Alice", "chat.room1", ["Alice"]);
    expect(screen.getByText(/already in use/i)).toBeDefined();
  });

  it("Connect is enabled when name is not in takenNames", async () => {
    await setupHumanForm(() => {}, "Alice", "chat.room1", ["Bob"]);
    expect(getButton(/connect/i).disabled).toBe(false);
  });

  it("does not call onConnect when name is taken", async () => {
    const onConnect = vi.fn();
    const user = await setupHumanForm(onConnect, "Alice", "chat.room1", ["Alice"]);
    await user.click(screen.getByRole("button", { name: /connect/i }));
    expect(onConnect).not.toHaveBeenCalled();
  });
});

describe("UnifiedSettingsPanel — file browse", () => {
  it("shows a 'Browse...' option at the bottom of Prompt select when model is set", async () => {
    await setupBotForm();
    const optionValues = Array.from(getSelect(/prompt/i).options).map((o) => o.value);
    expect(optionValues).toContain("__browse__");
  });

  it("shows the browsed filename as a selected option after file is loaded", async () => {
    const user = await setupBotForm();

    // Simulate file selection via the hidden input
    const fileInput = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(fileInput).toBeDefined();

    const file = new File(["Be helpful."], "helpful.md", { type: "text/plain" });
    await user.upload(fileInput!, file);

    const select = getSelect(/prompt/i);
    await waitFor(() => {
      expect(select.value).toBe("helpful.md");
    });
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("helpful.md");
  });
});
