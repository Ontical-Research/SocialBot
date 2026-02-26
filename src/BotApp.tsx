import { useState } from "react";
import BotSettingsPanel from "./bot/BotSettingsPanel";
import BotChatView from "./bot/BotChatView";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";

function BotApp() {
  const [session, setSession] = useState<BotHistoryEntry | null>(null);

  if (session) {
    return <BotChatView session={session} onLeave={() => setSession(null)} />;
  }

  return <BotSettingsPanel onConnect={setSession} />;
}

export default BotApp;
