/**
 * Tests for useSpeech hook.
 *
 * The hook wraps the browser Web Speech API (SpeechSynthesis + SpeechRecognition)
 * and an Audio element. We stub `window.speechSynthesis` via vi.stubGlobal and
 * intercept Audio construction with a mock class.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock authSession (imported by hook) ─────────────────────────────────────

vi.mock("@/lib/authSession", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

// ─── Import hook ──────────────────────────────────────────────────────────────

import { useSpeech } from "@/hooks/useSpeech";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal SpeechSynthesis mock. */
function makeSpeechSynthesisMock() {
  const utterances: SpeechSynthesisUtterance[] = [];
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  const mock = {
    speaking: false,
    cancel: vi.fn(() => {
      if (currentUtterance) {
        currentUtterance = null;
      }
      mock.speaking = false;
    }),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      utterances.push(utterance);
      currentUtterance = utterance;
      mock.speaking = true;
      // Simulate async onstart
      setTimeout(() => utterance.onstart?.(new Event("start") as SpeechSynthesisEvent), 0);
    }),
    getVoices: vi.fn(() => []),
    pause: vi.fn(),
    resume: vi.fn(),
    pending: false,
    paused: false,
    onvoiceschanged: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    _utterances: utterances,
    _simulateEnd: () => {
      if (currentUtterance) {
        mock.speaking = false;
        currentUtterance.onend?.(new Event("end") as SpeechSynthesisEvent);
        currentUtterance = null;
      }
    },
  };
  return mock;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useSpeech — initial state", () => {
  let synthMock: ReturnType<typeof makeSpeechSynthesisMock>;

  beforeEach(() => {
    synthMock = makeSpeechSynthesisMock();
    vi.stubGlobal("speechSynthesis", synthMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with isSpeaking=false and isListening=false", () => {
    const { result } = renderHook(() => useSpeech());

    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isListening).toBe(false);
  });

  it("exposes speak and stopSpeaking functions", () => {
    const { result } = renderHook(() => useSpeech());

    expect(typeof result.current.speak).toBe("function");
    expect(typeof result.current.stopSpeaking).toBe("function");
  });
});

describe("useSpeech — speak()", () => {
  let synthMock: ReturnType<typeof makeSpeechSynthesisMock>;

  beforeEach(() => {
    synthMock = makeSpeechSynthesisMock();
    vi.stubGlobal("speechSynthesis", synthMock);
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      lang = "";
      rate = 1;
      voice = null;
      onstart: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor(public text: string) {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls speechSynthesis.speak() with the provided text", async () => {
    const { result } = renderHook(() => useSpeech({ lang: "de-DE" }));

    act(() => {
      result.current.speak("Guten Morgen");
    });

    expect(synthMock.speak).toHaveBeenCalledOnce();
    const utterance = synthMock._utterances[0];
    expect(utterance.text).toBe("Guten Morgen");
  });

  it("sets isSpeaking=true after onstart fires", async () => {
    const { result } = renderHook(() => useSpeech());

    act(() => {
      result.current.speak("Test");
    });

    // Flush the setTimeout(onstart) in makeSpeechSynthesisMock
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.isSpeaking).toBe(true);
  });

  it("calls the onEnd callback when utterance ends", async () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useSpeech());

    act(() => {
      result.current.speak("Tschüss", onEnd);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
      synthMock._simulateEnd();
    });

    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("resets isSpeaking=false after speech ends", async () => {
    const { result } = renderHook(() => useSpeech());

    act(() => {
      result.current.speak("Auf Wiedersehen");
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
      synthMock._simulateEnd();
    });

    expect(result.current.isSpeaking).toBe(false);
  });
});

describe("useSpeech — stopSpeaking()", () => {
  let synthMock: ReturnType<typeof makeSpeechSynthesisMock>;

  beforeEach(() => {
    synthMock = makeSpeechSynthesisMock();
    vi.stubGlobal("speechSynthesis", synthMock);
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      lang = "";
      rate = 1;
      voice = null;
      onstart: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor(public text: string) {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls speechSynthesis.cancel()", () => {
    const { result } = renderHook(() => useSpeech());

    act(() => {
      result.current.speak("Danke");
      result.current.stopSpeaking();
    });

    expect(synthMock.cancel).toHaveBeenCalled();
  });

  it("sets isSpeaking=false immediately after stopSpeaking()", async () => {
    const { result } = renderHook(() => useSpeech());

    act(() => {
      result.current.speak("Bitte");
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.isSpeaking).toBe(true);

    act(() => {
      result.current.stopSpeaking();
    });

    expect(result.current.isSpeaking).toBe(false);
  });

  it("stopSpeaking() is safe to call when not speaking", () => {
    const { result } = renderHook(() => useSpeech());

    expect(() => {
      act(() => {
        result.current.stopSpeaking();
      });
    }).not.toThrow();

    expect(result.current.isSpeaking).toBe(false);
  });
});
