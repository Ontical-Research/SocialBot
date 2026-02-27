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
        [Symbol.asyncIterator]: function* () {
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
      const resolvers: ((value: IteratorResult<{ string: () => string }>) => void)[] = [];
      const pending: { string: () => string }[] = [];
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

import { NatsClient } from "./NatsClient";
import type { NatsMessage, MessageType } from "./NatsClient";

// --- Tests -------------------------------------------------------------

describe("NatsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(makeFakeSub("{}"));
    mockDrainConn.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Clean up any leftover instances — nothing to do as each test creates its own
  });

  describe("connect()", () => {
    it("subscribes to the common topic", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());

      const subjects = mockSubscribe.mock.calls.map((c) => c[0] as string);
      expect(subjects).toContain("chat");

      await client.disconnect();
    });

    it("subscribes to the direct topic", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());

      const subjects = mockSubscribe.mock.calls.map((c) => c[0] as string);
      expect(subjects).toContain("chat.Alice");

      await client.disconnect();
    });

    it("accepts the onMessage callback as a required fourth argument", async () => {
      const client = new NatsClient();
      const cb = vi.fn();
      await expect(
        client.connect("ws://localhost:9222", "chat", "Alice", cb),
      ).resolves.toBeUndefined();
      await client.disconnect();
    });

    it("invokes the callback for incoming messages", async () => {
      const received: NatsMessage[] = [];
      const cb = (msg: NatsMessage) => received.push(msg);

      const payload: NatsMessage = {
        sender: "Bob",
        text: "hi",
        timestamp: new Date().toISOString(),
      };
      mockSubscribe.mockReturnValue(makeFakeSub(JSON.stringify(payload)));

      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", cb);

      await new Promise((r) => setTimeout(r, 20));

      expect(received.length).toBeGreaterThan(0);
      expect(received[0].sender).toBe("Bob");
      expect(received[0].text).toBe("hi");

      await client.disconnect();
    });

    it("does not invoke callback from a stale loop after reconnect", async () => {
      const stale1 = makeControllableSub();
      const stale2 = makeControllableSub();
      const fresh1 = makeControllableSub();
      const fresh2 = makeControllableSub();

      mockSubscribe
        .mockReturnValueOnce(stale1.sub)
        .mockReturnValueOnce(stale2.sub)
        .mockReturnValueOnce(fresh1.sub)
        .mockReturnValueOnce(fresh2.sub);

      const staleCallback = vi.fn();
      const freshCallback = vi.fn();

      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", staleCallback);
      await client.disconnect();
      await client.connect("ws://localhost:9222", "chat", "Alice", freshCallback);

      const payload: NatsMessage = {
        sender: "Bob",
        text: "stale message",
        timestamp: new Date().toISOString(),
      };
      stale1.push(JSON.stringify(payload));
      stale2.push(JSON.stringify(payload));

      await new Promise((r) => setTimeout(r, 20));

      expect(staleCallback).not.toHaveBeenCalled();
      expect(freshCallback).not.toHaveBeenCalled();

      stale1.close();
      stale2.close();
      fresh1.close();
      fresh2.close();

      await client.disconnect();
    });
  });

  describe("two instances", () => {
    it("two instances can connect simultaneously with separate callbacks", async () => {
      const received1: NatsMessage[] = [];
      const received2: NatsMessage[] = [];

      const msg1: NatsMessage = {
        sender: "Alice",
        text: "hello from 1",
        timestamp: new Date().toISOString(),
      };
      const msg2: NatsMessage = {
        sender: "Bob",
        text: "hello from 2",
        timestamp: new Date().toISOString(),
      };

      // Each instance gets its own controllable subs
      const ctrl1a = makeControllableSub();
      const ctrl1b = makeControllableSub();
      const ctrl2a = makeControllableSub();
      const ctrl2b = makeControllableSub();

      mockSubscribe
        .mockReturnValueOnce(ctrl1a.sub)
        .mockReturnValueOnce(ctrl1b.sub)
        .mockReturnValueOnce(ctrl2a.sub)
        .mockReturnValueOnce(ctrl2b.sub);

      const client1 = new NatsClient();
      const client2 = new NatsClient();

      await client1.connect("ws://localhost:9222", "chat", "Alice", (m) => received1.push(m));
      await client2.connect("ws://localhost:9222", "chat", "Bob", (m) => received2.push(m));

      ctrl1a.push(JSON.stringify(msg1));
      ctrl2a.push(JSON.stringify(msg2));

      await new Promise((r) => setTimeout(r, 20));

      expect(received1).toHaveLength(1);
      expect(received1[0].text).toBe("hello from 1");
      expect(received2).toHaveLength(1);
      expect(received2[0].text).toBe("hello from 2");

      ctrl1a.close();
      ctrl1b.close();
      ctrl2a.close();
      ctrl2b.close();

      await client1.disconnect();
      await client2.disconnect();
    });
  });

  describe("publish()", () => {
    it("publishes to the common topic", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      client.publish("hello");

      expect(mockPublish).toHaveBeenCalledOnce();
      expect(mockPublish.mock.calls[0][0]).toBe("chat");

      await client.disconnect();
    });

    it("sends the correct JSON wire format", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      client.publish("hello");

      const rawPayload = mockPublish.mock.calls[0][1] as Uint8Array;
      const decoded = new TextDecoder().decode(rawPayload);
      const parsed = JSON.parse(decoded) as NatsMessage;

      expect(parsed.sender).toBe("Alice");
      expect(parsed.text).toBe("hello");
      expect(typeof parsed.timestamp).toBe("string");
      expect(() => new Date(parsed.timestamp)).not.toThrow();

      await client.disconnect();
    });

    it("does not set type field in the wire format", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      client.publish("hello");

      const rawPayload = mockPublish.mock.calls[0][1] as Uint8Array;
      const decoded = new TextDecoder().decode(rawPayload);
      const parsed = JSON.parse(decoded) as NatsMessage;

      expect(parsed.type).toBeUndefined();

      await client.disconnect();
    });

    it("throws if not connected", () => {
      const client = new NatsClient();
      expect(() => {
        client.publish("hello");
      }).toThrow("Not connected");
    });
  });

  describe("publishWaiting()", () => {
    it("publishes to the common topic", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      client.publishWaiting();

      expect(mockPublish).toHaveBeenCalledOnce();
      expect(mockPublish.mock.calls[0][0]).toBe("chat");

      await client.disconnect();
    });

    it("emits type: waiting in the wire format", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      client.publishWaiting();

      const rawPayload = mockPublish.mock.calls[0][1] as Uint8Array;
      const decoded = new TextDecoder().decode(rawPayload);
      const parsed = JSON.parse(decoded) as NatsMessage;

      expect(parsed.type).toBe<MessageType>("waiting");
      expect(parsed.text).toBe("");
      expect(parsed.sender).toBe("Alice");

      await client.disconnect();
    });

    it("throws if not connected", () => {
      const client = new NatsClient();
      expect(() => {
        client.publishWaiting();
      }).toThrow("Not connected");
    });
  });

  describe("disconnect()", () => {
    it("drains the connection", async () => {
      const client = new NatsClient();
      await client.connect("ws://localhost:9222", "chat", "Alice", vi.fn());
      await client.disconnect();

      expect(mockDrainConn).toHaveBeenCalledOnce();
    });

    it("is safe to call when not connected", async () => {
      const client = new NatsClient();
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });
});
