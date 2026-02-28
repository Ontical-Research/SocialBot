import { useState, useEffect, useRef, useCallback } from "react";
import type { NatsClient, NatsMessage } from "../nats/NatsClient";
import { senderColor } from "./senderColor";
import * as React from "react";

interface ChatViewProps {
  name: string;
  topic: string;
  natsUrl?: string;
  /** Pre-constructed NatsClient instance; if omitted, one is created internally. */
  client?: NatsClient;
  /** Whether this tab is currently visible; gates the document.title update. */
  isActive?: boolean;
}

interface Message extends NatsMessage {
  id: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Main chat view: scrolling message list wired to NATS, plus a send form.
 *
 * :param name:    The local user's display name.
 * :param topic:   The NATS subject to publish and subscribe on.
 * :param natsUrl: WebSocket URL of the NATS server (default: ws://localhost:9222).
 * :param client:  Optional pre-constructed NatsClient; created internally if omitted.
 */
function ChatView({
  name,
  topic,
  natsUrl = "ws://localhost:9222",
  client,
  isActive,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sentHistory, setSentHistory] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);
  const clientRef = useRef<NatsClient | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextId = () => {
    counterRef.current += 1;
    return `msg-${counterRef.current.toString()}`;
  };

  const handleIncomingMessage = useCallback((msg: NatsMessage) => {
    const waitingId = `waiting-${msg.sender}`;
    if (msg.type === "waiting") {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === waitingId);
        if (exists) return prev;
        return [...prev, { ...msg, id: waitingId }];
      });
    } else if (msg.type === "cancel") {
      setMessages((prev) => prev.filter((m) => m.id !== waitingId));
    } else {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === waitingId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...msg, id: waitingId };
          return updated;
        }
        return [...prev, { ...msg, id: nextId() }];
      });
    }
  }, []);

  // Keep the document title as the app name
  useEffect(() => {
    if (!isActive) return;
    document.title = "SocialBot";
  }, [isActive]);

  useEffect(() => {
    // Lazily import NatsClient to avoid circular dependency issues in tests
    let activeClient: NatsClient;

    if (client) {
      activeClient = client;
      clientRef.current = activeClient;
      void activeClient.connect(natsUrl, topic, name, handleIncomingMessage);
    } else {
      void import("../nats/NatsClient").then(({ NatsClient: NatsClientClass }) => {
        activeClient = new NatsClientClass();
        clientRef.current = activeClient;
        void activeClient.connect(natsUrl, topic, name, handleIncomingMessage);
      });
    }

    return () => {
      void clientRef.current?.disconnect();
    };
  }, [name, topic, natsUrl, handleIncomingMessage, client]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (typingTimerRef.current !== null) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    clientRef.current?.publish(trimmed);
    setSentHistory((prev) => {
      const filtered = prev.filter((m) => m !== trimmed);
      return [trimmed, ...filtered];
    });
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSend();
    }
  }

  return (
    <main className="bg-surface text-text-primary dark:bg-dark-surface dark:text-dark-text-primary flex h-full flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map((msg) => {
          const isSelf = msg.sender === name;
          return (
            <div
              key={msg.id}
              className={`mb-4 flex ${isSelf ? "justify-end" : "justify-start"}`}
              data-testid="message-bubble"
              data-sender={isSelf ? "self" : "other"}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isSelf
                    ? "bg-accent dark:bg-dark-accent text-white dark:text-white"
                    : "bg-surface-secondary text-text-primary dark:bg-dark-surface-secondary dark:text-dark-text-primary"
                }`}
              >
                {!isSelf && (
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-xs font-semibold ${senderColor(msg.sender)}`}>
                      {msg.sender}
                    </span>
                    <span className="text-text-tertiary dark:text-dark-text-tertiary text-xs">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}
                {isSelf && (
                  <div className="mb-0.5 flex items-baseline justify-end">
                    <span className="text-xs text-white/60">{formatTime(msg.timestamp)}</span>
                  </div>
                )}
                {msg.type === "waiting" ? (
                  <div data-testid="typing-indicator" className="flex items-center gap-1 py-0.5">
                    <span className="bg-text-tertiary dark:bg-dark-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                    <span className="bg-text-tertiary dark:bg-dark-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                    <span className="bg-text-tertiary dark:bg-dark-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <div className="border-border dark:border-dark-border border-t px-6 py-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              const prev = text;
              const next = e.target.value;
              setText(next);
              if (next.length > 0) {
                if (prev.length === 0) {
                  clientRef.current?.publishWaiting();
                }
                if (typingTimerRef.current !== null) {
                  clearTimeout(typingTimerRef.current);
                }
                typingTimerRef.current = setTimeout(() => {
                  typingTimerRef.current = null;
                  clientRef.current?.publishCancel();
                }, 3000);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            list="sent-history"
            className="border-border bg-surface-secondary text-text-primary placeholder-text-tertiary focus:border-accent dark:border-dark-border dark:bg-dark-surface-secondary dark:text-dark-text-primary dark:placeholder-dark-text-tertiary dark:focus:border-dark-accent flex-1 rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none"
          />
          <datalist id="sent-history">
            {sentHistory.map((msg) => (
              <option key={msg} value={msg} />
            ))}
          </datalist>
          <button
            onClick={handleSend}
            aria-label="Send"
            className="bg-accent hover:bg-accent-hover focus:ring-accent/30 dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:focus:ring-dark-accent/30 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-colors focus:ring-2 focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

export default ChatView;
