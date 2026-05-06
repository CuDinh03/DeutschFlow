export type SessionState =
  | "idle"
  | "chatting"
  | "listening"
  | "processing"
  | "ai-speaking"
  | "sending"
  | "summary";

export interface ErrorSegment {
  text: string;
  isError: boolean;
  correction?: string;
  errorType?: "auxiliary" | "preposition" | "grammar" | "vocab";
}

export interface Exchange {
  id: number;
  segments: ErrorSegment[];
  corrected?: string;
  hasError: boolean;
  aiResponse: string;
  timestamp: string;
  score: number;
}

/** Mirrors {@link import('@/lib/aiSpeakingApi').ErrorItem} for chat bubbles */
export interface StructuredErrorItem {
  errorCode: string;
  severity: string;
  confidence?: number | null;
  wrongSpan?: string | null;
  correctedSpan?: string | null;
  ruleViShort?: string | null;
  exampleCorrectDe?: string | null;
}

export interface Suggestion {
  german_text: string;
  vietnamese_translation: string;
  level: string;
  why_to_use: string;
  usage_context: string;
  lego_structure: string;
}

/** Re-export shape from AI speaking API (`meta.adaptive` on chat / SSE done). */
export interface AdaptiveMetaBubble {
  enabled: boolean;
  cefrEffective: string;
  difficultyKnob: number;
  focusCodes: string[];
  targetStructures: string[];
  topicSuggestion: string | null;
  forceRepairBeforeContinue: boolean;
  primaryRepairErrorCode: string | null;
}

export interface AiMessageBubble {
  id: number;
  role: "USER" | "ASSISTANT";
  userText?: string;
  aiSpeechDe?: string;
  correction?: string | null;
  explanationVi?: string | null;
  grammarPoint?: string | null;
  newWord?: string | null;
  userInterestDetected?: string | null;
  errors?: StructuredErrorItem[];
  /** True while the assistant message is still streaming (ghost text) */
  isStreaming?: boolean;
  
  // New fields
  status?: 'OFF_TOPIC' | 'ON_TOPIC_NEEDS_IMPROVEMENT' | 'EXCELLENT' | null;
  feedback?: string | null;
  suggestions?: Suggestion[];
  /** V2 compact contract */
  action?: string | null;
  /** Present when backend sends adaptive policy with the assistant turn */
  adaptive?: AdaptiveMetaBubble | null;
}

// ─── Color tokens shared across components ─────────────────────────────────

export const CYAN   = "#22D3EE";
export const PURPLE = "#A78BFA";
export const MINT   = "#2DD4BF";

/** Dark-phone / standalone demo shells */
export const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.11)",
};

/** Typography + surfaces for Speaking inside StudentShell (`#F8FAFF`) */
export const SPEAKING_LIGHT = {
  ink: "#0f172a",
  inkMuted: "#475569",
  inkSoft: "#64748b",
  inkFaint: "#94a3b8",
  line: "rgba(15, 23, 42, 0.08)",
  lineStrong: "rgba(15, 23, 42, 0.14)",
  chatUserBg: "#f1f5f9",
  chatUserBorder: "#e2e8f0",
} as const;

/** UIDemo `Speaking.tsx` page background — cyan/violet/teal ambient depth */
export const SPEAKING_IMMERSIVE_GRADIENT =
  "linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)";

/** Glass phone panel inside immersive speaking (matches UIDemo phone frame) */
export const SPEAKING_PHONE_PANEL_BG = "rgba(10, 22, 40, 0.6)";

/** Dark phone / gradient shell (demo-aligned) */
export const SPEAKING_DARK = {
  ink: "rgba(255, 255, 255, 0.92)",
  inkMuted: "rgba(255, 255, 255, 0.72)",
  inkSoft: "rgba(255, 255, 255, 0.55)",
  inkFaint: "rgba(255, 255, 255, 0.38)",
  line: "rgba(255, 255, 255, 0.12)",
  lineStrong: "rgba(255, 255, 255, 0.2)",
  chatUserBg: "rgba(255, 255, 255, 0.08)",
  chatUserBorder: "rgba(255, 255, 255, 0.14)",
} as const;

/** Cards on pale blue shell — avoids “white-on-white” with dark text */
export const glassLight: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: `1px solid ${SPEAKING_LIGHT.lineStrong}`,
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};
