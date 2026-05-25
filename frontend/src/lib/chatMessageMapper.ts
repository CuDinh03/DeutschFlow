import type { ChatMessage } from "@/stores/useChatStore";
import type { AiMessageBubble } from "@/components/speaking/types";

/** Map chat store messages to SpeakingMessageBubble contract. */
export function chatMessageToBubble(msg: ChatMessage, index: number): AiMessageBubble {
  if (msg.role === "user") {
    return {
      id: index,
      role: "USER",
      userText: msg.contentDe,
      errors: msg.errors,
    };
  }

  const fb = msg.feedback;
  return {
    id: index,
    role: "ASSISTANT",
    aiSpeechDe: msg.contentDe,
    isStreaming: msg.isStreaming,
    correction: fb?.correction ?? null,
    explanationVi: fb?.explanationVi ?? null,
    grammarPoint: fb?.grammarPoint ?? null,
    errors: fb?.errors,
    suggestions: fb?.suggestions,
    action: fb?.action ?? null,
    status: fb?.status ?? null,
    feedback: fb?.feedbackText ?? null,
  };
}
