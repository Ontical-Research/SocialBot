import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ChatView from "./ChatView";
import type { NatsClient, MessageCallback } from "../nats/NatsClient";

// ---------------------------------------------------------------------------
// Mock NatsClient instance factory
// ---------------------------------------------------------------------------

let capturedCallback: MessageCallback | null = null;
let mockConnect: ReturnType<typeof vi.fn>;
let mockPublish: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;

function makeMockClient(): NatsClient {
  mockConnect = vi.fn((_url: string, _topic: string, _name: string, onMessage: MessageCallback) => {
    capturedCallback = onMessage;
    return Promise.resolve();
  });
  mockPublish = vi.fn();
  mockDisconnect = vi.fn().mockResolvedValue(undefined);
  return {
    connect: mockConnect,
    publish: mockPublish,
    disconnect: mockDisconnect,
  } as unknown as NatsClient;
}

let mockClient: NatsClient;

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
    mockClient = makeMockClient();
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it("renders a message input and send button", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    expect(screen.getByPlaceholderText(/message/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /send/i })).toBeDefined();
  });

  it("connects to NATS on mount with callback as fourth argument", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith(
        "ws://localhost:9222",
        "chat",
        "Alice",
        expect.any(Function),
      );
    });
  });

  it("publishes message text when Send is clicked", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(mockPublish).toHaveBeenCalledWith("Hello world");
  });

  it("does not show own message immediately after sending (no optimistic append)", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "My message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.queryByText("My message")).toBeNull();
  });

  it("shows own message only after the NATS echo arrives", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Echo message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.queryByText("Echo message")).toBeNull();
    await deliver("Alice", "Echo message");
  });

  it("clears the input after sending", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(input.value).toBe("");
  });

  it("submits on Enter key", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = screen.getByPlaceholderText(/message/i);
    fireEvent.change(input, { target: { value: "Enter message" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(mockPublish).toHaveBeenCalledWith("Enter message");
  });

  it("displays incoming messages from NATS", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    await deliver("Bob", "Hi Alice!");
  });

  it("renders sender names in the message list", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    await deliver("Bob", "Hey there");
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("renders sender name with a color class", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    await deliver("Carol", "Color test");
    const senderEl = screen.getByText("Carol");
    expect(senderEl.className).toMatch(/text-\w+-400/);
  });

  it("disconnects on unmount", async () => {
    const { unmount } = render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    unmount();
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  it("sets document title to topic.name on mount", () => {
    render(<ChatView name="Alice" topic="chat.room" client={mockClient} />);
    expect(document.title).toBe("chat.room.Alice");
  });

  it("restores document title on unmount", () => {
    document.title = "SocialBot";
    const { unmount } = render(<ChatView name="Alice" topic="chat.room" client={mockClient} />);
    expect(document.title).toBe("chat.room.Alice");
    unmount();
    expect(document.title).toBe("SocialBot");
  });

  it("own messages (matching name) are aligned to the right", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    await deliver("Alice", "My own message");
    const bubble = screen.getByText("My own message").closest("[data-testid='message-bubble']");
    expect(bubble).toBeDefined();
    expect(bubble?.getAttribute("data-sender")).toBe("self");
  });

  it("other messages are aligned to the left", async () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
    await deliver("Bob", "Bob's message");
    const bubble = screen.getByText("Bob's message").closest("[data-testid='message-bubble']");
    expect(bubble).toBeDefined();
    expect(bubble?.getAttribute("data-sender")).toBe("other");
  });

  it("message input has a datalist for past sent messages", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = getInput();
    const listId = input.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId ?? "");
    expect(datalist).toBeDefined();
    expect(datalist?.tagName).toBe("DATALIST");
  });

  it("sent messages appear in the past messages datalist", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "First message" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(datalistValues(input)).toContain("First message");
  });

  it("deduplicates messages in the past messages datalist", () => {
    render(<ChatView name="Alice" topic="chat" client={mockClient} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(datalistValues(input).filter((v) => v === "Hello").length).toBe(1);
  });
});
