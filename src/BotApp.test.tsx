import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BotApp from "./BotApp";

describe("BotApp", () => {
  it("renders a bot mode placeholder", () => {
    render(<BotApp />);
    expect(screen.getByText(/bot mode/i)).toBeDefined();
  });
});
