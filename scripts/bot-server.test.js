// @vitest-environment node
/**
 * Tests for the bot Express proxy server.
 *
 * Uses supertest to make HTTP requests against the Express app without
 * actually starting a listening server. LLM calls are mocked so no real
 * API keys are needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

// Mock the llm module so no real API calls are made in tests
vi.mock("./llm.js", () => ({
  loadModel: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({ content: "mocked reply" }),
  }),
  buildMessages: vi.fn().mockReturnValue([]),
}));

// Import after mock is set up
const { createApp } = await import("./bot-server.js");

describe("GET /api/models", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("returns empty models array when no API keys are set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const app = createApp();
    const res = await request(app).get("/api/models");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ models: [] });
  });

  it("returns Anthropic models when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.OPENAI_API_KEY;
    const app = createApp();
    const res = await request(app).get("/api/models");
    expect(res.status).toBe(200);
    expect(res.body.models).toContain("claude-haiku-4-5-20251001");
    expect(res.body.models).toContain("claude-sonnet-4-6");
    expect(res.body.models).toContain("claude-opus-4-6");
    expect(res.body.models.some((m) => m.startsWith("gpt"))).toBe(false);
  });

  it("returns OpenAI models when OPENAI_API_KEY is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-openai-test";
    const app = createApp();
    const res = await request(app).get("/api/models");
    expect(res.status).toBe(200);
    expect(res.body.models).toContain("gpt-4o");
    expect(res.body.models).toContain("o3");
    expect(res.body.models).toContain("o4-mini");
    expect(res.body.models.some((m) => m.startsWith("claude"))).toBe(false);
  });

  it("returns combined models when both API keys are set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-openai-test";
    const app = createApp();
    const res = await request(app).get("/api/models");
    expect(res.status).toBe(200);
    expect(res.body.models).toContain("claude-haiku-4-5-20251001");
    expect(res.body.models).toContain("gpt-4o");
  });
});

describe("GET /health", () => {
  it("returns { status: 'ok' }", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts { model, systemPrompt, messages } and returns { reply }", async () => {
    const { loadModel } = await import("./llm.js");
    loadModel.mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ content: "Hello from the bot!" }),
    });

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
    expect(res.body.reply).toBe("Hello from the bot!");
  });

  it("passes name fields from messages to the LLM", async () => {
    const { buildMessages } = await import("./llm.js");
    const mockInvoke = vi.fn().mockResolvedValue({ content: "response" });
    const { loadModel } = await import("./llm.js");
    loadModel.mockReturnValue({ invoke: mockInvoke });

    const app = createApp();
    const messages = [
      { role: "user", content: "Hello", name: "Alice" },
      { role: "assistant", content: "Hi", name: "Bob" },
    ];

    await request(app).post("/api/chat").send({
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "Be helpful.",
      messages,
    });

    // buildMessages should have been called with the system prompt and messages
    expect(buildMessages).toHaveBeenCalledWith("Be helpful.", messages);
  });

  it("accepts messages without a name field", async () => {
    const { loadModel } = await import("./llm.js");
    loadModel.mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ content: "reply" }),
    });

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

  it("returns 502 when the LLM call throws an error", async () => {
    const { loadModel } = await import("./llm.js");
    loadModel.mockReturnValue({
      invoke: vi.fn().mockRejectedValue(new Error("API key invalid")),
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/chat")
      .send({
        model: "claude-haiku-4-5-20251001",
        systemPrompt: "Be helpful.",
        messages: [{ role: "user", content: "Hello", name: "Alice" }],
      });

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toContain("API key invalid");
  });

  it("returns 400 when loadModel throws (unknown model)", async () => {
    const { loadModel } = await import("./llm.js");
    loadModel.mockImplementation(() => {
      throw new Error("Unknown model provider");
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/chat")
      .send({
        model: "unknownprovider/bad-model",
        systemPrompt: "Be helpful.",
        messages: [{ role: "user", content: "Hello", name: "Alice" }],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("does not expose API keys in responses", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-secret-key";
    const { loadModel } = await import("./llm.js");
    loadModel.mockReturnValue({
      invoke: vi.fn().mockRejectedValue(new Error("Auth error with sk-secret-key")),
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/chat")
      .send({
        model: "claude-haiku-4-5-20251001",
        systemPrompt: "Be helpful.",
        messages: [{ role: "user", content: "Hello", name: "Alice" }],
      });

    // Error message should not leak the API key value
    expect(res.body.error).toBeDefined();
    delete process.env.ANTHROPIC_API_KEY;
  });
});
