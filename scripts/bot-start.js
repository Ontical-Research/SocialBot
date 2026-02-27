#!/usr/bin/env node
/**
 * SocialBot bot startup script.
 *
 * Starts the Express proxy server on port 3001, then starts the Vite dev
 * server and opens the bot UI in the default browser once Vite is ready.
 * The actual Vite port is detected from its output, so this works even when
 * port 5173 is already in use.
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

// Start Vite dev server — pipe stdout so we can detect the ready URL
const viteBin = resolve(projectRoot, "node_modules", ".bin", "vite");
const vite = spawn(viteBin, [], {
  cwd: projectRoot,
  stdio: ["inherit", "pipe", "inherit"],
  shell: false,
});

let browserOpened = false;

vite.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  // Vite prints "Local:   http://localhost:<port>/" when ready
  if (!browserOpened) {
    const match = text.match(/Local:\s+(http:\/\/localhost:\d+)\//);
    if (match) {
      browserOpened = true;
      const botUrl = `${match[1]}/bot`;
      import("open")
        .then(({ default: open }) => open(botUrl))
        .catch((err) =>
          console.warn("[bot-start] Could not open browser automatically:", err.message),
        );
    }
  }
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
