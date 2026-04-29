export type SessionState =
  | "idle"
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
  /** True while the assistant message is still streaming (ghost text) */
  isStreaming?: boolean;
}

// ─── Color tokens shared across components ─────────────────────────────────

export const CYAN   = "#22D3EE";
export const PURPLE = "#A78BFA";
export const MINT   = "#2DD4BF";

export const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.11)",
};
