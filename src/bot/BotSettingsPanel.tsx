import { useRef, useState } from "react";
import { useBotSettingsHistory, type BotHistoryEntry } from "./useBotSettingsHistory";

interface BotSettingsPanelProps {
  onConnect: (entry: BotHistoryEntry) => void;
}

/**
 * Bot login form. Mirrors the human SettingsPanel but adds model and prompt file
 * fields. The prompt field accepts a file path (with localStorage history) and a
 * Browse button that opens an OS file picker to load a .md or .txt prompt file.
 */
function BotSettingsPanel({ onConnect }: BotSettingsPanelProps) {
  const { history, modelHistory, promptPathHistory, addEntry } = useBotSettingsHistory();

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState("");
  const [promptPath, setPromptPath] = useState("");
  const [promptContent, setPromptContent] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameOptions = Array.from(new Set(history.map((e) => e.name)));
  const topicOptions = Array.from(new Set(history.map((e) => e.topic)));

  const allFilled =
    name.trim() !== "" && topic.trim() !== "" && model.trim() !== "" && promptPath.trim() !== "";

  function handleBrowse() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPromptPath(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPromptContent((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) return;
    const entry: BotHistoryEntry = { name, topic, model, promptPath, promptContent };
    addEntry(entry);
    onConnect(entry);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-sm rounded-xl bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold">SocialBot — Bot</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bot-name-input" className="text-sm font-medium text-gray-300">
              Name
            </label>
            <input
              id="bot-name-input"
              aria-label="Name"
              type="text"
              list="bot-name-history"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Bot name"
            />
            <datalist id="bot-name-history">
              {nameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bot-topic-input" className="text-sm font-medium text-gray-300">
              Topic
            </label>
            <input
              id="bot-topic-input"
              aria-label="Topic"
              type="text"
              list="bot-topic-history"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="NATS topic (e.g. chat)"
            />
            <datalist id="bot-topic-history">
              {topicOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bot-model-input" className="text-sm font-medium text-gray-300">
              Model
            </label>
            <input
              id="bot-model-input"
              aria-label="Model"
              type="text"
              list="model-history"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g. claude-haiku-4-5-20251001"
            />
            <datalist id="model-history">
              {modelHistory.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* Prompt file */}
          <div className="flex flex-col gap-1">
            <label htmlFor="bot-prompt-input" className="text-sm font-medium text-gray-300">
              Prompt file
            </label>
            <div className="flex gap-2">
              <input
                id="bot-prompt-input"
                aria-label="Prompt file"
                type="text"
                list="prompt-path-history"
                value={promptPath}
                onChange={(e) => setPromptPath(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="Path to prompt file"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 focus:outline-none"
              >
                Browse
              </button>
            </div>
            <datalist id="prompt-path-history">
              {promptPathHistory.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            {/* Hidden file input for the OS file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <button
            type="submit"
            disabled={!allFilled}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}

export default BotSettingsPanel;
