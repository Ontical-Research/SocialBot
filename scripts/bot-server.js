#!/usr/bin/env node
/**
 * SocialBot Express proxy server.
 *
 * Handles LLM inference requests from the bot browser UI. API keys are read
 * from the environment — they are never accepted from the client.
 *
 * Usage:
 *   node scripts/bot-server.js
 *
 * Endpoints:
 *   GET  /health        → { status: "ok" }
 *   GET  /api/models    → { models: string[] }
 *   POST /api/chat      → { reply: string } | { error: string }
 */

import express from "express";
import { fileURLToPath } from "node:url";
import { loadModel, buildMessages } from "./llm.js";

const PORT = process.env.BOT_SERVER_PORT ?? "3001";

const ANTHROPIC_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"];
const OPENAI_MODELS = ["gpt-4o", "o3", "o4-mini"];

/**
 * Create and configure the Express application (exported for testing).
 *
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  /** Available models based on configured API keys */
  app.get("/api/models", (_req, res) => {
    const models = [];
    if (process.env.ANTHROPIC_API_KEY) models.push(...ANTHROPIC_MODELS);
    if (process.env.OPENAI_API_KEY) models.push(...OPENAI_MODELS);
    res.json({ models });
  });

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
   * The ``name`` field on each message carries the NATS sender name so the LLM
   * knows who said what.
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

    // Load the model — throws for unknown providers (returns 400)
    let llm;
    try {
      llm = loadModel(model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: message });
    }

    // Build message array with system prompt and name-tagged history
    const langchainMessages = buildMessages(systemPrompt ?? "", messages);

    // Invoke the LLM — API/auth errors return 502
    try {
      const response = await llm.invoke(langchainMessages);
      const reply =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      return res.json({ reply });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(502).json({ error: message });
    }
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
