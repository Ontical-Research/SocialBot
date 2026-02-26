// @vitest-environment node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "..");

describe("prompts/friendly.md", () => {
  const promptPath = resolve(ROOT, "prompts", "friendly.md");

  it("exists", () => {
    expect(existsSync(promptPath)).toBe(true);
  });

  it("contains non-trivial content (at least 50 characters)", () => {
    const content = readFileSync(promptPath, "utf-8");
    expect(content.trim().length).toBeGreaterThan(50);
  });

  it("does not contain placeholder text", () => {
    const content = readFileSync(promptPath, "utf-8").toLowerCase();
    expect(content).not.toContain("todo");
    expect(content).not.toContain("placeholder");
  });
});

describe("README.md — bot section", () => {
  const readmePath = resolve(ROOT, "README.md");
  let readme: string;

  try {
    readme = readFileSync(readmePath, "utf-8");
  } catch {
    readme = "";
  }

  it("has a 'Running the Bot' section", () => {
    expect(readme).toMatch(/running the bot/i);
  });

  it("mentions ANTHROPIC_API_KEY as a required environment variable", () => {
    expect(readme).toContain("ANTHROPIC_API_KEY");
  });

  it("includes steps to start the bot (npm run bot or similar)", () => {
    expect(readme).toMatch(/npm run bot|pnpm bot/i);
  });

  it("mentions the model string format or claude model name", () => {
    // Should mention how to identify model strings, e.g. claude-haiku
    expect(readme).toMatch(/claude-|model string|model name/i);
  });

  it("notes that the GitHub Pages demo is human-only", () => {
    expect(readme).toMatch(/human.only|human ui only|bot runs locally/i);
  });

  it("mentions other providers need their own API keys", () => {
    expect(readme).toMatch(/openai|other provider|own key/i);
  });
});
