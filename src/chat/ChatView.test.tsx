import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function getInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/message/i);
}

/** Read the option values from the datalist associated with an input element. */
function datalistValues(input: HTMLInputElement): (string | null)[] {
  const listId = input.getAttribute("list") ?? "";
  const options = document.getElementById(listId)?.querySelectorAll("option");
  return Array.from(options ?? []).map((o) => o.getAttribute("value"));
}

/** Deliver a NATS message and wait for the given text to appear in the DOM. */
async function deliver(sender: string, text: string): Promise<void> {
  act(() => {
    trigger({ sender, text, timestamp: new Date().toISOString() });
  });
  await waitFor(() => {
    expect(screen.getByText(text)).toBeDefined();
  });
}

describe("ChatView", () => {
  const originalTitle = document.title;

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

  afterEach(() => {
    document.title = originalTitle;
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

  it("publishes message text when Send is clicked", () => {
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
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Echo message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    // Not visible yet — no echo
    expect(screen.queryByText("Echo message")).toBeNull();
    // Simulate the NATS server echoing the message back
    await deliver("Alice", "Echo message");
  });

  it("clears the input after sending", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = getInput();
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
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    await deliver("Bob", "Hi Alice!");
  });

  it("renders sender names in the message list", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    await deliver("Bob", "Hey there");
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("renders sender name with a color class", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    await deliver("Carol", "Color test");
    const senderEl = screen.getByText("Carol");
    // Should have one of the color classes
    expect(senderEl.className).toMatch(/text-\w+-400/);
  });

  it("disconnects on unmount", async () => {
    const { unmount } = render(<ChatView name="Alice" topic="chat" />);
    unmount();
    await waitFor(() => {
      expect(natsClient.disconnect).toHaveBeenCalled();
    });
  });

  // Visual polish tests (issue #23)

  it("sets document title to topic.name on mount", () => {
    render(<ChatView name="Alice" topic="chat.room" />);
    expect(document.title).toBe("chat.room.Alice");
  });

  it("restores document title on unmount", () => {
    document.title = "SocialBot";
    const { unmount } = render(<ChatView name="Alice" topic="chat.room" />);
    expect(document.title).toBe("chat.room.Alice");
    unmount();
    expect(document.title).toBe("SocialBot");
  });

  it("own messages (matching name) are aligned to the right", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    await deliver("Alice", "My own message");
    const bubble = screen.getByText("My own message").closest("[data-testid='message-bubble']");
    expect(bubble).toBeDefined();
    expect(bubble?.getAttribute("data-sender")).toBe("self");
  });

  it("other messages are aligned to the left", async () => {
    render(<ChatView name="Alice" topic="chat" />);
    await waitFor(() => {
      expect(natsClient.connect).toHaveBeenCalled();
    });
    await deliver("Bob", "Bob's message");
    const bubble = screen.getByText("Bob's message").closest("[data-testid='message-bubble']");
    expect(bubble).toBeDefined();
    expect(bubble?.getAttribute("data-sender")).toBe("other");
  });

  it("message input has a datalist for past sent messages", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = getInput();
    const listId = input.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId ?? "");
    expect(datalist).toBeDefined();
    expect(datalist?.tagName).toBe("DATALIST");
  });

  it("sent messages appear in the past messages datalist", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "First message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(datalistValues(input)).toContain("First message");
  });

  it("deduplicates messages in the past messages datalist", () => {
    render(<ChatView name="Alice" topic="chat" />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(datalistValues(input).filter((v) => v === "Hello").length).toBe(1);
  });
});
