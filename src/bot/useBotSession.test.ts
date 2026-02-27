import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NatsClient, MessageCallback } from "../nats/NatsClient";

// ---------------------------------------------------------------------------
// Mock NatsClient factory
// ---------------------------------------------------------------------------

let capturedCallback: MessageCallback | null = null;
let mockConnect: ReturnType<typeof vi.fn>;
let mockPublish: ReturnType<typeof vi.fn>;
let mockPublishWaiting: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

function makeMockClient(): NatsClient {
  mockConnect = vi.fn((_url: string, _topic: string, _name: string, onMessage: MessageCallback) => {
    capturedCallback = onMessage;
    return Promise.resolve();
  });
  mockPublish = vi.fn();
  mockPublishWaiting = vi.fn();
  mockDisconnect = vi.fn().mockResolvedValue(undefined);
  return {
    connect: mockConnect,
    publish: mockPublish,
    publishWaiting: mockPublishWaiting,
    disconnect: mockDisconnect,
  } as unknown as NatsClient;
}

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

let mockClient: NatsClient;

/** Render the hook with a fresh mock client and wait for the initial NATS connection. */
async function setup() {
  const hook = renderHook(() => useBotSession(SESSION, mockClient));
  await waitFor(() => {
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
  return hook;
}

/** Send a message via the captured callback. */
function sendMessage(text: string, sender = "Alice", timestamp = "2024-01-01T00:00:00Z") {
  act(() => {
    capturedCallback?.({ sender, text, timestamp });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBotSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = null;
    mockClient = makeMockClient();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ reply: "" }) });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("connects to NATS on mount with the bot's name and topic", async () => {
    await setup();

    const [, topic, name] = mockConnect.mock.calls[0] as [string, string, string];
    expect(topic).toBe("chat");
    expect(name).toBe("Bob");
  });

  it("disconnects from NATS on unmount", async () => {
    const { unmount } = await setup();

    unmount();
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it("starts with empty history and no error", async () => {
    const { result } = await setup();

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("appends incoming message to history as user role with sender name", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));
    sendMessage("Hello Bob");

    await waitFor(() => {
      expect(result.current.history).toContainEqual({
        role: "user",
        content: "Hello Bob",
        name: "Alice",
      });
    });
  });

  it("calls POST /api/chat with history, system prompt, and model", async () => {
    await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi there!"));
    sendMessage("Hey");
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

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
    sendMessage("Hello Bob");

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });
    expect(mockPublish).toHaveBeenCalledWith("Hello Alice!");
  });

  it("appends the LLM reply to history as assistant role", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hello Alice!"));
    sendMessage("Hello Bob");

    await waitFor(() => {
      expect(result.current.history).toContainEqual({
        role: "assistant",
        content: "Hello Alice!",
      });
    });
  });

  it("does not call /api/chat when the sender is the bot itself", async () => {
    await setup();

    sendMessage("Hello Alice!", "Bob");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets error state when /api/chat returns an error and does not publish", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));
    sendMessage("Hello");

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toContain("LLM error");
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("clears error state when a subsequent message succeeds", async () => {
    const { result } = await setup();

    mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "LLM error"));
    sendMessage("Hello");
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    mockFetch.mockResolvedValueOnce(makeChatResponse("Hi!"));
    sendMessage("World");
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it("calls publishWaiting() before fetch when a message arrives", async () => {
    await setup();

    let fetchCalled = false;
    mockFetch.mockImplementationOnce(() => {
      // At the moment fetch is called, publishWaiting should already have fired
      fetchCalled = true;
      return Promise.resolve(makeChatResponse("Hi!"));
    });

    sendMessage("Hello");

    await waitFor(() => {
      expect(fetchCalled).toBe(true);
    });

    expect(mockPublishWaiting).toHaveBeenCalledBefore(mockFetch);
  });

  it("calls publishWaiting() once per incoming message before publish(reply)", async () => {
    await setup();

    mockFetch.mockResolvedValueOnce(makeChatResponse("Reply 1"));
    sendMessage("Msg 1");

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    expect(mockPublishWaiting).toHaveBeenCalledTimes(1);
    expect(mockPublishWaiting).toHaveBeenCalledBefore(mockPublish);
  });
});
