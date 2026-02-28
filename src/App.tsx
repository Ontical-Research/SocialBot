import { useState, useRef } from "react";
import "./App.css";
import UnifiedSettingsPanel from "./settings/UnifiedSettingsPanel";
import ChatView from "./chat/ChatView";
import BotChatView from "./bot/BotChatView";
import type { UnifiedEntry } from "./settings/useUnifiedSettingsHistory";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";
import type { NatsClient } from "./nats/NatsClient";
import { useTheme } from "./theme/useTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabState {
  /** Stable unique identifier. */
  id: string;
  /** null = showing login form; set = showing chat view. */
  session: UnifiedEntry | null;
  /** The NATS client owned by this tab. */
  client: NatsClient | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tabCounter = 0;
function newTabId(): string {
  tabCounter += 1;
  return `tab-${tabCounter.toString()}`;
}

function makeTab(session: UnifiedEntry | null = null, client: NatsClient | null = null): TabState {
  return { id: newTabId(), session, client };
}

function tabLabel(tab: TabState): string {
  return tab.session ? tab.session.name : "New agent";
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

interface AppProps {
  /** Initial agents from config.json; each gets a pre-connected tab. */
  initialAgents?: UnifiedEntry[];
}

function App({ initialAgents }: AppProps) {
  const { isDark, toggle } = useTheme();
  const [tabs, setTabs] = useState<TabState[]>(() => {
    if (initialAgents && initialAgents.length > 0) {
      return initialAgents.map((agent) => makeTab(agent, null));
    }
    return [makeTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Track NatsClient instances in a ref so they can be cleaned up on tab removal
  const clientsRef = useRef<Map<string, NatsClient>>(new Map());

  const connectedNames = tabs
    .filter((t) => t.session !== null)
    .map((t) => t.session?.name ?? "")
    .filter(Boolean);

  // Derive the shared topic from connected tabs (all tabs share the same topic prefix)
  const sharedTopic = tabs.find((t) => t.session !== null)?.session?.topic ?? null;

  function addTab() {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setConfirmRemoveId(null);
  }

  function handleConnect(tabId: string, entry: UnifiedEntry, client: NatsClient) {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, session: entry, client } : t)));
    clientsRef.current.set(tabId, client);
  }

  function requestRemoveTab(tabId: string) {
    if (tabs.length <= 1) return;
    setConfirmRemoveId(tabId);
  }

  async function confirmRemoveTab(tabId: string) {
    const client = clientsRef.current.get(tabId);
    if (client) {
      await client.disconnect();
      clientsRef.current.delete(tabId);
    }

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[0]?.id ?? "");
      }
      return next;
    });
    setConfirmRemoveId(null);
  }

  function cancelRemoveTab() {
    setConfirmRemoveId(null);
  }

  return (
    <div className="bg-surface text-text-primary dark:bg-dark-surface dark:text-dark-text-primary flex h-screen">
      {/* Sidebar */}
      <nav
        className="border-border bg-surface-secondary dark:border-dark-border dark:bg-dark-surface-secondary flex w-56 flex-shrink-0 flex-col border-r"
        aria-label="Agent tabs"
      >
        {/* Brand header */}
        <div className="border-border dark:border-dark-border flex items-center gap-2.5 border-b px-4 py-4">
          <div className="bg-accent dark:bg-dark-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
            S
          </div>
          <span className="text-text-primary dark:text-dark-text-primary text-sm font-semibold tracking-tight">
            SocialBot
          </span>
        </div>

        {/* Tab list */}
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isConfirming = confirmRemoveId === tab.id;
            return (
              <div key={tab.id} className="group relative">
                <button
                  aria-label={tabLabel(tab)}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setConfirmRemoveId(null);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-accent-subtle text-accent dark:bg-dark-accent-subtle dark:text-dark-accent font-medium"
                      : "text-text-secondary hover:bg-surface-tertiary dark:text-dark-text-secondary dark:hover:bg-dark-surface-tertiary"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-medium ${
                      tab.session
                        ? "bg-success/15 text-success dark:bg-dark-success/15 dark:text-dark-success"
                        : "bg-surface-tertiary text-text-tertiary dark:bg-dark-surface-tertiary dark:text-dark-text-tertiary"
                    }`}
                  >
                    {tab.session ? tab.session.name.charAt(0).toUpperCase() : "?"}
                  </span>
                  <span className="truncate">{tabLabel(tab)}</span>
                </button>

                {isConfirming ? (
                  <div className="bg-danger-subtle dark:bg-dark-danger-subtle flex items-center justify-between rounded-lg px-3 py-1.5">
                    <span className="text-danger dark:text-dark-danger text-xs font-medium">
                      Remove?
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          void confirmRemoveTab(tab.id);
                        }}
                        className="text-danger dark:text-dark-danger text-xs font-medium hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={cancelRemoveTab}
                        className="text-text-secondary dark:text-dark-text-secondary text-xs hover:underline"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      requestRemoveTab(tab.id);
                    }}
                    disabled={tabs.length <= 1}
                    aria-label="Remove tab"
                    className={`text-text-tertiary hover:text-danger dark:text-dark-text-tertiary dark:hover:text-dark-danger absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-0.5 transition-opacity ${
                      tabs.length <= 1
                        ? "cursor-not-allowed opacity-0"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar footer */}
        <div className="border-border dark:border-dark-border flex flex-col gap-1 border-t px-2 py-3">
          {sharedTopic && (
            <div
              className="bg-success/10 text-success dark:bg-dark-success/10 dark:text-dark-success truncate rounded-md px-2.5 py-1 text-center font-mono text-xs"
              title={sharedTopic}
            >
              {sharedTopic}
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={toggle}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary dark:text-dark-text-tertiary dark:hover:bg-dark-surface-tertiary dark:hover:text-dark-text-primary flex flex-1 items-center justify-center rounded-lg py-2 transition-colors"
            >
              {isDark ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={addTab}
              aria-label="Add new agent tab"
              className="text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary dark:text-dark-text-tertiary dark:hover:bg-dark-surface-tertiary dark:hover:text-dark-text-primary flex flex-1 items-center justify-center rounded-lg py-2 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="relative flex flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === activeTabId ? "absolute inset-0 flex flex-col" : "hidden"}
            >
              {tab.session ? (
                tab.session.model ? (
                  <BotChatView
                    session={tab.session as BotHistoryEntry}
                    onLeave={() => {
                      const client = clientsRef.current.get(tab.id);
                      if (client) {
                        void client.disconnect();
                        clientsRef.current.delete(tab.id);
                      }
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === tab.id ? { ...t, session: null, client: null } : t,
                        ),
                      );
                    }}
                    client={tab.client ?? undefined}
                  />
                ) : (
                  <ChatView
                    name={tab.session.name}
                    topic={tab.session.topic}
                    natsUrl={tab.session.natsUrl}
                    isActive={tab.id === activeTabId}
                    client={tab.client ?? undefined}
                  />
                )
              ) : (
                <UnifiedSettingsPanel
                  takenNames={connectedNames}
                  onConnect={(entry) => {
                    void (async () => {
                      const { NatsClient: NatsClientClass } = await import("./nats/NatsClient");
                      const client = new NatsClientClass();
                      handleConnect(tab.id, entry, client);
                    })();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
