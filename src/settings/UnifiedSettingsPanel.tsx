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

  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder-text-tertiary transition-colors focus:border-accent focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-primary dark:placeholder-dark-text-tertiary dark:focus:border-dark-accent";

  const selectClass =
    "w-full appearance-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary transition-colors focus:border-accent focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-primary dark:focus:border-dark-accent";

  return (
    <main className="bg-surface text-text-primary dark:bg-dark-surface dark:text-dark-text-primary flex h-full flex-col items-center justify-center overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-accent dark:bg-dark-accent mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-text-primary dark:text-dark-text-primary text-xl font-semibold tracking-tight">
            Join a chat room
          </h1>
          <p className="text-text-secondary dark:text-dark-text-secondary mt-1 text-sm">
            Enter your details to connect
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="unified-name-input"
              className="text-text-secondary dark:text-dark-text-secondary text-xs font-medium tracking-wide uppercase"
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
              className={inputClass}
              placeholder="Your display name"
            />
            <datalist id="unified-name-history">
              {nameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {isNameTaken && (
              <p className="text-danger dark:text-dark-danger text-xs">
                Name &ldquo;{name}&rdquo; is already in use.
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="unified-topic-input"
              className="text-text-secondary dark:text-dark-text-secondary text-xs font-medium tracking-wide uppercase"
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
              className={inputClass}
              placeholder="e.g. chat.room1"
            />
            <datalist id="unified-topic-history">
              {topicOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="unified-model-select"
              className="text-text-secondary dark:text-dark-text-secondary text-xs font-medium tracking-wide uppercase"
            >
              Model
            </label>
            <select
              id="unified-model-select"
              aria-label="Model"
              value={selectedModel}
              onChange={handleModelChange}
              className={selectClass}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="unified-prompt-select"
              className="text-text-secondary dark:text-dark-text-secondary text-xs font-medium tracking-wide uppercase"
            >
              Prompt
            </label>
            <select
              id="unified-prompt-select"
              aria-label="Prompt"
              value={selectedPromptPath}
              onChange={handlePromptChange}
              disabled={!isBotMode}
              className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`}
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
              <option value={BROWSE_SENTINEL}>{"Browse\u2026"}</option>
            </select>
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
            className="bg-accent hover:bg-accent-hover focus:ring-accent/30 dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:focus:ring-dark-accent/30 mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            Connect
          </button>
        </form>
      </div>
    </main>
  );
}

export default UnifiedSettingsPanel;
