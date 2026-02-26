#!/usr/bin/env node
/**
 * SocialBot Express proxy server.
 *
 * Handles LLM inference requests from the bot browser UI. API keys are read
 * from the environment — they are never accepted from the client.
 *
 * Usage:
 *   node scripts/bot-server.js [--port <port>]
 *
 * Endpoints:
 *   GET  /health     → { status: "ok" }
 *   POST /api/chat   → { reply: string } | { error: string }
 */

import express from "express";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.BOT_SERVER_PORT ?? 3001;

/**
 * Create and configure the Express application (exported for testing).
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  /** Health check */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  /**
   * LLM inference endpoint.
   *
   * Request body:
   *   { model: string, systemPrompt: string, messages: Array<{ role, content, name? }> }
   *
   * Response:
   *   { reply: string }  on success
   *   { error: string }  on validation or model error (HTTP 400 / 502)
   */
  app.post("/api/chat", async (req, res) => {
    const { model, systemPrompt, messages } = req.body ?? {};

    if (!model || typeof model !== "string") {
      return res.status(400).json({ error: "model is required and must be a string" });
    }
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages is required and must be an array" });
    }

    // Stub response — real LLM integration comes in issue #28
    return res.json({ reply: "stub response" });
  });

  return app;
}

/**
 * Start the server (only when run directly, not when imported by tests).
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[bot-server] Listening on http://localhost:${PORT}`);
    console.log(`[bot-server] Health: http://localhost:${PORT}/health`);
  });
}
