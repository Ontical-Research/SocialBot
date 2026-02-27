#!/usr/bin/env node
/**
 * SocialBot unified startup script.
 *
 * Writes public/config.json, starts the Express proxy server on port 3001,
 * then starts the Vite dev server and opens the browser at the root URL once
 * Vite is ready.
 *
 * Usage:
 *   node scripts/start.js                  # single empty tab (login form)
 *   npm start -- agents.yaml               # pre-populate tabs from YAML
 *   npm start -- demo.yaml                 # launch Alice + Bob demo
 */

import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseConfig, writePublicConfig } from "./parseConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const config = parseConfig(process.argv.slice(2));
const configPath = writePublicConfig(config);
console.log(`[start] Wrote ${configPath}:`, JSON.stringify(config));

// Start the Express proxy server
const serverBin = resolve(projectRoot, "scripts", "bot-server.js");
const server = spawn(process.execPath, [serverBin], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

server.on("error", (err) => {
  console.error("[start] Failed to start bot server:", err.message);
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
      const url = `${String(match[1])}/`;
      import("open")
        .then(({ default: open }) => open(url))
        .catch((err) => {
          console.warn(
            "[start] Could not open browser automatically:",
            err instanceof Error ? err.message : String(err),
          );
        });
    }
  }
});

vite.on("error", (err) => {
  // If local binary not found, retry with npx
  const nodeErr = /** @type {NodeJS.ErrnoException} */ (err);
  if (nodeErr.code === "ENOENT") {
    const fallback = spawn("npx", ["vite"], {
      cwd: projectRoot,
      stdio: ["inherit", "pipe", "inherit"],
      shell: false,
    });
    fallback.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (!browserOpened) {
        const match = text.match(/Local:\s+(http:\/\/localhost:\d+)\//);
        if (match) {
          browserOpened = true;
          import("open")
            .then(({ default: open }) => open(`${String(match[1])}/`))
            .catch((err) => {
              console.warn(
                "[start] Could not open browser automatically:",
                err instanceof Error ? err.message : String(err),
              );
            });
        }
      }
    });
    fallback.on("error", (e) => {
      console.error("[start] Failed to launch vite:", e.message);
      server.kill();
      process.exit(1);
    });
    fallback.on("exit", (code) => {
      server.kill();
      process.exit(code ?? 0);
    });
  } else {
    console.error("[start] Failed to launch vite:", err.message);
    server.kill();
    process.exit(1);
  }
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
