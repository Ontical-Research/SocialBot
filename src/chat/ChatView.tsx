import { useState, useEffect, useRef, useCallback } from "react";
import type { NatsClient, NatsMessage } from "../nats/NatsClient";
import { senderColor } from "./senderColor";

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

  const nextId = () => {
    counterRef.current += 1;
    return `msg-${counterRef.current.toString()}`;
  };

  const appendMessage = useCallback((msg: NatsMessage) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId() }]);
  }, []);

  // Set page title to topic.name when this tab is active
  useEffect(() => {
    if (!isActive) return;
    const previousTitle = document.title;
    document.title = `${topic}.${name}`;
    return () => {
      document.title = previousTitle;
    };
  }, [name, topic, isActive]);

  useEffect(() => {
    // Lazily import NatsClient to avoid circular dependency issues in tests
    let activeClient: NatsClient;

    if (client) {
      activeClient = client;
      clientRef.current = activeClient;
      void activeClient.connect(natsUrl, topic, name, appendMessage);
    } else {
      void import("../nats/NatsClient").then(({ NatsClient: NatsClientClass }) => {
        activeClient = new NatsClientClass();
        clientRef.current = activeClient;
        void activeClient.connect(natsUrl, topic, name, appendMessage);
      });
    }

    return () => {
      void clientRef.current?.disconnect();
    };
  }, [name, topic, natsUrl, appendMessage, client]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
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
    <main className="flex h-full flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
        <span className="font-semibold text-white">{name}</span>
        <span className="text-gray-400">→</span>
        <span className="font-mono text-sm text-green-400">{topic}</span>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((msg) => {
          const isSelf = msg.sender === name;
          return (
            <div
              key={msg.id}
              className={`mb-3 flex ${isSelf ? "justify-end" : "justify-start"}`}
              data-testid="message-bubble"
              data-sender={isSelf ? "self" : "other"}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isSelf ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
                }`}
              >
                {!isSelf && (
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${senderColor(msg.sender)}`}>
                      {msg.sender}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>
                )}
                {isSelf && (
                  <div className="mb-1 flex items-baseline justify-end gap-2">
                    <span className="text-xs text-blue-200">{formatTime(msg.timestamp)}</span>
                  </div>
                )}
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <div className="border-t border-gray-700 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            list="sent-history"
            className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <datalist id="sent-history">
            {sentHistory.map((msg) => (
              <option key={msg} value={msg} />
            ))}
          </datalist>
          <button
            onClick={handleSend}
            aria-label="Send"
            className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {/* Right-pointing play triangle */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

export default ChatView;
