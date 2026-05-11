import { create } from "zustand";
import api from "@/lib/api";

// ── Types ──
export interface VocabItem {
  id: string;
  german: string;
  meaning: string;
  gender: string | null;
  color_code: string | null;
  gender_label: string | null;
  example_de: string;
  example_vi: string;
  speak_de: string;
  tags: string[];
  ai_speech_hints?: {
    focus_phonemes: string[];
    common_errors_vi: string[];
    ipa_target: string;
  };
}

export interface TheoryCard {
  type: string;
  title: { vi?: string; de?: string };
  content: { vi?: string; de?: string };
  tags: string[];
}

export interface Phrase {
  german: string;
  meaning: string;
  speak_de: string;
}

export interface Example {
  german: string;
  translation: string;
  note?: string;
  speak_de: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface NodeContent {
  title: { de: string; vi: string };
  overview: { de: string; vi: string };
  session_type: string;
  theory_cards: TheoryCard[];
  vocabulary: VocabItem[];
  phrases: Phrase[];
  examples: Example[];
  exercises: { theory_gate: unknown[]; practice: unknown[] };
  reading_passage: {
    text_de: string;
    text_vi_hover: string;
    questions: unknown[];
    tap_translate_vocab_refs: string[];
  } | null;
  audio_content: {
    url: string;
    transcript_sync: WordTimestamp[];
  } | null;
  writing_prompt: {
    task_de: string;
    task_vi: string;
    bullet_points: string[];
    min_words: number;
    ai_grading_rubric?: { focus_grammar: string[]; required_vocab_tags: string[] };
  } | null;
}

export interface NodeSession {
  nodeId: number;
  titleDe: string;
  titleVi: string;
  descriptionVi: string;
  emoji: string;
  phase: string;
  cefrLevel: string;
  difficulty: number;
  xpReward: number;
  moduleNumber: number | null;
  moduleTitleVi: string | null;
  sessionType: string;
  content: NodeContent | null;
  hasContent: boolean;
  dependenciesMet: boolean;
}

type ActiveView = "grammar" | "reading" | "listening" | "speaking" | "writing" | "phoneme";

interface NodeSessionState {
  session: NodeSession | null;
  loading: boolean;
  error: string | null;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  tabCompletion: Record<ActiveView, boolean>;
  markTabCompleted: (tab: ActiveView) => void;
  fetchSession: (nodeId: number) => Promise<void>;
  reset: () => void;
}

export const useNodeSessionStore = create<NodeSessionState>((set) => ({
  session: null,
  loading: false,
  error: null,
  activeView: "grammar",
  tabCompletion: {
    grammar: false,
    reading: false,
    listening: false,
    speaking: false,
    writing: false,
    phoneme: false,
  },

  setActiveView: (v) => set({ activeView: v }),
  markTabCompleted: (tab) =>
    set((state) => ({
      tabCompletion: { ...state.tabCompletion, [tab]: true },
    })),

  fetchSession: async (nodeId) => {
    set({
      loading: true,
      error: null,
      tabCompletion: {
        grammar: false,
        reading: false,
        listening: false,
        speaking: false,
        writing: false,
        phoneme: false,
      },
    });
    try {
      const { data } = await api.get<NodeSession>(`/skill-tree/node/${nodeId}/session`);
      set({ session: data, loading: false });
    } catch (e: unknown) {
      set({ error: "Không thể tải bài học.", loading: false });
    }
  },

  reset: () =>
    set({
      session: null,
      loading: false,
      error: null,
      activeView: "grammar",
      tabCompletion: {
        grammar: false,
        reading: false,
        listening: false,
        speaking: false,
        writing: false,
        phoneme: false,
      },
    }),
}));
