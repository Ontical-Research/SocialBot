import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UnifiedSettingsPanel from "./UnifiedSettingsPanel";

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
  const select = (await screen.findByLabelText(/model/i)) as HTMLSelectElement;
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
) {
  const user = userEvent.setup();
  render(<UnifiedSettingsPanel onConnect={onConnect} />);
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
    const select = await screen.findByLabelText(/model/i);
    expect((select as HTMLSelectElement).options[0].value).toBe("None");
  });

  it("Prompt select is disabled when model is 'None'", async () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    await screen.findByLabelText(/model/i);
    const promptSelect = screen.getByLabelText(/prompt/i) as HTMLSelectElement;
    expect(promptSelect.disabled).toBe(true);
  });
});

describe("UnifiedSettingsPanel — server models", () => {
  it("populates Model select with server models after fetch", async () => {
    mockFetch(["claude-haiku-4-5-20251001", "gpt-4o"]);
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    const select = await screen.findByLabelText(/model/i);
    await waitFor(() => {
      const values = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
      expect(values).toContain("claude-haiku-4-5-20251001");
      expect(values).toContain("gpt-4o");
    });
  });
});

describe("UnifiedSettingsPanel — Connect button state", () => {
  it("Connect is disabled when name or topic is empty", () => {
    render(<UnifiedSettingsPanel onConnect={() => {}} />);
    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Connect is enabled when name + topic filled and model is None (human mode)", async () => {
    await setupHumanForm();
    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("Connect is disabled when model is set but no prompt selected", async () => {
    await setupBotForm();
    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
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

    const promptSelect = screen.getByLabelText(/prompt/i) as HTMLSelectElement;
    expect(promptSelect.disabled).toBe(false);

    await user.selectOptions(promptSelect, "prompts/friendly.md");

    const btn = screen.getByRole("button", { name: /connect/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onConnect with model and prompt in bot mode", async () => {
    localStorage.setItem("socialbot:bot-history", BOT_HISTORY_FIXTURE);
    const onConnect = vi.fn();
    const user = await setupBotForm(onConnect);

    const promptSelect = screen.getByLabelText(/prompt/i) as HTMLSelectElement;
    await user.selectOptions(promptSelect, "prompts/friendly.md");
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

    const promptSelect = screen.getByLabelText(/prompt/i) as HTMLSelectElement;
    await user.selectOptions(promptSelect, "prompts/friendly.md");
    await user.click(screen.getByRole("button", { name: /connect/i }));

    const stored = JSON.parse(localStorage.getItem("socialbot:bot-history") ?? "[]");
    const newEntry = stored.find((e: { name: string }) => e.name === "NewBot");
    expect(newEntry).toBeDefined();
    expect(newEntry.model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("UnifiedSettingsPanel — file browse", () => {
  it("shows a 'Browse...' option at the bottom of Prompt select when model is set", async () => {
    await setupBotForm();
    const promptSelect = screen.getByLabelText(/prompt/i) as HTMLSelectElement;
    const optionValues = Array.from(promptSelect.options).map((o) => o.value);
    expect(optionValues).toContain("__browse__");
  });
});
