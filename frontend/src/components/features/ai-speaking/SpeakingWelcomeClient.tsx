"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/speaking/WelcomeScreen";
import { useChatStore } from "@/stores/useChatStore";
import { aiSpeakingApi, SpeakingPersonaId, SpeakingResponseSchemaId, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { AiCompanion } from "@/types/ai-speaking";
import { PERSONA_TOKENS, PersonaId } from "@/lib/personas";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { httpStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toastApiError";
import { useAiSpeakingQuota } from "@/hooks/useAiSpeakingQuota";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";

export function SpeakingWelcomeClient() {
  const router = useRouter();
  const t = useTranslations("speaking");
  const { quotaBlocked, quotaLoading } = useAiSpeakingQuota();
  const [isStarting, setIsStarting] = useState(false);
  const {
    setSessionId,
    setSelectedCompanion,
    setResponseSchema,
    setSessionTopic,
    setAdaptiveMeta,
    setPendingRepairGate,
    clearChat,
    addMessage,
    setInterviewUiHints,
  } = useChatStore();
  const { me, targetLevel, practiceFloorLevel } = useStudentPracticeSession({ requireStudent: false });

  const handleStart = async (
    topic?: string,
    cefrLevel?: string,
    persona?: SpeakingPersonaId,
    responseSchema?: SpeakingResponseSchemaId,
    sessionMode?: SpeakingSessionMode
  ) => {
    if (quotaBlocked) {
      toast.error(t("errorQuota"));
      return;
    }
    setIsStarting(true);
    try {
      // 1. Call Backend to create session
      const res = await aiSpeakingApi.createSession(
        topic,
        cefrLevel,
        persona,
        responseSchema,
        sessionMode
      );
      
      const session = res.data;

      // 2. Setup Companion Data for Frontend Store
      const pId = (persona || "LUKAS").toLowerCase() as PersonaId;
      const token = PERSONA_TOKENS[pId] || PERSONA_TOKENS.lukas;
      
      const companion: AiCompanion = {
        id: token.id,
        name: token.name,
        avatarUrl: `/companions/${token.id}.png`,
        voiceId: token.id.toUpperCase(), // ElevenLabs persona key (LUKAS, EMMA, ANNA, KLAUS)
        voiceFile: token.voiceFile ?? null, // Local file fallback
        personality: token.desc,
        cefrLevel: cefrLevel || "A1",
      };

      // 3. Clear old chat, save session & companion
      clearChat();
      setSessionId(session.id);
      setResponseSchema(
        (session.responseSchema === "V2" ? "V2" : "V1") as SpeakingResponseSchemaId
      );
      setSelectedCompanion(companion);
      setSessionTopic(topic?.trim() || session.topic || null);
      if (session.initialAiMessage?.adaptive) {
        setAdaptiveMeta(session.initialAiMessage.adaptive);
        const a = session.initialAiMessage.adaptive;
        if (a.forceRepairBeforeContinue && a.primaryRepairErrorCode) {
          const err = session.initialAiMessage.errors?.find(
            (e) => e.errorCode === a.primaryRepairErrorCode
          );
          setPendingRepairGate({
            code: a.primaryRepairErrorCode,
            exampleCorrectDe: err?.exampleCorrectDe ?? undefined,
            ruleViShort: err?.ruleViShort ?? undefined,
          });
        }
      }

      // 4. If backend returned an initial AI message, push it to history
      if (session.initialAiMessage) {
        const init = session.initialAiMessage;
        if (init.interviewPhaseKey || init.interviewHintKey) {
          setInterviewUiHints(init.interviewPhaseKey ?? null, init.interviewHintKey ?? null);
        }
        addMessage({
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

      // 5. Navigate to Chat UI
      router.push("/speaking/chat");
    } catch (error) {
      console.error("Failed to create session", error);
      if (httpStatus(error) === 429) {
        toastApiError(error, { quotaMessage: t("errorQuota") });
      } else {
        toast.error(t("errorStart"));
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <WelcomeScreen
      onStart={handleStart}
      isStarting={isStarting}
      quotaBlocked={quotaBlocked}
      quotaLoading={quotaLoading}
      planCurrentLevel={practiceFloorLevel}
      planTargetLevel={targetLevel}
      industry={me?.industry}
    />
  );
}
