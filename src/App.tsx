import { useState } from "react";
import "./App.css";
import SettingsPanel from "./settings/SettingsPanel";
import ChatView from "./chat/ChatView";
import type { HistoryEntry } from "./settings/useSettingsHistory";

function App() {
  const [connection, setConnection] = useState<HistoryEntry | null>(null);

  if (connection) {
    return (
      <ChatView name={connection.name} topic={connection.topic} natsUrl={connection.natsUrl} />
    );
  }

  return <SettingsPanel onConnect={setConnection} />;
}

export default App;
