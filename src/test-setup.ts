/**
 * Vitest global setup file.
 *
 * Node.js 22+ exposes a built-in ``localStorage`` (backed by a file) that conflicts
 * with jsdom/happy-dom's in-memory implementation. We replace it with a simple
 * in-memory ``Storage`` shim before each test so that ``localStorage.clear()``,
 * ``setItem()``, ``getItem()``, and ``removeItem()`` work as expected.
 *
 * Also stubs ``window.matchMedia`` with a default (prefers light) implementation
 * since jsdom does not provide one.
 */
import { beforeEach, vi } from "vitest";

function createInMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      const entries = Object.entries(store).filter(([k]) => k !== key);
      store = Object.fromEntries(entries);
    },
    clear(): void {
      store = {};
    },
  };
}

beforeEach(() => {
  const storage = createInMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });

  // jsdom does not implement matchMedia. Provide a default stub (prefers light)
  // that can be overridden per-test with vi.stubGlobal("matchMedia", ...).
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
