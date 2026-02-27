import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NatsMessage } from "../nats/client";

// ---------------------------------------------------------------------------
// Mock the NATS client module
// ---------------------------------------------------------------------------

const mockConnect = vi.fn();
const mockPublish = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("../nats/client", () => ({
  connect: (...args: unknown[]) => mockConnect(...args),
  publish: (...args: unknown[]) => mockPublish(...args),
  disconnect: () => mockDisconnect(),
}));

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { useBotSession } from "./useBotSession";
import type { BotHistoryEntry } from "./useBotSettingsHistory";

const SESSION: BotHistoryEntry = {
  name: "Bob",
  topic: "chat",
  model: "claude-haiku-4-5",
  promptPath: "prompts/friendly.md",
  promptContent: "You are a friendly assistant named Bob.",
};

/** Capture the onMessage callback that was passed to connect(). */
function captureOnMessage(): (msg: NatsMessage) => void {
  const call = mockConnect.mock.calls[0];
  // connect(url, topic, name, onMessage)
  return call[3] as (msg: NatsMessage) => void;
}

function makeChatResponse(reply: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ reply }),
  };
}

function makeErrorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  };
}

/** Render the hook and wait for the initial NATS connection. */
async function setup() {
  const hook = renderHook(() => useBotSession(SESSION));
  await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
  return hook;
}

/** Send a message via the captured callback. */
async function sendMessage(text: string, sender = "Alice", timestamp = "2024-01-01T00:00:00Z") {
  const onMessage = captureOnMessage();
  await act(async () => {
    onMessage({ sender, text, timestamp });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBotSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("connects to NATS on mount with the bot's name and topic", async () => {
    await setup();

    const [, topic, name] = mockConnect.mock.calls[0];
    expect(topic).toBe("chat");
    expect(name).toBe("Bob");
  });

  it("disconnects from NATS on unmount", async () => {
    const { unmount } = await setup();

    unmount();
    await waitFor(() => expect(mockDisconnect).toHaveBeenCalledTimes(1));
  });

  it("starts with empty history and no error", async () => {
    const { result } = await setup();

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("appends incoming message to history as user role with sender name", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));
    await sendMessage("Hello Bob");

    await waitFor(() =>
      expect(result.current.history).toContainEqual({
        role: "user",
        content: "Hello Bob",
        name: "Alice",
      }),
    );
  });

  it("calls POST /api/chat with history, system prompt, and model", async () => {
    await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi there!"));
    await sendMessage("Hey");
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.systemPrompt).toBe("You are a friendly assistant named Bob.");
    expect(body.messages).toContainEqual({ role: "user", content: "Hey", name: "Alice" });
  });

  it("publishes the LLM reply to NATS", async () => {
    await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));
    await sendMessage("Hello Bob");

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish).toHaveBeenCalledWith("Hello Alice!");
  });

  it("appends the LLM reply to history as assistant role", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));
    await sendMessage("Hello Bob");

    await waitFor(() =>
      expect(result.current.history).toContainEqual({
        role: "assistant",
        content: "Hello Alice!",
      }),
    );
  });

  it("does not call /api/chat when the sender is the bot itself", async () => {
    await setup();

    await sendMessage("Hello Alice!", "Bob");

    // fetch should not have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets error state when /api/chat returns an error and does not publish", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));
    await sendMessage("Hello");

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain("LLM error");
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("clears error state when a subsequent message succeeds", async () => {
    const { result } = await setup();

    // First message fails
    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));
    await sendMessage("Hello");
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Second message succeeds
    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi!"));
    await sendMessage("World");
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
