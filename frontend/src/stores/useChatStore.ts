import { create } from "zustand";
import { AiCompanion, StreamStatus } from "../types/ai-speaking";
import type { Suggestion, SpeakingSessionMode, ErrorItem } from "@/lib/aiSpeakingApi";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  contentDe: string;
  isStreaming?: boolean;
  feedback?: {
    errors: ErrorItem[];
    explanationVi: string;
    suggestions?: Suggestion[];
    correction?: string | null;
    grammarPoint?: string | null;
    action?: string | null;
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

  selectedCompanion: AiCompanion | null;
  setSelectedCompanion: (companion: AiCompanion | null) => void;
  
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (updates: Partial<ChatMessage>) => void;
  
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

  selectedCompanion: null,
  setSelectedCompanion: (companion) => set({ selectedCompanion: companion }),
  
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastMessage: (updates) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = { ...messages[messages.length - 1], ...updates };
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
  }),
}));
