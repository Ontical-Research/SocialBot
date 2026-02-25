import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatView from "./ChatView";
import type { MessageCallback } from "../nats/client";

// Mock the entire NATS client module
vi.mock("../nats/client", () => {
  let _callback: MessageCallback | null = null;
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((cb: MessageCallback) => {
      _callback = cb;
    }),
    // Expose for tests to trigger incoming messages
    __trigger: (msg: Parameters<MessageCallback>[0]) => _callback?.(msg),
  };
});

import * as natsClient from "../nats/client";
const trigger = (
  natsClient as unknown as { __trigger: (msg: Parameters<MessageCallback>[0]) => void }
).__trigger;

describe("ChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a message input and send button", () => {
    render(<ChatView name="Alice" topic="chat" />);
    expect(screen.getByPlaceholderText(/message/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /send/i })).toBeDefined();
  });

  it("connects to NATS on mount", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalledWith("ws://localhost:9222", "chat", "Alice");
    });
  });

  it("publishes message text when Send is clicked", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(natsClient.publish).toHaveBeenCalledWith("Hello world");
  });

  it("shows own message immediately after sending (optimistic)", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Optimistic message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.getByText("Optimistic message")).toBeDefined();
  });

  it("clears the input after sending", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(input.value).toBe("");
  });

  it("submits on Enter key", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Enter message" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(natsClient.publish).toHaveBeenCalledWith("Enter message");
  });

  it("displays incoming messages from NATS", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.onMessage).toHaveBeenCalled());
    trigger({ sender: "Bob", text: "Hi Alice!", timestamp: new Date().toISOString() });
    await waitFor(() => {
      expect(screen.getByText("Hi Alice!")).toBeDefined();
    });
  });

  it("renders sender names in the message list", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.onMessage).toHaveBeenCalled());
    trigger({ sender: "Bob", text: "Hey there", timestamp: new Date().toISOString() });
    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeDefined();
    });
  });

  it("renders sender name with a color class", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.onMessage).toHaveBeenCalled());
    trigger({ sender: "Carol", text: "Color test", timestamp: new Date().toISOString() });
    await waitFor(() => {
      const senderEl = screen.getByText("Carol");
      // Should have one of the color classes
      expect(senderEl.className).toMatch(/text-\w+-400/);
    });
  });

  it("disconnects on unmount", async () => {
    const { unmount } = render(<ChatView name="Alice" topic="chat" />);
    unmount();
    await waitFor(() => {
      expect(natsClient.disconnect).toHaveBeenCalled();
    });
  });
});
