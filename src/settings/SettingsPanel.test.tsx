import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";

const mockConfig = { name: "Alice", topic: "chat.room1", natsUrl: "ws://custom:9222" };

function makeFetchMock(config = mockConfig) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(config),
  });
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", makeFetchMock());
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders a name input field", async () => {
    render(<SettingsPanel onConnect={() => {}} />);
    expect(await screen.findByLabelText(/name/i)).toBeDefined();
  });

  it("renders a topic input field", async () => {
    render(<SettingsPanel onConnect={() => {}} />);
    expect(await screen.findByLabelText(/topic/i)).toBeDefined();
  });

  it("renders a Connect button", async () => {
    render(<SettingsPanel onConnect={() => {}} />);
    expect(await screen.findByRole("button", { name: /connect/i })).toBeDefined();
  });

  it("pre-fills name and topic from config.json", async () => {
    render(<SettingsPanel onConnect={() => {}} />);

    const nameInput = await screen.findByLabelText(/name/i);
    const topicInput = await screen.findByLabelText(/topic/i);

    await waitFor(() => {
      expect((nameInput as HTMLInputElement).value).toBe("Alice");
      expect((topicInput as HTMLInputElement).value).toBe("chat.room1");
    });
  });

  it("calls onConnect with current name, topic, and natsUrl when Connect is clicked", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();

    render(<SettingsPanel onConnect={onConnect} />);

    // Wait for the form to be populated from config
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Alice");
    });

    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledWith({
      name: "Alice",
      topic: "chat.room1",
      natsUrl: "ws://custom:9222",
    });
  });

  it("allows changing name before connecting", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();

    render(<SettingsPanel onConnect={onConnect} />);

    const nameInput = await screen.findByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Bob");

    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledWith({
      name: "Bob",
      topic: "chat.room1",
      natsUrl: "ws://custom:9222",
    });
  });

  it("saves name+topic+natsUrl to localStorage history on connect", async () => {
    const user = userEvent.setup();

    render(<SettingsPanel onConnect={() => {}} />);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Alice");
    });

    await user.click(screen.getByRole("button", { name: /connect/i }));

    const stored = JSON.parse(localStorage.getItem("socialbot:history") ?? "[]");
    expect(stored).toEqual([{ name: "Alice", topic: "chat.room1", natsUrl: "ws://custom:9222" }]);
  });

  it("shows history options from localStorage in the name datalist", async () => {
    localStorage.setItem(
      "socialbot:history",
      JSON.stringify([
        { name: "Bob", topic: "chat.room2", natsUrl: "ws://localhost:9222" },
        { name: "Alice", topic: "chat.room1", natsUrl: "ws://localhost:9222" },
      ]),
    );

    render(<SettingsPanel onConnect={() => {}} />);

    await waitFor(() => {
      const options = document.querySelectorAll("#name-history option");
      const values = Array.from(options).map((o) => o.getAttribute("value"));
      expect(values).toContain("Bob");
      expect(values).toContain("Alice");
    });
  });

  it("falls back to ws://localhost:9222 when config.json omits natsUrl", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ name: "Alice", topic: "chat.room1" } as typeof mockConfig));
    const onConnect = vi.fn();
    const user = userEvent.setup();

    render(<SettingsPanel onConnect={onConnect} />);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Alice");
    });

    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(onConnect).toHaveBeenCalledWith({
      name: "Alice",
      topic: "chat.room1",
      natsUrl: "ws://localhost:9222",
    });
  });
});
