import { useState, useRef, useEffect } from "react";
import { useBotSession } from "./useBotSession";
import type { BotHistoryEntry } from "./useBotSettingsHistory";
import type { NatsClient } from "../nats/NatsClient";
import { senderColor } from "../chat/senderColor";

interface BotChatViewProps {
  session: BotHistoryEntry;
  onLeave: () => void;
  /** Pre-constructed NatsClient instance; created internally if omitted. */
  client?: NatsClient;
}

/** Returns just the filename portion of a path, e.g. "prompts/friendly.md" → "friendly.md". */
function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Read-only chat view for the bot participant. Displays incoming messages and
 * the bot's own replies as bubbles, a status bar with model and prompt info,
 * a typing indicator while the LLM is processing, and an error banner when
 * the LLM call fails.
 *
 * :param session: The active bot login settings.
 * :param onLeave: Called when the user clicks "Leave chat".
 */
function BotChatView({ session, onLeave, client }: BotChatViewProps) {
  const { history, error, thinking } = useBotSession(session, client);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [history, thinking]);

  const promptFilename = basename(session.promptPath);

  return (
    <main className="flex h-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* Status bar */}
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {session.model}
        </span>
        <span className="text-gray-500">·</span>
        <button
          onClick={() => {
            setPromptModalOpen(true);
          }}
          className="text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none"
        >
          {promptFilename}
        </button>
        <span className="ml-auto">
          <button
            onClick={onLeave}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Leave chat
          </button>
        </span>
      </header>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-red-300 bg-red-100 px-4 py-2 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={onLeave}
            className="rounded border border-red-400 px-2 py-1 text-xs hover:bg-red-200 dark:border-red-600 dark:hover:bg-red-900/50"
          >
            Back to login
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {history.map((msg, index) => {
          const isSelf = msg.role === "assistant";
          const senderName = isSelf ? session.name : (msg.name ?? "Unknown");
          return (
            <div
              key={index}
              className={`mb-3 flex ${isSelf ? "justify-end" : "justify-start"}`}
              data-testid="message-bubble"
              data-sender={isSelf ? "self" : "other"}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  isSelf
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                }`}
              >
                {!isSelf && (
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${senderColor(senderName)}`}>
                      {senderName}
                    </span>
                  </div>
                )}
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {thinking && (
          <div data-testid="typing-indicator" className="mb-3 flex justify-start">
            <div className="rounded-2xl bg-gray-200 px-4 py-3 dark:bg-gray-700">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms] dark:bg-gray-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms] dark:bg-gray-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms] dark:bg-gray-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Prompt modal */}
      {promptModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            setPromptModalOpen(false);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {promptFilename}
              </h2>
              <button
                onClick={() => {
                  setPromptModalOpen(false);
                }}
                aria-label="Close"
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="font-mono text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {session.promptContent}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}

export default BotChatView;
