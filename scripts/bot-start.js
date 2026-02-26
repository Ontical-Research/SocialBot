#!/usr/bin/env node
/**
 * SocialBot bot startup script.
 *
 * Starts the Express proxy server on port 3001, then opens the bot UI
 * in the default browser at http://localhost:5173/bot.
 *
 * Usage:
 *   npm run bot
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Start the Express proxy server
const serverBin = resolve(projectRoot, "scripts", "bot-server.js");
const server = spawn(process.execPath, [serverBin], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

server.on("error", (err) => {
  console.error("[bot-start] Failed to start bot server:", err.message);
  process.exit(1);
});

// Give the server a moment to start, then open the browser and start Vite
setTimeout(async () => {
  try {
    const { default: open } = await import("open");
    await open("http://localhost:5173/bot");
  } catch (err) {
    console.warn("[bot-start] Could not open browser automatically:", err.message);
  }
}, 1000);

// Start Vite dev server
const viteBin = resolve(projectRoot, "node_modules", ".bin", "vite");
const vite = spawn(viteBin, ["dev"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

vite.on("error", (err) => {
  console.error("[bot-start] Failed to start Vite:", err.message);
  server.kill();
  process.exit(1);
});

vite.on("exit", (code) => {
  server.kill();
  process.exit(code ?? 0);
});

// Forward SIGINT/SIGTERM to both children
process.on("SIGINT", () => {
  server.kill("SIGINT");
  vite.kill("SIGINT");
});
process.on("SIGTERM", () => {
  server.kill("SIGTERM");
  vite.kill("SIGTERM");
});
