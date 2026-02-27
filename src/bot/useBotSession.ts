import { useState, useEffect, useCallback, useRef } from "react";
import { connect, publish, disconnect } from "../nats/client";
import type { NatsMessage } from "../nats/client";
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
 * :returns: The conversation history and any current API error.
 */
export function useBotSession(session: BotHistoryEntry): BotSessionResult {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  // Use a ref so the message handler always has the latest history without
  // needing to be re-created (and without re-subscribing to NATS).
  const historyRef = useRef<ChatMessage[]>([]);

  const handleMessage = useCallback(
    async (msg: NatsMessage) => {
      // Ignore messages sent by the bot itself to prevent self-response loops.
      if (msg.sender === session.name) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: msg.text,
        name: msg.sender,
      };

      // Append the incoming message to history.
      const updatedHistory = [...historyRef.current, userMessage];
      historyRef.current = updatedHistory;
      setHistory(updatedHistory);

      // Call the LLM proxy.
      setThinking(true);
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

        // Clear any previous error.
        setError(null);

        // Publish the reply to NATS.
        publish(reply);

        // Append the assistant reply to history.
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

    void connect("ws://localhost:9222", session.topic, session.name, (msg) => {
      void handleMessage(msg);
    });

    return () => {
      void disconnect();
    };
  }, [session.topic, session.name, handleMessage]);

  return { history, error, thinking };
}
