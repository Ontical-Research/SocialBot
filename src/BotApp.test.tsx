import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import BotApp from "./BotApp";

describe("BotApp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the bot settings panel on startup", () => {
    render(<BotApp />);
    expect(screen.getByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("renders all four login fields", () => {
    render(<BotApp />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/topic/i)).toBeDefined();
    expect(screen.getByLabelText(/model/i)).toBeDefined();
    expect(screen.getByLabelText(/prompt/i)).toBeDefined();
  });
});
