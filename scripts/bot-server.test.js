// @vitest-environment node
/**
 * Tests for the bot Express proxy server.
 *
 * Uses supertest to make HTTP requests against the Express app without
 * actually starting a listening server.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./bot-server.js";

describe("GET /health", () => {
  it("returns { status: 'ok' }", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /api/chat", () => {
  it("accepts { model, systemPrompt, messages } and returns { reply }", async () => {
    const app = createApp();
    const payload = {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "Hello", name: "Alice" },
        { role: "assistant", content: "Hi there!", name: "Bot" },
        { role: "user", content: "How are you?", name: "Alice" },
      ],
    };

    const res = await request(app).post("/api/chat").send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reply");
    expect(typeof res.body.reply).toBe("string");
  });

  it("accepts messages without a name field", async () => {
    const app = createApp();
    const payload = {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Hello" }],
    };

    const res = await request(app).post("/api/chat").send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reply");
  });

  it("returns 400 when model is missing", async () => {
    const app = createApp();
    const payload = {
      systemPrompt: "You are helpful.",
      messages: [{ role: "user", content: "Hello" }],
    };

    const res = await request(app).post("/api/chat").send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when messages is missing", async () => {
    const app = createApp();
    const payload = {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "You are helpful.",
    };

    const res = await request(app).post("/api/chat").send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});
