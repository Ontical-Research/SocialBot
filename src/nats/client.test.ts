import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoist mock factories so vi.mock can reference them -----------------

const { mockSubscribe, mockPublish, mockDrainConn, makeFakeSub, makeControllableSub } = vi.hoisted(
  () => {
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

    /**
     * Creates a fake Subscription whose messages are delivered on demand.
     * Call ``push(msgJson)`` to enqueue a message; call ``close()`` to end the
     * iterator.  Returns ``{ sub, push, close }``.
     */
    function makeControllableSub() {
      // A queue of resolve functions waiting for the next message
      const resolvers: Array<(value: IteratorResult<{ string: () => string }>) => void> = [];
      // Pending messages not yet consumed by the iterator
      const pending: Array<{ string: () => string }> = [];
      let done = false;

      function push(msgJson: string) {
        const item = { string: () => msgJson };
        if (resolvers.length > 0) {
          resolvers.shift()!({ value: item, done: false });
        } else {
          pending.push(item);
        }
      }

      function close() {
        done = true;
        while (resolvers.length > 0) {
          resolvers.shift()!({ value: undefined as never, done: true });
        }
      }

      const sub = {
        [Symbol.asyncIterator]: function () {
          return {
            next(): Promise<IteratorResult<{ string: () => string }>> {
              if (pending.length > 0) {
                return Promise.resolve({ value: pending.shift()!, done: false });
              }
              if (done) {
                return Promise.resolve({ value: undefined as never, done: true });
              }
              return new Promise((resolve) => resolvers.push(resolve));
            },
            return(): Promise<IteratorResult<{ string: () => string }>> {
              done = true;
              return Promise.resolve({ value: undefined as never, done: true });
            },
          };
        },
        drain: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn(),
      };

      return { sub, push, close };
    }

    return { mockSubscribe, mockPublish, mockDrainConn, makeFakeSub, makeControllableSub };
  },
);

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

    it("does not invoke callback from a stale loop after reconnect", async () => {
      // Build controllable subs for the *first* connect() (common + direct)
      const stale1 = makeControllableSub();
      const stale2 = makeControllableSub();

      // First connect() uses the stale subs; second uses never-yielding subs
      const fresh1 = makeControllableSub();
      const fresh2 = makeControllableSub();

      mockSubscribe
        .mockReturnValueOnce(stale1.sub) // first connect, common sub
        .mockReturnValueOnce(stale2.sub) // first connect, direct sub
        .mockReturnValueOnce(fresh1.sub) // second connect, common sub
        .mockReturnValueOnce(fresh2.sub); // second connect, direct sub

      const staleCallback = vi.fn();
      const freshCallback = vi.fn();

      // First connect — loops start but are blocked waiting for messages
      await connect("ws://localhost:9222", "chat", "Alice", staleCallback);

      // Simulate StrictMode remount: disconnect then reconnect
      await disconnect();
      await connect("ws://localhost:9222", "chat", "Alice", freshCallback);

      // Push a message into the *old* stale subs — generation is now stale
      const payload: NatsMessage = {
        sender: "Bob",
        text: "stale message",
        timestamp: new Date().toISOString(),
      };
      stale1.push(JSON.stringify(payload));
      stale2.push(JSON.stringify(payload));

      // Allow loops to process
      await new Promise((r) => setTimeout(r, 20));

      // Stale callback must NOT be called — generation mismatch aborts the loops
      expect(staleCallback).not.toHaveBeenCalled();
      // Fresh callback must also not be called — no messages pushed to fresh subs
      expect(freshCallback).not.toHaveBeenCalled();

      stale1.close();
      stale2.close();
      fresh1.close();
      fresh2.close();
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
