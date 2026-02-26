// @vitest-environment node
/**
 * Tests for LLM model loading and message building helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMessages } from "./llm.js";

describe("buildMessages", () => {
  it("prepends system prompt as a SystemMessage", () => {
    const msgs = buildMessages("Be helpful.", []);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]._getType()).toBe("system");
    expect(msgs[0].content).toBe("Be helpful.");
  });

  it("converts user role messages to HumanMessage", () => {
    const msgs = buildMessages("Be helpful.", [{ role: "user", content: "Hello" }]);
    const human = msgs[1];
    expect(human._getType()).toBe("human");
    expect(human.content).toBe("Hello");
  });

  it("converts assistant role messages to AIMessage", () => {
    const msgs = buildMessages("Be helpful.", [{ role: "assistant", content: "Hi!" }]);
    const ai = msgs[1];
    expect(ai._getType()).toBe("ai");
    expect(ai.content).toBe("Hi!");
  });

  it("passes name field through to HumanMessage", () => {
    const msgs = buildMessages("Be helpful.", [{ role: "user", content: "Hello", name: "Alice" }]);
    expect(msgs[1].name).toBe("Alice");
  });

  it("passes name field through to AIMessage", () => {
    const msgs = buildMessages("Be helpful.", [{ role: "assistant", content: "Hi!", name: "Bob" }]);
    expect(msgs[1].name).toBe("Bob");
  });

  it("handles messages without a name field", () => {
    const msgs = buildMessages("Be helpful.", [{ role: "user", content: "Hello" }]);
    // name should be undefined or absent — not throw
    expect(msgs[1].content).toBe("Hello");
  });

  it("builds a multi-turn conversation with names", () => {
    const msgs = buildMessages("You are a bot.", [
      { role: "user", content: "Hi", name: "Alice" },
      { role: "assistant", content: "Hello!", name: "Bot" },
      { role: "user", content: "How are you?", name: "Alice" },
    ]);
    expect(msgs).toHaveLength(4); // system + 3 messages
    expect(msgs[1].name).toBe("Alice");
    expect(msgs[2].name).toBe("Bot");
    expect(msgs[3].name).toBe("Alice");
  });
});

describe("loadModel", () => {
  it("returns a ChatAnthropic for anthropic/ prefix", async () => {
    const { loadModel } = await import("./llm.js");
    const model = loadModel("claude-haiku-4-5-20251001");
    // Just check it has the invoke method (duck-typed LangChain model)
    expect(typeof model.invoke).toBe("function");
  });

  it("throws for unknown model prefix", async () => {
    const { loadModel } = await import("./llm.js");
    expect(() => loadModel("unknownprovider/some-model")).toThrow();
  });
});
