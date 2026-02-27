import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BotChatView from "./BotChatView";
import type { BotHistoryEntry } from "./useBotSettingsHistory";
import type { ChatMessage } from "./useBotSession";

// ---------------------------------------------------------------------------
// Mock useBotSession so we control history / error / thinking
// ---------------------------------------------------------------------------

const mockUseBotSession = vi.fn();

vi.mock("./useBotSession", () => ({
  useBotSession: (session: BotHistoryEntry) => mockUseBotSession(session),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION: BotHistoryEntry = {
  name: "Bob",
  topic: "chat",
  model: "claude-haiku-4-5",
  promptPath: "prompts/friendly.md",
  promptContent: "You are a friendly assistant named Bob.",
};

function renderView(
  overrides: { history?: ChatMessage[]; error?: string | null; thinking?: boolean } = {},
  onLeave = vi.fn(),
) {
  mockUseBotSession.mockReturnValue({
    history: overrides.history ?? [],
    error: overrides.error ?? null,
    thinking: overrides.thinking ?? false,
  });
  return render(<BotChatView session={SESSION} onLeave={onLeave} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BotChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Status bar
  it("displays the model name in the status bar", () => {
    renderView();
    expect(screen.getByText("claude-haiku-4-5")).toBeDefined();
  });

  it("displays the prompt filename (not full path) in the status bar", () => {
    renderView();
    // Should show "friendly.md", not the full path "prompts/friendly.md"
    expect(screen.getByText("friendly.md")).toBeDefined();
  });

  it("does not display the full prompt path", () => {
    renderView();
    expect(screen.queryByText("prompts/friendly.md")).toBeNull();
  });

  // Prompt modal
  it("opens a modal with the full prompt text when prompt filename is clicked", () => {
    renderView();
    const promptBtn = screen.getByText("friendly.md");
    fireEvent.click(promptBtn);
    // Modal should now show the full prompt content
    expect(screen.getByText("You are a friendly assistant named Bob.")).toBeDefined();
  });

  it("closes the prompt modal when the close button is clicked", () => {
    renderView();
    fireEvent.click(screen.getByText("friendly.md"));
    // Modal is open
    expect(screen.getByText("You are a friendly assistant named Bob.")).toBeDefined();
    // Close it
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText("You are a friendly assistant named Bob.")).toBeNull();
  });

  // No input / send button
  it("does not render a text input", () => {
    renderView();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("does not render a send button", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });

  // Message bubbles
  it("renders incoming messages (user role) on the left", () => {
    const history: ChatMessage[] = [{ role: "user", content: "Hello Bob", name: "Alice" }];
    renderView({ history });
    const bubble = screen.getByTestId("message-bubble");
    expect(bubble.getAttribute("data-sender")).toBe("other");
  });

  it("renders bot replies (assistant role) on the right", () => {
    const history: ChatMessage[] = [{ role: "assistant", content: "Hi Alice!" }];
    renderView({ history });
    const bubble = screen.getByTestId("message-bubble");
    expect(bubble.getAttribute("data-sender")).toBe("self");
  });

  // Error banner
  it("shows an error banner when error is set", () => {
    renderView({ error: "LLM failed" });
    expect(screen.getByText(/LLM failed/)).toBeDefined();
  });

  it("shows a back-to-login link in the error banner", () => {
    renderView({ error: "LLM failed" });
    expect(screen.getByRole("button", { name: /back to login/i })).toBeDefined();
  });

  it("calls onLeave when back-to-login is clicked", () => {
    const onLeave = vi.fn();
    renderView({ error: "LLM failed" }, onLeave);
    fireEvent.click(screen.getByRole("button", { name: /back to login/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("does not show an error banner when there is no error", () => {
    renderView({ error: null });
    expect(screen.queryByRole("button", { name: /back to login/i })).toBeNull();
  });

  // Typing indicator
  it("shows a typing indicator while the LLM is thinking", () => {
    renderView({ thinking: true });
    expect(screen.getByTestId("typing-indicator")).toBeDefined();
  });

  it("does not show a typing indicator when not thinking", () => {
    renderView({ thinking: false });
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });

  // Leave button
  it("calls onLeave when the Leave chat button is clicked", () => {
    const onLeave = vi.fn();
    renderView({}, onLeave);
    fireEvent.click(screen.getByRole("button", { name: /leave chat/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
