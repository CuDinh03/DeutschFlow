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
  isSessionEnded?: boolean;
}

// ─── Color tokens shared across components ─────────────────────────────────

// Accent trio. Re-pointed at the Galerie family (`--ga-blue` / `--ga-violet` / `--ga-teal`):
// the old neon values were mixed for a near-black surface and washed out on paper.
export const CYAN   = "#2F6FC9";
export const PURPLE = "#7C56C8";
export const MINT   = "#11888A";

/** Dark-phone / standalone demo shells */
export const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.11)",
};

/**
 * Typography + surfaces for Speaking on Galerie warm paper.
 * Values mirror `styles/galerie.css` (`--ga-ink`, `--ga-muted`, …) and the mobile
 * `lib/theme/themes.ts` palette, so the speaking flow reads the same on both platforms.
 */
export const SPEAKING_LIGHT = {
  ink: "#161513",
  inkMuted: "#76716A",
  inkSoft: "#76716A",
  inkFaint: "#B3ADA5",
  line: "#E7E3DA",
  lineStrong: "#D8D2C6",
  chatUserBg: "#F6F3EC",
  chatUserBorder: "#E7E3DA",
} as const;

/** Speaking page background — flat warm paper, no gradient (parity with mobile). */
export const SPEAKING_PAPER_BG = "#FBFAF7";

/**
 * Kept so the dark-appearance branch of the bubbles still type-checks, but no live
 * surface passes `appearance="dark"` any more — the speaking flow is light-only,
 * exactly like the mobile app (mobile has no dark variant at all).
 */
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

/** Card surface on warm paper — hairline border instead of the old blur/glass stack. */
export const glassLight: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${SPEAKING_LIGHT.line}`,
  boxShadow: "0 4px 20px rgba(22, 21, 19, 0.07)",
};
