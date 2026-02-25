import { useState } from "react";
import "./App.css";
import SettingsPanel from "./settings/SettingsPanel";
import type { HistoryEntry } from "./settings/useSettingsHistory";

function App() {
  const [connection, setConnection] = useState<HistoryEntry | null>(null);

  if (connection) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <div className="text-xl font-semibold">
          Connected as <span className="text-blue-400">{connection.name}</span> to{" "}
          <span className="text-green-400">{connection.topic}</span>
        </div>
      </main>
    );
  }

  return <SettingsPanel onConnect={setConnection} />;
}

export default App;
