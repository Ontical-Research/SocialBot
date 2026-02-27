import { useState, useEffect, useCallback, useRef } from "react";
import type { NatsClient, NatsMessage } from "../nats/NatsClient";
import type { BotHistoryEntry } from "./useBotSettingsHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  name?: string;
}

export interface BotSessionResult {
  /** Accumulated conversation history. */
  history: ChatMessage[];
  /** Last API error, or null if none. */
  error: string | null;
  /** True while waiting for an LLM response. */
  thinking: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const PROXY_URL = "/api/chat";

/**
 * Connects to NATS on mount, subscribes to incoming messages, and calls
 * ``/api/chat`` for each message that is not from the bot itself.  The LLM
 * reply is published back to NATS and appended to the conversation history.
 *
 * :param session: The bot's login settings (name, topic, model, prompt).
 * :param client:  Pre-constructed NatsClient instance; created internally if omitted.
 * :returns: The conversation history and any current API error.
 */
export function useBotSession(session: BotHistoryEntry, client?: NatsClient): BotSessionResult {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const historyRef = useRef<ChatMessage[]>([]);
  const clientRef = useRef<NatsClient | null>(null);

  const handleMessage = useCallback(
    async (msg: NatsMessage) => {
      if (msg.sender === session.name) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: msg.text,
        name: msg.sender,
      };

      const updatedHistory = [...historyRef.current, userMessage];
      historyRef.current = updatedHistory;
      setHistory(updatedHistory);

      setThinking(true);
      clientRef.current?.publishWaiting();
      try {
        const response = await fetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: session.model,
            systemPrompt: session.promptContent,
            messages: updatedHistory,
          }),
        });

        const data = (await response.json()) as { reply?: string; error?: string };

        if (!response.ok) {
          setError(data.error ?? `Request failed with status ${response.status.toString()}`);
          return;
        }

        const reply = data.reply ?? "";
        setError(null);

        clientRef.current?.publish(reply);

        const assistantMessage: ChatMessage = { role: "assistant", content: reply };
        const withReply = [...historyRef.current, assistantMessage];
        historyRef.current = withReply;
        setHistory(withReply);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setThinking(false);
      }
    },
    [session.name, session.model, session.promptContent],
  );

  useEffect(() => {
    historyRef.current = [];

    const connectClient = async () => {
      let activeClient: NatsClient;
      if (client) {
        activeClient = client;
      } else {
        const { NatsClient: NatsClientClass } = await import("../nats/NatsClient");
        activeClient = new NatsClientClass();
      }
      clientRef.current = activeClient;
      const natsUrl: string =
        "natsUrl" in session && typeof session.natsUrl === "string"
          ? session.natsUrl
          : "ws://localhost:9222";
      await activeClient.connect(natsUrl, session.topic, session.name, (msg) => {
        void handleMessage(msg);
      });
    };

    void connectClient();

    return () => {
      void clientRef.current?.disconnect();
    };
  }, [session, handleMessage, client]);

  return { history, error, thinking };
}
