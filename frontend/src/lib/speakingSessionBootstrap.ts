import type { AiSpeakingSession, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { useChatStore, type ChatMessage } from "@/stores/useChatStore";
import type { AiCompanion } from "@/types/ai-speaking";

export interface SpeakingSessionBootstrap {
  session: AiSpeakingSession;
  companion: AiCompanion;
  sessionMode: SpeakingSessionMode;
  /** Topic shown by the engine (empty state + sidebar). */
  topic: string | null;
  /** INTERVIEW only (it paces the suggestion timer); pass null for the other modes. */
  experienceLevel?: string | null;
}

/**
 * Load a freshly created session into useChatStore exactly the way the conversation engine
 * expects it: companion → response schema → adaptive/repair gate → the AI greeting message.
 *
 * Centralised because the engine has TWO entry points — the companion picker and the class
 * SPEAKING_SCENARIO assignment. The second one used to set only `sessionId`, so the engine
 * found no `selectedCompanion`, bounced back to the picker and dropped the created session.
 */
export function loadSpeakingSessionIntoStore({
  session,
  companion,
  sessionMode,
  topic,
  experienceLevel = null,
}: SpeakingSessionBootstrap): void {
  const store = useChatStore.getState();

  // clearChat() deliberately keeps `returnPath` (see useChatStore) so the exit target set by
  // the calling surface survives session setup / restart.
  store.clearChat();
  store.setSessionId(session.id);
  store.setResponseSchema(session.responseSchema === "V2" ? "V2" : "V1");
  store.setSelectedCompanion(companion);
  store.setSessionMode(sessionMode);
  store.setSessionTopic(topic);
  store.setExperienceLevel(experienceLevel);

  const init = session.initialAiMessage;
  if (!init) return;

  const adaptive = init.adaptive;
  if (adaptive) {
    store.setAdaptiveMeta(adaptive);
    if (adaptive.forceRepairBeforeContinue && adaptive.primaryRepairErrorCode) {
      const err = init.errors?.find((e) => e.errorCode === adaptive.primaryRepairErrorCode);
      store.setPendingRepairGate({
        code: adaptive.primaryRepairErrorCode,
        exampleCorrectDe: err?.exampleCorrectDe ?? undefined,
        ruleViShort: err?.ruleViShort ?? undefined,
      });
    }
  }

  if (init.interviewPhaseKey || init.interviewHintKey) {
    store.setInterviewUiHints(init.interviewPhaseKey ?? null, init.interviewHintKey ?? null);
  }

  store.addMessage({
    id: String(init.messageId || Date.now()),
    role: "ai",
    contentDe: init.aiSpeechDe,
    feedback: {
      errors: init.errors || [],
      explanationVi: init.explanationVi || "",
      suggestions: init.suggestions || [],
      correction: init.correction || null,
      grammarPoint: init.grammarPoint || null,
      action: init.action || null,
      status: init.status ?? null,
      feedbackText: init.feedback ?? null,
    },
  });
}

export interface SpeakingSessionResume {
  /**
   * Chỉ nhận id + schema chứ không nhận cả `AiSpeakingSession`: màn danh sách phỏng vấn đã có sẵn
   * đủ trường từ lượt `GET /ai-speaking/sessions` đầu tiên, nên đòi cả object chỉ ép nó gọi thêm
   * một request nữa cho dữ liệu nó đang cầm trong tay.
   */
  sessionId: number;
  responseSchema: string | null | undefined;
  companion: AiCompanion;
  sessionMode: SpeakingSessionMode;
  topic: string | null;
  experienceLevel?: string | null;
  /** Lịch sử đã dựng lại — xem `lib/speaking/resumeSession`. */
  messages: ChatMessage[];
}

/**
 * Nạp một phiên ĐANG DỞ vào store rồi trả quyền cho engine (S-06 AC-2, nửa UI).
 *
 * Khác `loadSpeakingSessionIntoStore` đúng một điểm nhưng là điểm cốt lõi: phiên mới thì nạp lời
 * chào `initialAiMessage`, phiên dở thì nạp **toàn bộ lịch sử đã có**. Backend đã ghi từng lượt
 * ngay khi nó hoàn tất (`InterviewDomainCoordinator.onTurnCompleted → saveTurn`, REQUIRES_NEW —
 * verify ở B-13/B-15), nên dữ liệu vẫn nguyên; thứ thiếu từ trước tới nay chỉ là đường quay lại.
 */
export function resumeSpeakingSessionIntoStore({
  sessionId,
  responseSchema,
  companion,
  sessionMode,
  topic,
  experienceLevel = null,
  messages,
}: SpeakingSessionResume): void {
  const store = useChatStore.getState();

  store.clearChat();
  store.setSessionId(sessionId);
  store.setResponseSchema(responseSchema === "V2" ? "V2" : "V1");
  store.setSelectedCompanion(companion);
  store.setSessionMode(sessionMode);
  store.setSessionTopic(topic);
  store.setExperienceLevel(experienceLevel);
  store.setMessages(messages);
}
