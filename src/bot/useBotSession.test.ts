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
    renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    const [, topic, name] = mockConnect.mock.calls[0];
    expect(topic).toBe("chat");
    expect(name).toBe("Bob");
  });

  it("disconnects from NATS on unmount", async () => {
    const { unmount } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    unmount();
    await waitFor(() => expect(mockDisconnect).toHaveBeenCalledTimes(1));
  });

  it("starts with empty history and no error", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("appends incoming message to history as user role with sender name", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));

    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hello Bob", timestamp: "2024-01-01T00:00:00Z" });
    });

    await waitFor(() =>
      expect(result.current.history).toContainEqual({
        role: "user",
        content: "Hello Bob",
        name: "Alice",
      }),
    );
  });

  it("calls POST /api/chat with history, system prompt, and model", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi there!"));

    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hey", timestamp: "2024-01-01T00:00:00Z" });
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.systemPrompt).toBe("You are a friendly assistant named Bob.");
    expect(body.messages).toContainEqual({ role: "user", content: "Hey", name: "Alice" });
    void result; // suppress unused warning
  });

  it("publishes the LLM reply to NATS", async () => {
    renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));

    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hello Bob", timestamp: "2024-01-01T00:00:00Z" });
    });

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish).toHaveBeenCalledWith("Hello Alice!");
  });

  it("appends the LLM reply to history as assistant role", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));

    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hello Bob", timestamp: "2024-01-01T00:00:00Z" });
    });

    await waitFor(() =>
      expect(result.current.history).toContainEqual({
        role: "assistant",
        content: "Hello Alice!",
      }),
    );
  });

  it("does not call /api/chat when the sender is the bot itself", async () => {
    renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    const onMessage = captureOnMessage();
    await act(async () => {
      // Message from "Bob" — the bot's own name
      onMessage({ sender: "Bob", text: "Hello Alice!", timestamp: "2024-01-01T00:00:00Z" });
    });

    // fetch should not have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets error state when /api/chat returns an error and does not publish", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));

    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hello", timestamp: "2024-01-01T00:00:00Z" });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain("LLM error");
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("clears error state when a subsequent message succeeds", async () => {
    const { result } = renderHook(() => useBotSession(SESSION));
    await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));

    // First message fails
    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));
    const onMessage = captureOnMessage();
    await act(async () => {
      onMessage({ sender: "Alice", text: "Hello", timestamp: "2024-01-01T00:00:00Z" });
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Second message succeeds
    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi!"));
    await act(async () => {
      onMessage({ sender: "Alice", text: "World", timestamp: "2024-01-01T00:00:00Z" });
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
