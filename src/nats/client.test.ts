import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoist mock factories so vi.mock can reference them -----------------

const { mockSubscribe, mockPublish, mockDrainConn, makeFakeSub } = vi.hoisted(() => {
  const mockSubscribe = vi.fn();
  const mockPublish = vi.fn();
  const mockDrainConn = vi.fn().mockResolvedValue(undefined);

  /** Creates a fake Subscription that yields one message then stops. */
  function makeFakeSub(msgJson: string) {
    return {
      [Symbol.asyncIterator]: async function* () {
        yield { string: () => msgJson };
      },
      drain: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn(),
    };
  }

  return { mockSubscribe, mockPublish, mockDrainConn, makeFakeSub };
});

// --- Mock nats.ws -------------------------------------------------------

vi.mock("nats.ws", () => ({
  connect: vi.fn().mockResolvedValue({
    subscribe: mockSubscribe,
    publish: mockPublish,
    drain: mockDrainConn,
  }),
  StringCodec: vi.fn(() => ({
    encode: (s: string) => new TextEncoder().encode(s),
    decode: (u: Uint8Array) => new TextDecoder().decode(u),
  })),
}));

// --- Import after mock setup -------------------------------------------

import { connect, disconnect, publish } from "./client";
import type { NatsMessage } from "./client";

// --- Tests -------------------------------------------------------------

describe("NATS client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(makeFakeSub("{}"));
    // Re-mock drain after clearAllMocks
    mockDrainConn.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await disconnect();
  });

  describe("connect()", () => {
    it("subscribes to the common topic", async () => {
      await connect("ws://localhost:9222", "chat", "Alice", vi.fn());

      const subjects = mockSubscribe.mock.calls.map((c) => c[0] as string);
      expect(subjects).toContain("chat");
    });

    it("subscribes to the direct topic", async () => {
      await connect("ws://localhost:9222", "chat", "Alice", vi.fn());

      const subjects = mockSubscribe.mock.calls.map((c) => c[0] as string);
      expect(subjects).toContain("chat.Alice");
    });

    it("accepts the onMessage callback as a required fourth argument", async () => {
      const cb = vi.fn();
      // Should not throw
      await expect(connect("ws://localhost:9222", "chat", "Alice", cb)).resolves.toBeUndefined();
    });

    it("invokes the callback for incoming messages passed at connect time", async () => {
      const received: NatsMessage[] = [];
      const cb = (msg: NatsMessage) => received.push(msg);

      const payload: NatsMessage = {
        sender: "Bob",
        text: "hi",
        timestamp: new Date().toISOString(),
      };
      mockSubscribe.mockReturnValue(makeFakeSub(JSON.stringify(payload)));

      await connect("ws://localhost:9222", "chat", "Alice", cb);

      // Allow the async iterators to drain
      await new Promise((r) => setTimeout(r, 20));

      expect(received.length).toBeGreaterThan(0);
      expect(received[0].sender).toBe("Bob");
      expect(received[0].text).toBe("hi");
    });
  });

  describe("publish()", () => {
    it("publishes to the common topic", async () => {
      await connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      publish("hello");

      expect(mockPublish).toHaveBeenCalledOnce();
      expect(mockPublish.mock.calls[0][0]).toBe("chat");
    });

    it("sends the correct JSON wire format", async () => {
      await connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      publish("hello");

      const rawPayload = mockPublish.mock.calls[0][1] as Uint8Array;
      const decoded = new TextDecoder().decode(rawPayload);
      const parsed = JSON.parse(decoded) as NatsMessage;

      expect(parsed.sender).toBe("Alice");
      expect(parsed.text).toBe("hello");
      expect(typeof parsed.timestamp).toBe("string");
      // Timestamp should be a valid ISO-8601 date
      expect(() => new Date(parsed.timestamp)).not.toThrow();
    });
  });

  describe("disconnect()", () => {
    it("drains the connection", async () => {
      await connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      await disconnect();

      expect(mockDrainConn).toHaveBeenCalledOnce();
    });
  });
});
