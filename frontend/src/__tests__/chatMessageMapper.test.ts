import { describe, it, expect } from "vitest";
import { chatMessageToBubble } from "@/lib/chatMessageMapper";
import type { ChatMessage } from "@/stores/useChatStore";

describe("chatMessageToBubble", () => {
  it("maps user message with errors", () => {
    const msg: ChatMessage = {
      id: "u1",
      role: "user",
      contentDe: "Ich habe gemacht",
      errors: [
        {
          errorCode: "GRAMMAR.AUX",
          severity: "MAJOR",
          wrongSpan: "habe gemacht",
          correctedSpan: "habe es gemacht",
          ruleViShort: "Thiếu tân ngữ",
          exampleCorrectDe: "Ich habe es gemacht.",
          confidence: 0.9,
        },
      ],
    };
    const bubble = chatMessageToBubble(msg, 0);
    expect(bubble.role).toBe("USER");
    expect(bubble.userText).toBe("Ich habe gemacht");
    expect(bubble.errors).toHaveLength(1);
  });

  it("maps assistant message with feedback", () => {
    const msg: ChatMessage = {
      id: "a1",
      role: "ai",
      contentDe: "Gut!",
      feedback: {
        errors: [],
        explanationVi: "Dịch",
        correction: null,
        grammarPoint: "Perfekt",
        action: "Frag nach dem Wetter",
        status: "EXCELLENT",
        feedbackText: "Sehr gut",
      },
    };
    const bubble = chatMessageToBubble(msg, 1);
    expect(bubble.role).toBe("ASSISTANT");
    expect(bubble.aiSpeechDe).toBe("Gut!");
    expect(bubble.explanationVi).toBe("Dịch");
    expect(bubble.action).toBe("Frag nach dem Wetter");
    expect(bubble.status).toBe("EXCELLENT");
    expect(bubble.feedback).toBe("Sehr gut");
  });
});
