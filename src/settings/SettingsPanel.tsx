import { useState, useEffect } from "react";
import { useSettingsHistory, type HistoryEntry } from "./useSettingsHistory";

interface SettingsPanelProps {
  /** Called when the user clicks "Connect" with the chosen name and topic. */
  onConnect: (entry: HistoryEntry) => void;
}

/**
 * Settings panel displayed on startup. Fetches ``/config.json`` to get default
 * name and topic, shows combobox inputs populated from localStorage history, and
 * calls ``onConnect`` when the user submits the form.
 */
function SettingsPanel({ onConnect }: SettingsPanelProps) {
  const { history, addEntry } = useSettingsHistory();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((config: { name?: string; topic?: string }) => {
        setName(config.name ?? "");
        setTopic(config.topic ?? "");
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const entry: HistoryEntry = { name, topic };
    addEntry(entry);
    onConnect(entry);
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  const nameOptions = Array.from(new Set(history.map((e) => e.name)));
  const topicOptions = Array.from(new Set(history.map((e) => e.topic)));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-sm rounded-xl bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold">SocialBot</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name-input" className="text-sm font-medium text-gray-300">
              Name
            </label>
            <input
              id="name-input"
              aria-label="Name"
              type="text"
              list="name-history"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Your name"
            />
            <datalist id="name-history">
              {nameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="topic-input" className="text-sm font-medium text-gray-300">
              Topic
            </label>
            <input
              id="topic-input"
              aria-label="Topic"
              type="text"
              list="topic-history"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="NATS topic (e.g. chat.room1)"
            />
            <datalist id="topic-history">
              {topicOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}

export default SettingsPanel;
