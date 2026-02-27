import { useState } from "react";
import "./App.css";
import UnifiedSettingsPanel from "./settings/UnifiedSettingsPanel";
import ChatView from "./chat/ChatView";
import BotChatView from "./bot/BotChatView";
import type { UnifiedEntry } from "./settings/useUnifiedSettingsHistory";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";

function App() {
  const [session, setSession] = useState<UnifiedEntry | null>(null);

  if (session) {
    if (session.model) {
      return (
        <BotChatView
          session={session as BotHistoryEntry}
          onLeave={() => {
            setSession(null);
          }}
        />
      );
    }
    return <ChatView name={session.name} topic={session.topic} natsUrl={session.natsUrl} />;
  }

  return <UnifiedSettingsPanel onConnect={setSession} />;
}

export default App;
