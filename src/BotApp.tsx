import { useState } from "react";
import BotSettingsPanel from "./bot/BotSettingsPanel";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";

function BotApp() {
  const [session, setSession] = useState<BotHistoryEntry | null>(null);

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
        <p className="text-lg text-gray-400">Bot chat — coming soon</p>
      </div>
    );
  }

  return <BotSettingsPanel onConnect={setSession} />;
}

export default BotApp;
