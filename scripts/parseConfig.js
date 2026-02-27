/**
 * Parse an optional YAML config file path from a list of CLI arguments.
 *
 * If the first argument ends with ``.yaml`` or ``.yml``, it is treated as a
 * YAML config file.  Otherwise, defaults are returned.
 *
 * YAML schema::
 *
 *   nats_url: ws://localhost:9222   # optional
 *   agents:
 *     - name: Alice
 *       topic: chat
 *     - name: Bob
 *       topic: chat
 *       model: claude-haiku-4-5-20251001
 *       prompt: prompts/friendly.md   # relative to project root or absolute
 *
 * @param {string[]} args - Array of CLI argument strings (e.g. process.argv.slice(2))
 * @returns {{ natsUrl: string, agents: import('./parseConfig').UnifiedEntry[] }}
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const DEFAULT_NATS_URL = "ws://localhost:9222";

/**
 * @typedef {{ nats_url?: string, agents?: RawAgent[] }} YamlConfig
 * @typedef {{ name?: string, topic?: string, model?: string, prompt?: string }} RawAgent
 * @typedef {{ name: string, topic: string, natsUrl: string, model: string, promptPath: string, promptContent: string }} UnifiedEntry
 */

/**
 * @param {string[]} args
 * @returns {{ natsUrl: string, agents: UnifiedEntry[] }}
 */
export function parseConfig(args) {
  const maybeYaml = args.find(
    (/** @type {string} */ a) => a.endsWith(".yaml") || a.endsWith(".yml"),
  );

  if (!maybeYaml) {
    return { natsUrl: DEFAULT_NATS_URL, agents: [] };
  }

  const rawYaml = readFileSync(maybeYaml, "utf-8");
  /** @type {YamlConfig} */
  const config = /** @type {YamlConfig} */ (yaml.load(rawYaml));

  const natsUrl = config.nats_url ?? DEFAULT_NATS_URL;

  const rawAgents = Array.isArray(config.agents) ? config.agents : [];

  const agents = rawAgents.map((/** @type {RawAgent} */ agent) => {
    const name = agent.name ?? "";
    const topic = agent.topic ?? "";
    const model = agent.model ?? "";

    let promptPath = "";
    let promptContent = "";

    if (agent.prompt) {
      const absPath = isAbsolute(agent.prompt) ? agent.prompt : resolve(projectRoot, agent.prompt);
      promptPath = absPath;
      promptContent = readFileSync(absPath, "utf-8");
    }

    return { name, topic, natsUrl, model, promptPath, promptContent };
  });

  return { natsUrl, agents };
}

/**
 * Write the resolved config to ``public/config.json``.
 *
 * @param {{ natsUrl: string, agents: object[] }} config
 * @returns {string} Absolute path of the written file
 */
export function writePublicConfig(config) {
  const configPath = resolve(projectRoot, "public", "config.json");
  writeFileSync(configPath, JSON.stringify(config) + "\n", "utf-8");
  return configPath;
}
