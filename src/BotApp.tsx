import { useState } from "react";
import BotSettingsPanel from "./bot/BotSettingsPanel";
import type { BotHistoryEntry } from "./bot/useBotSettingsHistory";
import { useBotSession } from "./bot/useBotSession";

function BotSession({ session, onLeave }: { session: BotHistoryEntry; onLeave: () => void }) {
  const { history, error } = useBotSession(session);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-gray-100">
      <div className="mb-4 text-sm text-gray-400">
        <span className="font-medium text-gray-200">{session.name}</span>
        {" · "}
        {session.topic}
        {" · "}
        {session.model}
        {" · "}
        {session.promptPath}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 text-sm text-gray-500">
        {history.length === 0
          ? "Waiting for messages…"
          : `${history.length} message${history.length === 1 ? "" : "s"} in history`}
      </div>

      <button onClick={onLeave} className="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600">
        Leave chat
      </button>
    </div>
  );
}

function BotApp() {
  const [session, setSession] = useState<BotHistoryEntry | null>(null);

  if (session) {
    return <BotSession session={session} onLeave={() => setSession(null)} />;
  }

  return <BotSettingsPanel onConnect={setSession} />;
}

export default BotApp;
