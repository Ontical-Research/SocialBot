import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatView from "./ChatView";
import type { MessageCallback } from "../nats/client";

// Captured callback — updated each time connect() is called
let capturedCallback: MessageCallback | null = null;

// Mock the entire NATS client module
vi.mock("../nats/client", () => ({
  connect: vi.fn((_url: string, _topic: string, _name: string, onMessage: MessageCallback) => {
    capturedCallback = onMessage;
    return Promise.resolve();
  }),
  publish: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
}));

import * as natsClient from "../nats/client";

/** Trigger an incoming message via the captured callback. */
function trigger(msg: Parameters<MessageCallback>[0]): void {
  capturedCallback?.(msg);
}

describe("ChatView", () => {
  beforeEach(() => {
    capturedCallback = null;
    vi.mocked(natsClient.connect).mockImplementation(
      (_url: string, _topic: string, _name: string, onMessage: MessageCallback) => {
        capturedCallback = onMessage;
        return Promise.resolve();
      },
    );
    vi.mocked(natsClient.disconnect).mockResolvedValue(undefined);
    vi.mocked(natsClient.publish).mockReturnValue(undefined);
  });

  it("renders a message input and send button", () => {
    render(<ChatView name="Alice" topic="chat" />);
    expect(screen.getByPlaceholderText(/message/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /send/i })).toBeDefined();
  });

  it("connects to NATS on mount with callback as fourth argument", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalledWith(
        "ws://localhost:9222",
        "chat",
        "Alice",
        expect.any(Function),
      );
    });
  });

  it("publishes message text when Send is clicked", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(natsClient.publish).toHaveBeenCalledWith("Hello world");
  });

  it("does not show own message immediately after sending (no optimistic append)", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "My message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    // The message must NOT appear until the NATS echo arrives
    expect(screen.queryByText("My message")).toBeNull();
  });

  it("shows own message only after the NATS echo arrives", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.connect).toHaveBeenCalled());
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Echo message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    // Not visible yet — no echo
    expect(screen.queryByText("Echo message")).toBeNull();
    // Simulate the NATS server echoing the message back
    act(() => {
      trigger({ sender: "Alice", text: "Echo message", timestamp: new Date().toISOString() });
    });
    await waitFor(() => {
      expect(screen.getByText("Echo message")).toBeDefined();
    });
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
    await waitFor(() => expect(natsClient.connect).toHaveBeenCalled());
    act(() => {
      trigger({ sender: "Bob", text: "Hi Alice!", timestamp: new Date().toISOString() });
    });
    await waitFor(() => {
      expect(screen.getByText("Hi Alice!")).toBeDefined();
    });
  });

  it("renders sender names in the message list", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.connect).toHaveBeenCalled());
    act(() => {
      trigger({ sender: "Bob", text: "Hey there", timestamp: new Date().toISOString() });
    });
    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeDefined();
    });
  });

  it("renders sender name with a color class", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => expect(natsClient.connect).toHaveBeenCalled());
    act(() => {
      trigger({ sender: "Carol", text: "Color test", timestamp: new Date().toISOString() });
    });
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
