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
    <main className="flex h-full flex-col bg-surface text-text-primary dark:bg-dark-surface dark:text-dark-text-primary">
      {/* Status bar */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-3 dark:border-dark-border">
        <span className="rounded-md bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary dark:bg-dark-surface-secondary dark:text-dark-text-secondary">
          {session.model}
        </span>
        <span className="text-border dark:text-dark-border">|</span>
        <button
          onClick={() => {
            setPromptModalOpen(true);
          }}
          className="text-sm text-accent hover:underline focus:outline-none dark:text-dark-accent"
        >
          {promptFilename}
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-danger/30 bg-danger-subtle px-6 py-2.5 text-sm text-danger dark:border-dark-danger/30 dark:bg-dark-danger-subtle dark:text-dark-danger"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={onLeave}
            className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-medium transition-colors hover:bg-danger/10 dark:border-dark-danger/40 dark:hover:bg-dark-danger/10"
          >
            Back to login
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {history.map((msg, index) => {
          const isSelf = msg.role === "assistant";
          const senderName = isSelf ? session.name : (msg.name ?? "Unknown");
          return (
            <div
              key={index}
              className={`mb-4 flex ${isSelf ? "justify-end" : "justify-start"}`}
              data-testid="message-bubble"
              data-sender={isSelf ? "self" : "other"}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  isSelf
                    ? "bg-accent text-white dark:bg-dark-accent dark:text-white"
                    : "bg-surface-secondary text-text-primary dark:bg-dark-surface-secondary dark:text-dark-text-primary"
                }`}
              >
                {!isSelf && (
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-xs font-semibold ${senderColor(senderName)}`}>
                      {senderName}
                    </span>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {thinking && (
          <div data-testid="typing-indicator" className="mb-4 flex justify-start">
            <div className="rounded-2xl bg-surface-secondary px-4 py-3 dark:bg-dark-surface-secondary">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:0ms] dark:bg-dark-text-tertiary" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:150ms] dark:bg-dark-text-tertiary" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary [animation-delay:300ms] dark:bg-dark-text-tertiary" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            setPromptModalOpen(false);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl dark:border-dark-border dark:bg-dark-surface-secondary"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
                {promptFilename}
              </h2>
              <button
                onClick={() => {
                  setPromptModalOpen(false);
                }}
                aria-label="Close"
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary dark:text-dark-text-tertiary dark:hover:bg-dark-surface-tertiary dark:hover:text-dark-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-text-secondary dark:text-dark-text-secondary">
              {session.promptContent}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}

export default BotChatView;
