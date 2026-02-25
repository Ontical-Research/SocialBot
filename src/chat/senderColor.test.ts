import { describe, it, expect } from "vitest";
import { senderColor, COLORS } from "./senderColor";

describe("senderColor", () => {
  it("returns the same color for the same name", () => {
    expect(senderColor("Alice")).toBe(senderColor("Alice"));
    expect(senderColor("Bob")).toBe(senderColor("Bob"));
    expect(senderColor("Carol")).toBe(senderColor("Carol"));
  });

  it("returns a valid Tailwind color class", () => {
    expect(COLORS).toContain(senderColor("Alice"));
    expect(COLORS).toContain(senderColor("Bob"));
    expect(COLORS).toContain(senderColor(""));
  });

  it("different names can return different colors", () => {
    const colors = new Set(
      ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Heidi"].map(senderColor),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("is consistent across multiple calls", () => {
    const name = "TestUser";
    const first = senderColor(name);
    for (let i = 0; i < 10; i++) {
      expect(senderColor(name)).toBe(first);
    }
  });
});
