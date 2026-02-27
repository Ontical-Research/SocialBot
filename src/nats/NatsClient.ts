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
// NatsClient class
// ---------------------------------------------------------------------------

/**
 * Instance-based NATS client.  Each instance maintains its own connection,
 * topic, name, and generation symbol, making it safe to run multiple agents
 * simultaneously in a single page.
 *
 * Usage::
 *
 *   const client = new NatsClient();
 *   await client.connect(url, topic, name, onMessage);
 *   client.publish("hello");
 *   await client.disconnect();
 */
export class NatsClient {
  private nc: NatsConnection | null = null;
  private currentTopic = "";
  private currentName = "";
  private subscriptions: Subscription[] = [];
  private currentGeneration = Symbol();
  private readonly sc = StringCodec();

  /**
   * Connect to the NATS server and subscribe to the common and direct topics.
   *
   * :param url:       WebSocket URL of the NATS server, e.g. ``ws://localhost:9222``.
   * :param topic:     Root subject name shared by all participants.
   * :param name:      This client's identity, appended to form the direct subject.
   * :param onMessage: Callback invoked for every inbound ``NatsMessage``.
   * :returns:         A promise that resolves once the connection and subscriptions
   *                   are established.
   */
  async connect(
    url: string,
    topic: string,
    name: string,
    onMessage: MessageCallback,
  ): Promise<void> {
    await this.disconnect();

    const generation = Symbol();
    this.currentGeneration = generation;

    this.nc = await natsConnect({ servers: url });
    this.currentTopic = topic;
    this.currentName = name;

    const commonSub = this.nc.subscribe(topic);
    const directSub = this.nc.subscribe(`${topic}.${name}`);
    this.subscriptions = [commonSub, directSub];

    for (const sub of this.subscriptions) {
      void this.drainSubscription(sub, onMessage, generation);
    }
  }

  /**
   * Publish ``text`` to the common topic as a JSON-encoded ``NatsMessage``.
   *
   * :param text: The message body to broadcast.
   * :raises Error: If ``connect`` has not been called yet.
   */
  publish(text: string): void {
    if (!this.nc) {
      throw new Error("Not connected – call connect() first");
    }

    const message: NatsMessage = {
      sender: this.currentName,
      text,
      timestamp: new Date().toISOString(),
    };

    this.nc.publish(this.currentTopic, this.sc.encode(JSON.stringify(message)));
  }

  /**
   * Drain and close the current NATS connection.  Safe to call even when not
   * connected.
   *
   * :returns: A promise that resolves once the connection is fully closed.
   */
  async disconnect(): Promise<void> {
    if (!this.nc) return;

    this.currentGeneration = Symbol();

    const conn = this.nc;
    this.nc = null;
    this.subscriptions = [];
    this.currentTopic = "";
    this.currentName = "";

    await conn.drain();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async drainSubscription(
    sub: Subscription,
    onMessage: MessageCallback,
    generation: symbol,
  ): Promise<void> {
    for await (const msg of sub) {
      if (this.currentGeneration !== generation) break;
      try {
        const parsed = JSON.parse(msg.string()) as NatsMessage;
        onMessage(parsed);
      } catch {
        // Ignore malformed messages
      }
    }
  }
}
