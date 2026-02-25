import { StringCodec, connect as natsConnect } from "nats.ws";
import type { NatsConnection, Subscription } from "nats.ws";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The JSON wire-format for every message exchanged on the NATS bus. */
export interface NatsMessage {
  /** Display name of the sender. */
  sender: string;
  /** Plain-text message body. */
  text: string;
  /** ISO-8601 timestamp produced by the sender. */
  timestamp: string;
}

/** Callback invoked for every inbound message. */
export type MessageCallback = (msg: NatsMessage) => void;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let nc: NatsConnection | null = null;
let currentTopic: string = "";
let currentName: string = "";
let subscriptions: Subscription[] = [];

const sc = StringCodec();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to the NATS server and subscribe to:
 *
 * - ``<topic>``         – the common/broadcast subject
 * - ``<topic>.<name>``  – the direct/unicast subject for this client
 *
 * The ``onMessage`` callback is required at connect time, ensuring it is
 * always in place before any messages can arrive.  This eliminates the
 * fragile two-step ``onMessage()`` + ``connect()`` registration pattern.
 *
 * :param url:       WebSocket URL of the NATS server, e.g. ``ws://localhost:9222``.
 * :param topic:     Root subject name shared by all participants.
 * :param name:      This client's identity, appended to form the direct subject.
 * :param onMessage: Callback invoked for every inbound ``NatsMessage``.
 * :returns:         A promise that resolves once the connection and subscriptions
 *                   are established.
 */
export async function connect(
  url: string,
  topic: string,
  name: string,
  onMessage: MessageCallback,
): Promise<void> {
  // Clean up any existing connection first
  await disconnect();

  nc = await natsConnect({ servers: url });
  currentTopic = topic;
  currentName = name;

  const commonSub = nc.subscribe(topic);
  const directSub = nc.subscribe(`${topic}.${name}`);
  subscriptions = [commonSub, directSub];

  // Drain each subscription asynchronously, forwarding messages to the callback
  for (const sub of subscriptions) {
    void drainSubscription(sub, onMessage);
  }
}

/**
 * Publish ``text`` to the common topic as a JSON-encoded ``NatsMessage``.
 *
 * :param text: The message body to broadcast.
 * :raises Error: If ``connect`` has not been called yet.
 */
export function publish(text: string): void {
  if (!nc) {
    throw new Error("Not connected – call connect() first");
  }

  const message: NatsMessage = {
    sender: currentName,
    text,
    timestamp: new Date().toISOString(),
  };

  nc.publish(currentTopic, sc.encode(JSON.stringify(message)));
}

/**
 * Drain and close the current NATS connection.  Safe to call even when not
 * connected.
 *
 * :returns: A promise that resolves once the connection is fully closed.
 */
export async function disconnect(): Promise<void> {
  if (!nc) return;

  const conn = nc;
  nc = null;
  subscriptions = [];
  currentTopic = "";
  currentName = "";

  await conn.drain();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Asynchronously iterate over a subscription and forward each message to the
 * provided callback.  Parse errors are silently ignored so that malformed
 * messages cannot crash the client.
 *
 * :param sub:       The ``Subscription`` to iterate.
 * :param onMessage: Callback to invoke for each decoded ``NatsMessage``.
 */
async function drainSubscription(sub: Subscription, onMessage: MessageCallback): Promise<void> {
  for await (const msg of sub) {
    try {
      const parsed = JSON.parse(msg.string()) as NatsMessage;
      onMessage(parsed);
    } catch {
      // Ignore malformed messages
    }
  }
}
