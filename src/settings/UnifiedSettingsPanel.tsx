import { useRef, useState } from "react";
import { useUnifiedSettingsHistory, type UnifiedEntry } from "./useUnifiedSettingsHistory";
import { useAvailableModels } from "./useAvailableModels";
import * as React from "react";

const BROWSE_SENTINEL = "__browse__";

interface UnifiedSettingsPanelProps {
  /** Called when the user submits the form with a valid entry. */
  onConnect: (entry: UnifiedEntry) => void;
  /** Names already in use by connected tabs; duplicate names are rejected. */
  takenNames?: string[];
}

/**
 * Unified login form for both human chat and bot mode.
 *
 * - Selecting "None" for model enters human chat mode.
 * - Selecting a real model enables the Prompt dropdown. The user can pick a
 *   previously used prompt from history, or choose "Browse…" to load a new
 *   file from disk.
 */
function UnifiedSettingsPanel({ onConnect, takenNames = [] }: UnifiedSettingsPanelProps) {
  const { history, modelHistory, promptHistory, addEntry } = useUnifiedSettingsHistory();
  const availableModels = useAvailableModels(modelHistory);

  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [natsUrl] = useState("ws://localhost:9222");
  const [selectedModel, setSelectedModel] = useState("None");
  const [selectedPromptPath, setSelectedPromptPath] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [browsedPrompt, setBrowsedPrompt] = useState<{ path: string; content: string } | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameOptions = Array.from(new Set(history.map((e) => e.name)));
  const topicOptions = Array.from(new Set(history.map((e) => e.topic)));

  const isBotMode = selectedModel !== "None" && selectedModel !== "";
  const promptReady =
    isBotMode && selectedPromptPath !== "" && selectedPromptPath !== BROWSE_SENTINEL;

  const isNameTaken = takenNames.includes(name.trim());
  const canConnect =
    name.trim() !== "" && topic.trim() !== "" && (!isBotMode || promptReady) && !isNameTaken;

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedModel(e.target.value);
    // Reset prompt when model changes
    setSelectedPromptPath("");
    setPromptContent("");
    setBrowsedPrompt(null);
  }

  function handlePromptChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === BROWSE_SENTINEL) {
      fileInputRef.current?.click();
      // Keep select showing blank until file is loaded
      setSelectedPromptPath("");
      setPromptContent("");
    } else {
      setSelectedPromptPath(value);
      const entry = promptHistory.find((p) => p.promptPath === value);
      setPromptContent(entry?.promptContent ?? "");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === "string" ? ev.target.result : "";
      setBrowsedPrompt({ path: file.name, content });
      setSelectedPromptPath(file.name);
      setPromptContent(content);
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected later
    e.target.value = "";
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canConnect) return;

    const entry: UnifiedEntry = {
      name,
      topic,
      natsUrl,
      model: isBotMode ? selectedModel : "",
      promptPath: isBotMode ? selectedPromptPath : "",
      promptContent: isBotMode ? promptContent : "",
    };
    addEntry(entry);
    onConnect(entry);
  }

  return (
    <main className="flex h-full flex-col items-center justify-center overflow-y-auto bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
      <div className="w-full max-w-sm rounded-xl bg-gray-100 p-8 shadow-lg dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold">SocialBot</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="unified-name-input"
              className="text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              Name
            </label>
            <input
              id="unified-name-input"
              aria-label="Name"
              type="text"
              list="unified-name-history"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Your name"
            />
            <datalist id="unified-name-history">
              {nameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {isNameTaken && (
              <p className="text-xs text-red-500 dark:text-red-400">
                Name "{name}" is already in use.
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="unified-topic-input"
              className="text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              Topic
            </label>
            <input
              id="unified-topic-input"
              aria-label="Topic"
              type="text"
              list="unified-topic-history"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
              }}
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="NATS topic (e.g. chat.room1)"
            />
            <datalist id="unified-topic-history">
              {topicOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="unified-model-select"
              className="text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              Model
            </label>
            <select
              id="unified-model-select"
              aria-label="Model"
              value={selectedModel}
              onChange={handleModelChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="unified-prompt-select"
              className="text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              Prompt
            </label>
            <select
              id="unified-prompt-select"
              aria-label="Prompt"
              value={selectedPromptPath}
              onChange={handlePromptChange}
              disabled={!isBotMode}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">-- select prompt --</option>
              {promptHistory.map((p) => (
                <option key={p.promptPath} value={p.promptPath}>
                  {p.promptPath}
                </option>
              ))}
              {browsedPrompt && !promptHistory.some((p) => p.promptPath === browsedPrompt.path) && (
                <option key={browsedPrompt.path} value={browsedPrompt.path}>
                  {browsedPrompt.path}
                </option>
              )}
              <option value={BROWSE_SENTINEL}>Browse…</option>
            </select>
            {/* Hidden file input triggered by selecting "Browse…" */}
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
            disabled={!canConnect}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}

export default UnifiedSettingsPanel;
