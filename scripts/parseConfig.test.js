import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig } from "./parseConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, "__fixtures__");

beforeEach(() => {
  mkdirSync(fixtureDir, { recursive: true });
});

afterEach(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("parseConfig", () => {
  it("returns defaults when no arguments are provided", () => {
    const result = parseConfig([]);
    expect(result).toEqual({
      natsUrl: "ws://localhost:9222",
      agents: [],
    });
  });

  it("returns defaults when argument is not a .yaml/.yml file", () => {
    const result = parseConfig(["--name", "Alice"]);
    expect(result).toEqual({
      natsUrl: "ws://localhost:9222",
      agents: [],
    });
  });

  it("parses YAML with nats_url and agents", () => {
    const yaml = `
nats_url: ws://myserver:4222
agents:
  - name: Alice
    topic: chat
  - name: Bob
    topic: chat
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.natsUrl).toBe("ws://myserver:4222");
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]).toMatchObject({
      name: "Alice",
      topic: "chat",
      model: "",
      promptPath: "",
      promptContent: "",
    });
    expect(result.agents[1]).toMatchObject({
      name: "Bob",
      topic: "chat",
      model: "",
      promptPath: "",
      promptContent: "",
    });
  });

  it("uses default natsUrl when nats_url is not in YAML", () => {
    const yaml = `
agents:
  - name: Alice
    topic: chat
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.natsUrl).toBe("ws://localhost:9222");
  });

  it("parses YAML agent with model field", () => {
    const yaml = `
agents:
  - name: Bob
    topic: chat
    model: claude-haiku-4-5-20251001
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.agents[0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("parses YAML agent with prompt path — reads file content", () => {
    const promptContent = "Be a helpful assistant.";
    const promptPath = resolve(fixtureDir, "friendly.md");
    writeFileSync(promptPath, promptContent, "utf-8");

    const yaml = `
agents:
  - name: Bob
    topic: chat
    model: claude-haiku-4-5-20251001
    prompt: ${promptPath}
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.agents[0].promptPath).toBe(promptPath);
    expect(result.agents[0].promptContent).toBe(promptContent);
  });

  it("resolves prompt path relative to project root when not absolute", () => {
    const promptContent = "Be concise.";
    // Write the prompt inside fixtureDir, but reference it relatively from project root
    // fixtureDir is scripts/__fixtures__, so the relative path from project root is scripts/__fixtures__/concise.md
    const promptRelPath = "scripts/__fixtures__/concise.md";
    const promptAbsPath = resolve(fixtureDir, "concise.md");
    writeFileSync(promptAbsPath, promptContent, "utf-8");

    const yaml = `
agents:
  - name: Alice
    topic: chat
    model: claude-haiku-4-5-20251001
    prompt: ${promptRelPath}
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.agents[0].promptContent).toBe(promptContent);
  });

  it("returns empty agents list when YAML has no agents key", () => {
    const yaml = `nats_url: ws://localhost:9222`;
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.agents).toEqual([]);
  });

  it("includes natsUrl on each agent entry", () => {
    const yaml = `
nats_url: ws://myserver:4222
agents:
  - name: Alice
    topic: chat
`.trim();
    const yamlPath = resolve(fixtureDir, "test.yaml");
    writeFileSync(yamlPath, yaml, "utf-8");

    const result = parseConfig([yamlPath]);
    expect(result.agents[0].natsUrl).toBe("ws://myserver:4222");
  });
});
