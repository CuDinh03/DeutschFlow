import { create } from "zustand";
import { AiCompanion, StreamStatus } from "../types/ai-speaking";
import type {
  Suggestion,
  SpeakingSessionMode,
  SpeakingResponseSchemaId,
  ErrorItem,
  AdaptiveMeta,
} from "@/lib/aiSpeakingApi";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  contentDe: string;
  isStreaming?: boolean;
  /** Structured errors on the user's utterance (filled when AI responds). */
  errors?: ErrorItem[];
  feedback?: {
    errors: ErrorItem[];
    explanationVi: string;
    suggestions?: Suggestion[];
    correction?: string | null;
    grammarPoint?: string | null;
    action?: string | null;
    status?: "OFF_TOPIC" | "ON_TOPIC_NEEDS_IMPROVEMENT" | "EXCELLENT" | null;
    feedbackText?: string | null;
  };
}

interface ChatState {
  sessionId: number | null;
  setSessionId: (id: number | null) => void;

  sessionMode: SpeakingSessionMode | null;
  setSessionMode: (mode: SpeakingSessionMode | null) => void;

  /** Interview mode: candidate experience level (e.g. "0-6M", "1-2Y"). */
  experienceLevel: string | null;
  setExperienceLevel: (level: string | null) => void;

  /** Interview mode: interviewReportJson returned from endSession. */
  interviewReportJson: string | null;
  setInterviewReportJson: (json: string | null) => void;

  /** Interview orchestrator phase key from last AI turn. */
  interviewPhaseKey: string | null;
  interviewHintKey: string | null;
  setInterviewUiHints: (phaseKey: string | null, hintKey: string | null) => void;

  selectedCompanion: AiCompanion | null;
  setSelectedCompanion: (companion: AiCompanion | null) => void;

  responseSchema: SpeakingResponseSchemaId;
  setResponseSchema: (schema: SpeakingResponseSchemaId) => void;

  sessionTopic: string | null;
  setSessionTopic: (topic: string | null) => void;

  adaptiveMeta: AdaptiveMeta | null;
  setAdaptiveMeta: (meta: AdaptiveMeta | null) => void;

  /** Set when session opens with force-repair on greeting (consumed by chat page). */
  pendingRepairGate: {
    code: string;
    exampleCorrectDe?: string;
    ruleViShort?: string;
  } | null;
  setPendingRepairGate: (gate: {
    code: string;
    exampleCorrectDe?: string;
    ruleViShort?: string;
  } | null) => void;
  
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (updates: Partial<ChatMessage>) => void;
  updateLastUserMessage: (updates: Partial<ChatMessage>) => void;
  
  streamStatus: StreamStatus;
  setStreamStatus: (status: StreamStatus) => void;
  
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  sessionMode: null,
  setSessionMode: (mode) => set({ sessionMode: mode }),

  experienceLevel: null,
  setExperienceLevel: (level) => set({ experienceLevel: level }),

  interviewReportJson: null,
  setInterviewReportJson: (json) => set({ interviewReportJson: json }),

  interviewPhaseKey: null,
  interviewHintKey: null,
  setInterviewUiHints: (phaseKey, hintKey) => set({ interviewPhaseKey: phaseKey, interviewHintKey: hintKey }),

  selectedCompanion: null,
  setSelectedCompanion: (companion) => set({ selectedCompanion: companion }),

  responseSchema: "V1",
  setResponseSchema: (schema) => set({ responseSchema: schema }),

  sessionTopic: null,
  setSessionTopic: (topic) => set({ sessionTopic: topic }),

  adaptiveMeta: null,
  setAdaptiveMeta: (meta) => set({ adaptiveMeta: meta }),

  pendingRepairGate: null,
  setPendingRepairGate: (gate) => set({ pendingRepairGate: gate }),
  
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates };
      }
      return { messages };
    }),
  updateLastUserMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          messages[i] = { ...messages[i], ...updates };
          break;
        }
      }
      return { messages };
    }),
    
  streamStatus: "idle",
  setStreamStatus: (status) => set({ streamStatus: status }),
  
  clearChat: () => set({
    messages: [],
    streamStatus: "idle",
    sessionId: null,
    sessionMode: null,
    experienceLevel: null,
    interviewReportJson: null,
    interviewPhaseKey: null,
    interviewHintKey: null,
    responseSchema: "V1",
    sessionTopic: null,
    adaptiveMeta: null,
    pendingRepairGate: null,
  }),
}));
