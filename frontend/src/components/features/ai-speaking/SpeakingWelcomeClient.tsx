"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeScreen } from "@/components/speaking/WelcomeScreen";
import { useChatStore } from "@/store/useChatStore";
import { aiSpeakingApi, SpeakingPersonaId, SpeakingResponseSchemaId, SpeakingSessionMode } from "@/lib/aiSpeakingApi";
import { AiCompanion } from "@/types/ai-speaking";
import { PERSONA_TOKENS, PersonaId } from "@/lib/personas";
import { toast } from "sonner";

import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";

export function SpeakingWelcomeClient() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const { setSessionId, setSelectedCompanion, clearChat, addMessage } = useChatStore();
  const { me, targetLevel, practiceFloorLevel } = useStudentPracticeSession({ requireStudent: false });

  const handleStart = async (
    topic?: string,
    cefrLevel?: string,
    persona?: SpeakingPersonaId,
    responseSchema?: SpeakingResponseSchemaId,
    sessionMode?: SpeakingSessionMode
  ) => {
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
      setSelectedCompanion(companion);

      // 4. If backend returned an initial AI message, push it to history
      if (session.initialAiMessage) {
        addMessage({
          id: String(session.initialAiMessage.messageId || Date.now()),
          role: "ai",
          contentDe: session.initialAiMessage.aiSpeechDe,
        });
      }

      // 5. Navigate to Chat UI
      router.push("/speaking/chat");
    } catch (error) {
      console.error("Failed to create session", error);
      toast.error("Không thể tạo phiên luyện nói. Vui lòng thử lại!");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <WelcomeScreen
      onStart={handleStart}
      isStarting={isStarting}
      planCurrentLevel={practiceFloorLevel}
      planTargetLevel={targetLevel}
      industry={me?.industry}
    />
  );
}
