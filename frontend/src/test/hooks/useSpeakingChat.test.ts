/**
 * Tests for useSpeakingChat hook.
 *
 * Strategy: the hook is tightly coupled to several async APIs (chatStream,
 * aiSpeakingApi, speakGerman, voiceRecorder, abilityApi). We vi.mock every
 * external module so tests can run synchronously in jsdom without network
 * requests. The focus is on observable state transitions, not internal
 * implementation details.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external modules ────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
}));

vi.mock("@/lib/aiSpeakingApi", () => ({
  aiSpeakingApi: {
    chat: vi.fn(),
    endSession: vi.fn().mockResolvedValue({}),
    transcribe: vi.fn(),
  },
  chatStream: vi.fn(),
  AI_SPEAKING_UNAUTHORIZED: "AI_SPEAKING_UNAUTHORIZED",
}));

vi.mock("@/lib/api", () => ({
  apiMessage: vi.fn(() => "Server error"),
  httpStatus: vi.fn(() => 500),
  default: {},
}));

vi.mock("@/lib/toastApiError", () => ({
  toastApiError: vi.fn(),
}));

vi.mock("@/lib/speechDe", () => ({
  speakGerman: vi.fn(),
}));

vi.mock("@/lib/voiceRecorder", () => ({
  startRecorder: vi.fn(),
}));

vi.mock("@/lib/abilityApi", () => ({
  recordAbilityScore: vi.fn(),
  scorePercentToItem: vi.fn(() => ({ score: 90 })),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { useSpeakingChat, mapResponseToBubble } from "@/hooks/useSpeakingChat";
import { chatStream } from "@/lib/aiSpeakingApi";
import type { AiSpeakingSession, AiChatResponse } from "@/lib/aiSpeakingApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AiSpeakingSession> = {}): AiSpeakingSession {
  return {
    id: 42,
    topic: "Arbeit",
    cefrLevel: "B1",
    persona: "LUKAS",
    responseSchema: "V2",
    sessionMode: "COMMUNICATION",
    status: "ACTIVE",
    startedAt: new Date().toISOString(),
    lastActivityAt: null,
    endedAt: null,
    messageCount: 0,
    ...overrides,
  };
}

function makeAiResponse(overrides: Partial<AiChatResponse> = {}): AiChatResponse {
  return {
    messageId: 1,
    sessionId: 42,
    aiSpeechDe: "Hallo!",
    correction: null,
    explanationVi: null,
    grammarPoint: null,
    learningStatus: { newWord: null, userInterestDetected: null },
    errors: [],
    ...overrides,
  };
}

function makeOpts(overrides: Partial<Parameters<typeof useSpeakingChat>[0]> = {}) {
  const inputText = { value: "" };
  const sessionState = { value: "chatting" as const };

  return {
    session: makeSession(),
    sessionState: sessionState.value,
    setSessionState: vi.fn(),
    inputText: inputText.value,
    setInputText: vi.fn(),
    t: (k: string) => k,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useSpeakingChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct initial state", () => {
    const { result } = renderHook(() => useSpeakingChat(makeOpts()));

    expect(result.current.realMessages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isSending).toBe(false);
    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.endingSession).toBe(false);
    expect(result.current.repairGate).toBeNull();
    expect(result.current.chatNotice).toBeNull();
  });

  it("handleSendMessage appends user bubble and placeholder, sets isSending=true", async () => {
    // chatStream returns an AbortController mock and never calls callbacks —
    // so isSending stays true while the stream is open, letting us assert the
    // intermediate state.
    const abortCtrl = new AbortController();
    vi.mocked(chatStream).mockReturnValue(abortCtrl);

    const opts = makeOpts({ inputText: "Ich lerne Deutsch" });
    const { result } = renderHook(() => useSpeakingChat(opts));

    await act(async () => {
      await result.current.handleSendMessage();
    });

    expect(result.current.isSending).toBe(true);
    expect(result.current.realMessages).toHaveLength(2);
    expect(result.current.realMessages[0].role).toBe("USER");
    expect(result.current.realMessages[0].userText).toBe("Ich lerne Deutsch");
    expect(result.current.realMessages[1].role).toBe("ASSISTANT");
    expect(result.current.realMessages[1].isStreaming).toBe(true);
  });

  it("handleSendMessage does nothing when session is null", async () => {
    const opts = makeOpts({ session: null, inputText: "test" });
    const { result } = renderHook(() => useSpeakingChat(opts));

    await act(async () => {
      await result.current.handleSendMessage();
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.realMessages).toHaveLength(0);
    expect(chatStream).not.toHaveBeenCalled();
  });

  it("handleSendMessage does nothing when inputText is empty", async () => {
    const opts = makeOpts({ inputText: "" });
    const { result } = renderHook(() => useSpeakingChat(opts));

    await act(async () => {
      await result.current.handleSendMessage();
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.realMessages).toHaveLength(0);
  });

  it("handleSendMessage blocks with forceRepairBanner when pendingAdaptiveRepairMsgId is set", async () => {
    // Simulate a repair gate being active by using seedInitialAssistant with
    // forceRepairBeforeContinue.
    const abortCtrl = new AbortController();
    vi.mocked(chatStream).mockReturnValue(abortCtrl);

    // First send to open the stream so we can trigger the done callback
    const opts = makeOpts({ inputText: "Ich lerne" });
    const { result } = renderHook(() => useSpeakingChat(opts));

    // Trigger repair gate via seedInitialAssistant
    await act(async () => {
      result.current.seedInitialAssistant(
        makeAiResponse({
          adaptive: {
            enabled: true,
            cefrEffective: "A2",
            difficultyKnob: 0,
            focusCodes: [],
            targetStructures: [],
            topicSuggestion: null,
            forceRepairBeforeContinue: true,
            primaryRepairErrorCode: "CASE_ERROR",
          },
          errors: [{ errorCode: "CASE_ERROR", severity: "HIGH", confidence: null, wrongSpan: null, correctedSpan: null, ruleViShort: null, exampleCorrectDe: null }],
        }),
      );
    });

    await act(async () => {
      await result.current.handleSendMessage("Ich teste");
    });

    expect(result.current.error).toBe("forceRepairBanner");
  });

  it("resetForNewSession clears messages and error state", async () => {
    const abortCtrl = new AbortController();
    vi.mocked(chatStream).mockReturnValue(abortCtrl);

    const opts = makeOpts({ inputText: "Test" });
    const { result } = renderHook(() => useSpeakingChat(opts));

    // Put some state in place
    await act(async () => {
      await result.current.handleSendMessage();
    });

    expect(result.current.realMessages.length).toBeGreaterThan(0);

    act(() => {
      result.current.resetForNewSession();
    });

    expect(result.current.realMessages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.chatNotice).toBeNull();
  });

  it("closeRepairGate clears the repairGate", async () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useSpeakingChat(opts));

    act(() => {
      result.current.seedInitialAssistant(
        makeAiResponse({
          adaptive: {
            enabled: true,
            cefrEffective: "A2",
            difficultyKnob: 0,
            focusCodes: [],
            targetStructures: [],
            topicSuggestion: null,
            forceRepairBeforeContinue: true,
            primaryRepairErrorCode: "CASE_ERROR",
          },
          errors: [{ errorCode: "CASE_ERROR", severity: "HIGH", confidence: null, wrongSpan: null, correctedSpan: null, ruleViShort: null, exampleCorrectDe: null }],
        }),
      );
    });

    expect(result.current.repairGate).not.toBeNull();

    act(() => {
      result.current.closeRepairGate();
    });

    expect(result.current.repairGate).toBeNull();
  });
});

// ─── Pure function tests ──────────────────────────────────────────────────────

describe("mapResponseToBubble", () => {
  it("maps AiChatResponse fields to AiMessageBubble correctly", () => {
    const response = makeAiResponse({
      messageId: 7,
      aiSpeechDe: "Wie geht es dir?",
      correction: "Good",
      explanationVi: "Explanation",
    });

    const bubble = mapResponseToBubble(response, false);

    expect(bubble.id).toBe(7);
    expect(bubble.role).toBe("ASSISTANT");
    expect(bubble.aiSpeechDe).toBe("Wie geht es dir?");
    expect(bubble.correction).toBe("Good");
    expect(bubble.explanationVi).toBe("Explanation");
    expect(bubble.isStreaming).toBe(false);
  });

  it("maps isStreaming=true when passed", () => {
    const bubble = mapResponseToBubble(makeAiResponse(), true);
    expect(bubble.isStreaming).toBe(true);
  });

  it("maps adaptive fields when present", () => {
    const response = makeAiResponse({
      adaptive: {
        enabled: true,
        cefrEffective: "B1",
        difficultyKnob: 2,
        focusCodes: ["CASE_ERROR"],
        targetStructures: ["Dativ"],
        topicSuggestion: "Arbeit",
        forceRepairBeforeContinue: false,
        primaryRepairErrorCode: null,
      },
    });

    const bubble = mapResponseToBubble(response);
    expect(bubble.adaptive?.cefrEffective).toBe("B1");
    expect(bubble.adaptive?.focusCodes).toContain("CASE_ERROR");
  });

  it("returns undefined for adaptive when adaptive is null", () => {
    const bubble = mapResponseToBubble(makeAiResponse({ adaptive: null }));
    expect(bubble.adaptive).toBeUndefined();
  });
});
