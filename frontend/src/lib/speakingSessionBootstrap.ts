import type { AiSpeakingSession, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { useChatStore } from "@/stores/useChatStore";
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
