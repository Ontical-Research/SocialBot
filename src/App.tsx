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
    <div className="flex h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      {/* Tab strip */}
      <nav
        className="flex w-40 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
        aria-label="Agent tabs"
      >
        <div className="flex flex-1 flex-col overflow-y-auto py-2">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative">
              <button
                onClick={() => {
                  setActiveTabId(tab.id);
                  setConfirmRemoveId(null);
                }}
                className={`w-full truncate px-3 py-2 text-left text-sm ${
                  tab.id === activeTabId
                    ? "bg-gray-200 font-semibold text-gray-900 dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-white"
                }`}
              >
                {tabLabel(tab)}
              </button>
              {confirmRemoveId === tab.id ? (
                <div className="flex items-center justify-between bg-red-100 px-2 py-1 dark:bg-red-900/30">
                  <span className="text-xs text-red-600 dark:text-red-300">Confirm?</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        void confirmRemoveTab(tab.id);
                      }}
                      className="rounded px-1 text-xs text-red-600 hover:text-red-800 dark:text-red-300 dark:hover:text-red-100"
                    >
                      Yes
                    </button>
                    <button
                      onClick={cancelRemoveTab}
                      className="rounded px-1 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
                  className="absolute top-1/2 right-1 -translate-y-1/2 rounded px-1 text-xs text-gray-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Theme toggle + Add tab button */}
        <div className="border-t border-gray-200 p-2 dark:border-gray-700">
          {sharedTopic && (
            <div
              className="mb-1 truncate px-1 font-mono text-xs text-green-400"
              title={sharedTopic}
            >
              {sharedTopic}
            </div>
          )}
          <button
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="mb-1 w-full rounded-lg py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            {isDark ? "☀" : "☾"}
          </button>
          <button
            onClick={addTab}
            aria-label="+"
            className="w-full rounded-lg py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            +
          </button>
        </div>
      </nav>

      {/* Main column: content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Content area — all tabs rendered simultaneously; inactive ones hidden */}
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
