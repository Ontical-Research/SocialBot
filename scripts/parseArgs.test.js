import { describe, it, expect } from "vitest";
import { parseArgs } from "./parseArgs.js";

describe("parseArgs", () => {
  it("returns defaults when no arguments are provided", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ name: "User", topic: "chat", natsUrl: "ws://localhost:9222" });
  });

  it("parses --name flag with a space-separated value", () => {
    const result = parseArgs(["--name", "Alice"]);
    expect(result.name).toBe("Alice");
    expect(result.topic).toBe("chat");
  });

  it("parses --topic flag with a space-separated value", () => {
    const result = parseArgs(["--topic", "chat.room1"]);
    expect(result.name).toBe("User");
    expect(result.topic).toBe("chat.room1");
  });

  it("parses both --name and --topic flags", () => {
    const result = parseArgs(["--name", "Bob", "--topic", "demo"]);
    expect(result).toEqual({ name: "Bob", topic: "demo", natsUrl: "ws://localhost:9222" });
  });

  it("parses --name=value syntax", () => {
    const result = parseArgs(["--name=Charlie"]);
    expect(result.name).toBe("Charlie");
  });

  it("parses --topic=value syntax", () => {
    const result = parseArgs(["--topic=sports"]);
    expect(result.topic).toBe("sports");
  });

  it("parses mixed flag styles", () => {
    const result = parseArgs(["--name=Dave", "--topic", "news"]);
    expect(result).toEqual({ name: "Dave", topic: "news", natsUrl: "ws://localhost:9222" });
  });

  it("ignores unknown flags", () => {
    const result = parseArgs(["--unknown", "value", "--name", "Eve"]);
    expect(result.name).toBe("Eve");
    expect(result.topic).toBe("chat");
  });

  it("accepts custom defaults", () => {
    const result = parseArgs([], { name: "DefaultUser", topic: "general", natsUrl: "ws://custom:4222" });
    expect(result).toEqual({ name: "DefaultUser", topic: "general", natsUrl: "ws://custom:4222" });
  });

  it("CLI args override custom defaults", () => {
    const result = parseArgs(["--name", "Override"], { name: "DefaultUser", topic: "general" });
    expect(result.name).toBe("Override");
    expect(result.topic).toBe("general");
  });

  it("returns default natsUrl when --nats-url is not provided", () => {
    const result = parseArgs([]);
    expect(result.natsUrl).toBe("ws://localhost:9222");
  });

  it("parses --nats-url flag with a space-separated value", () => {
    const result = parseArgs(["--nats-url", "ws://myserver:4222"]);
    expect(result.natsUrl).toBe("ws://myserver:4222");
  });

  it("parses --nats-url=value syntax", () => {
    const result = parseArgs(["--nats-url=ws://myserver:4222"]);
    expect(result.natsUrl).toBe("ws://myserver:4222");
  });
});
