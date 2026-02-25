import { useState, useEffect, useRef, useCallback } from "react";
import { connect, publish, disconnect, onMessage } from "../nats/client";
import type { NatsMessage } from "../nats/client";
import { senderColor } from "./senderColor";

interface ChatViewProps {
  name: string;
  topic: string;
  natsUrl?: string;
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
 */
function ChatView({ name, topic, natsUrl = "ws://localhost:9222" }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);

  const nextId = () => {
    counterRef.current += 1;
    return `msg-${counterRef.current}`;
  };

  const appendMessage = useCallback((msg: NatsMessage) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId() }]);
  }, []);

  useEffect(() => {
    onMessage(appendMessage);
    void connect(natsUrl, topic, name);
    return () => {
      void disconnect();
    };
  }, [name, topic, natsUrl, appendMessage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Optimistic: add to local state immediately
    appendMessage({ sender: name, text: trimmed, timestamp: new Date().toISOString() });
    publish(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSend();
    }
  }

  return (
    <main className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-700 px-4 py-3">
        <span className="font-semibold text-white">{name}</span>
        <span className="text-gray-400">→</span>
        <span className="font-mono text-sm text-green-400">{topic}</span>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-semibold ${senderColor(msg.sender)}`}>
                {msg.sender}
              </span>
              <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
            </div>
            <p className="mt-0.5 text-gray-100">{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <div className="border-t border-gray-700 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}

export default ChatView;
