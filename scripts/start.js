#!/usr/bin/env node
/**
 * SocialBot startup script.
 *
 * Parses --name and --topic CLI flags, writes public/config.json with those values,
 * then spawns `vite dev`.
 *
 * Usage:
 *   node scripts/start.js [--name <name>] [--topic <topic>] [--nats-url <url>]
 *   npm start -- --name Alice --topic chat.room1 --nats-url ws://localhost:9222
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./parseArgs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const { name, topic, natsUrl } = parseArgs(process.argv.slice(2));

const config = { name, topic, natsUrl };
const configPath = resolve(projectRoot, "public", "config.json");

writeFileSync(configPath, JSON.stringify(config) + "\n", "utf-8");
console.log(`[start] Wrote ${configPath}:`, config);

// Spawn vite dev — prefer local binary, fall back to npx
const viteBin = resolve(projectRoot, "node_modules", ".bin", "vite");
const child = spawn(viteBin, [], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  // If local binary not found, retry with npx
  if (err.code === "ENOENT") {
    const fallback = spawn("npx", ["vite"], {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    });
    fallback.on("error", (e) => {
      console.error("[start] Failed to launch vite:", e.message);
      process.exit(1);
    });
    fallback.on("exit", (code) => process.exit(code ?? 0));
  } else {
    console.error("[start] Failed to launch vite:", err.message);
    process.exit(1);
  }
});

child.on("exit", (code) => process.exit(code ?? 0));
