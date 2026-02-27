/**
 * LLM model loading and message building helpers.
 *
 * Model strings use a simple naming convention:
 *   - Anthropic models: e.g. "claude-haiku-4-5-20251001" (no prefix needed,
 *     detected by "claude-" prefix) or "anthropic/claude-haiku-4-5-20251001"
 *   - OpenAI models: "openai/gpt-4o", "gpt-4o" (detected by "gpt-" prefix)
 *   - Explicit "anthropic/" prefix always routes to ChatAnthropic
 *   - Explicit "openai/" prefix always routes to ChatOpenAI
 *
 * API keys are read from process.env (ANTHROPIC_API_KEY, OPENAI_API_KEY).
 */

import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Load a LangChain chat model from a model string.
 *
 * @param {string} modelString - Model identifier, e.g. "claude-haiku-4-5-20251001"
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 * @throws {Error} If the provider cannot be determined from the model string
 */
export function loadModel(modelString) {
  // Strip explicit provider prefix if present
  let provider = null;
  let modelName = modelString;

  if (modelString.includes("/")) {
    const slash = modelString.indexOf("/");
    provider = modelString.slice(0, slash).toLowerCase();
    modelName = modelString.slice(slash + 1);
  }

  // Auto-detect provider from model name if no prefix given
  if (!provider) {
    if (modelName.startsWith("claude-")) {
      provider = "anthropic";
    } else if (
      modelName.startsWith("gpt-") ||
      modelName.startsWith("o1") ||
      modelName.startsWith("o3")
    ) {
      provider = "openai";
    }
  }

  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({ model: modelName });
    case "openai":
      return new ChatOpenAI({ model: modelName });
    default:
      throw new Error(
        `Unknown model provider for "${modelString}". ` +
          `Use a prefix like "anthropic/" or "openai/", ` +
          `or a model name starting with "claude-" or "gpt-".`,
      );
  }
}

/**
 * Build a LangChain message array from a system prompt and conversation history.
 *
 * The system prompt is prepended as a SystemMessage. Each history entry is
 * converted to a HumanMessage or AIMessage. The ``name`` field (carrying the
 * NATS sender name) is passed through to the LangChain message's ``name``
 * property so the LLM knows who said what.
 *
 * @param {string} systemPrompt
 * @param {Array<{ role: string, content: string, name?: string }>} messages
 * @returns {import('@langchain/core/messages').BaseMessage[]}
 */
export function buildMessages(systemPrompt, messages) {
  /** @type {(SystemMessage | HumanMessage | AIMessage)[]} */
  const result = [new SystemMessage(systemPrompt)];

  for (const msg of messages) {
    if (msg.role === "user") {
      const m = new HumanMessage({ content: msg.content });
      if (msg.name) m.name = msg.name;
      result.push(m);
    } else if (msg.role === "assistant") {
      const m = new AIMessage({ content: msg.content });
      if (msg.name) m.name = msg.name;
      result.push(m);
    }
    // Unknown roles are silently skipped
  }

  return result;
}
