import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAutoTtsEnabled, setAutoTtsEnabled } from "@/lib/speakingPreferences";

describe("speakingPreferences", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  it("defaults auto TTS to enabled", () => {
    expect(getAutoTtsEnabled()).toBe(true);
  });

  it("persists auto TTS preference", () => {
    setAutoTtsEnabled(false);
    expect(getAutoTtsEnabled()).toBe(false);
    setAutoTtsEnabled(true);
    expect(getAutoTtsEnabled()).toBe(true);
  });
});
