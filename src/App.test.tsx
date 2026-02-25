import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the SocialBot heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /socialbot/i })).toBeDefined();
  });

  it("renders a subtitle", () => {
    render(<App />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });
});
