#!/usr/bin/env node
/**
 * Demo script: opens two headed Chromium windows (Alice and Bob) and has them
 * chat with each other on the SocialBot app.
 *
 * Prerequisites:
 *   - NATS server running on ws://localhost:9222
 *   - Vite dev server running (npm run dev) — or this script starts one itself
 *
 * Usage:
 *   node scripts/demo-chat.mjs
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const APP_URL = "http://localhost:5173";
const TOPIC = "chat.demo";
const PAUSE_MS = 1200; // ms between each message send

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Start the Vite dev server and wait until it's ready. */
async function startVite() {
  // Write a neutral config.json so the settings screen starts empty
  const configPath = resolve(projectRoot, "public", "config.json");
  writeFileSync(configPath, JSON.stringify({ name: "", topic: "" }) + "\n", "utf-8");

  const viteBin = resolve(projectRoot, "node_modules", ".bin", "vite");
  const vite = spawn(viteBin, ["dev"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  await new Promise((resolve, reject) => {
    vite.stdout.on("data", (chunk) => {
      const line = chunk.toString();
      process.stdout.write(`[vite] ${line}`);
      if (line.includes("Local:")) resolve();
    });
    vite.stderr.on("data", (chunk) => process.stderr.write(`[vite:err] ${chunk}`));
    vite.on("error", reject);
    // Give it at most 15 s to start
    setTimeout(() => reject(new Error("Vite did not start in time")), 15_000);
  });

  return vite;
}

/** Fill the settings form and click Connect. */
async function connectAs(page, name, topic) {
  await page.goto(APP_URL);
  await page.waitForSelector('[aria-label="Name"]');

  await page.fill('[aria-label="Name"]', name);
  await page.fill('[aria-label="Topic"]', topic);
  await page.click('button[type="submit"]');

  // Wait for the chat header to appear
  await page.waitForSelector("header");
  console.log(`[demo] ${name} connected to topic "${topic}"`);
}

/** Type and send a message from a page. */
async function sendMessage(page, senderName, text) {
  await page.fill('input[placeholder="Type a message…"]', text);
  await page.click('button:has-text("Send")');
  console.log(`[demo] ${senderName}: ${text}`);
}

/** Wait until a specific message text appears anywhere in the message list. */
async function waitForMessage(page, text) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout: 10_000 });
}

async function main() {
  // --- Start Vite if not already running ---
  let viteProcess = null;
  try {
    const res = await fetch(APP_URL);
    if (!res.ok) throw new Error("not ok");
    console.log("[demo] Vite already running at", APP_URL);
  } catch {
    console.log("[demo] Starting Vite dev server…");
    viteProcess = await startVite();
    await sleep(500); // brief settle time
  }

  // --- Launch browser ---
  const browser = await chromium.launch({ headless: false, slowMo: 50 });

  // Open two browser contexts so they have independent localStorage / cookies
  const ctxAlice = await browser.newContext({ viewport: { width: 800, height: 650 } });
  const ctxBob = await browser.newContext({ viewport: { width: 800, height: 650 } });

  const alice = await ctxAlice.newPage();
  const bob = await ctxBob.newPage();

  // --- Connect ---
  await connectAs(alice, "Alice", TOPIC);
  await connectAs(bob, "Bob", TOPIC);

  await sleep(PAUSE_MS);

  // --- Conversation ---
  const conversation = [
    { page: alice, name: "Alice", text: "Hey Bob! Can you hear me? 👋" },
    { page: bob, name: "Bob", text: "Loud and clear, Alice! This is so cool 🎉" },
    { page: alice, name: "Alice", text: "SocialBot is working perfectly over NATS!" },
    { page: bob, name: "Bob", text: "Agreed — real-time messaging in the browser 🚀" },
    { page: alice, name: "Alice", text: "Let's test a few more messages…" },
    { page: bob, name: "Bob", text: "Sure! 1, 2, 3 — testing testing" },
    { page: alice, name: "Alice", text: "Received! Demo complete ✅" },
    { page: bob, name: "Bob", text: "Nice work, see you next time! 👋" },
  ];

  for (const { page, name, text } of conversation) {
    await sendMessage(page, name, text);
    // Wait for the counterpart to receive the message
    const other = page === alice ? bob : alice;
    await waitForMessage(other, text);
    await sleep(PAUSE_MS);
  }

  console.log("\n[demo] Conversation complete! Keeping windows open for 10 seconds…");
  await sleep(10_000);

  // --- Teardown ---
  await browser.close();
  if (viteProcess) {
    viteProcess.kill();
  }
  console.log("[demo] Done.");
}

main().catch((err) => {
  console.error("[demo] Error:", err);
  process.exit(1);
});
