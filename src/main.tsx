import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import type { UnifiedEntry } from "./settings/useUnifiedSettingsHistory";

interface AppConfig {
  natsUrl?: string;
  agents?: UnifiedEntry[];
}

async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + "config.json");
    if (!res.ok) return {};
    return (await res.json()) as AppConfig;
  } catch {
    return {};
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

void loadConfig().then((config) => {
  createRoot(rootEl).render(
    <StrictMode>
      <App initialAgents={config.agents ?? []} />
    </StrictMode>,
  );
});
