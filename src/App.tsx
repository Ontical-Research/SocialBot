import { useState, useEffect, useRef } from "react";
import "./App.css";
import UnifiedSettingsPanel from "./settings/UnifiedSettingsPanel";
import ChatView from "./chat/ChatView";
import BotChatView from "./bot/BotChatView";
import type { UnifiedEntry } from "./settings/useUnifiedSettingsHistory";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";
import type { NatsClient } from "./nats/NatsClient";

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
  const [tabs, setTabs] = useState<TabState[]>(() => {
    if (initialAgents && initialAgents.length > 0) {
      return initialAgents.map((agent) => makeTab(agent, null));
    }
    return [makeTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Track NatsClient instances in a ref so they can be created once and cleaned up
  const clientsRef = useRef<Map<string, NatsClient>>(new Map());

  // Create NatsClient instances for pre-populated tabs on mount
  useEffect(() => {
    if (!initialAgents || initialAgents.length === 0) return;
    void (async () => {
      const { NatsClient: NatsClientClass } = await import("./nats/NatsClient");
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.session && !tab.client) {
            const client = new NatsClientClass();
            clientsRef.current.set(tab.id, client);
            return { ...tab, client };
          }
          return tab;
        }),
      );
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup all clients on unmount
  useEffect(() => {
    const clients = clientsRef.current;
    return () => {
      for (const client of clients.values()) {
        void client.disconnect();
      }
    };
  }, []);

  const connectedNames = tabs
    .filter((t) => t.session !== null)
    .map((t) => t.session?.name ?? "")
    .filter(Boolean);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

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
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Tab strip */}
      <nav
        className="flex w-40 flex-shrink-0 flex-col border-r border-gray-700 bg-gray-800"
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
                    ? "bg-gray-700 font-semibold text-white"
                    : "text-gray-400 hover:bg-gray-700/50 hover:text-white"
                }`}
              >
                {tabLabel(tab)}
              </button>
              {confirmRemoveId === tab.id ? (
                <div className="flex items-center justify-between bg-red-900/30 px-2 py-1">
                  <span className="text-xs text-red-300">Confirm?</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        void confirmRemoveTab(tab.id);
                      }}
                      className="rounded px-1 text-xs text-red-300 hover:text-red-100"
                    >
                      Yes
                    </button>
                    <button
                      onClick={cancelRemoveTab}
                      className="rounded px-1 text-xs text-gray-400 hover:text-white"
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

        {/* Add tab button */}
        <div className="border-t border-gray-700 p-2">
          <button
            onClick={addTab}
            aria-label="+"
            className="w-full rounded-lg py-1 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            +
          </button>
        </div>
      </nav>

      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab.session ? (
          activeTab.session.model ? (
            <BotChatView
              session={activeTab.session as BotHistoryEntry}
              onLeave={() => {
                const client = clientsRef.current.get(activeTab.id);
                if (client) {
                  void client.disconnect();
                  clientsRef.current.delete(activeTab.id);
                }
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTab.id ? { ...t, session: null, client: null } : t,
                  ),
                );
              }}
              client={activeTab.client ?? undefined}
            />
          ) : (
            <ChatView
              name={activeTab.session.name}
              topic={activeTab.session.topic}
              natsUrl={activeTab.session.natsUrl}
              client={activeTab.client ?? undefined}
            />
          )
        ) : (
          <UnifiedSettingsPanel
            takenNames={connectedNames}
            onConnect={(entry) => {
              void (async () => {
                const { NatsClient: NatsClientClass } = await import("./nats/NatsClient");
                const client = new NatsClientClass();
                handleConnect(activeTab.id, entry, client);
              })();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
