import { cn } from "@/lib/utils";

export type SpeakingPersonaVisualId = "DEFAULT" | "LUKAS" | "EMMA" | "HANNA" | "KLAUS";

/** UIDemo `PERSONA_TOKENS` — AIChat / V2 companion surfaces */
export interface PersonaV2VisualTokens {
  accent: string;
  glow: string;
  bubble: string;
  border: string;
}

export function getPersonaV2VisualTokens(id: SpeakingPersonaVisualId): PersonaV2VisualTokens {
  switch (id) {
    case "LUKAS":
      return {
        accent: "#2D9CDB",
        glow: "rgba(45,156,219,0.4)",
        bubble: "#1A3A52",
        border: "rgba(45,156,219,0.25)",
      };
    case "EMMA":
      return {
        accent: "#00BFA5",
        glow: "rgba(0,191,165,0.4)",
        bubble: "#0A3832",
        border: "rgba(0,191,165,0.25)",
      };
    case "HANNA":
      return {
        accent: "#14b8a6",
        glow: "rgba(20,184,166,0.35)",
        bubble: "#0f2724",
        border: "rgba(45,212,191,0.28)",
      };
    case "KLAUS":
    case "DEFAULT":
    default:
      return {
        accent: "#22D3EE",
        glow: "rgba(34,211,238,0.35)",
        bubble: "#152238",
        border: "rgba(34,211,238,0.22)",
      };
  }
}

export function normalizeSpeakingPersona(raw: string | null | undefined): SpeakingPersonaVisualId {
  const u = String(raw ?? "DEFAULT").toUpperCase();
  if (u === "LUKAS") return "LUKAS";
  if (u === "EMMA") return "EMMA";
  if (u === "HANNA") return "HANNA";
  if (u === "KLAUS") return "KLAUS";
  return "DEFAULT";
}

/** Tailwind classes for V2 action chips + accents (Lukas = blue/slate, Emma = amber/teal). */
export function personaActionChipClasses(id: SpeakingPersonaVisualId) {
  return cn(
    "rounded-full px-3.5 py-2 text-xs font-medium transition-transform duration-200 border backdrop-blur-sm",
    "hover:scale-[1.03] active:scale-[0.98]",
    id === "EMMA" &&
      "border-amber-400/35 bg-gradient-to-r from-amber-500/15 to-teal-500/10 text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.12)] hover:border-amber-400/55",
    id === "LUKAS" &&
      "border-sky-400/35 bg-gradient-to-r from-slate-800/80 to-sky-900/40 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.12)] hover:border-sky-400/55",
    id === "HANNA" &&
      "border-teal-400/35 bg-gradient-to-r from-teal-900/70 to-emerald-900/40 text-teal-50 shadow-[0_0_20px_rgba(45,212,191,0.14)] hover:border-teal-400/55",
    (id === "DEFAULT" || id === "KLAUS") &&
      "border-cyan-400/30 bg-white/[0.08] text-white/90 hover:border-cyan-400/50 hover:bg-white/[0.12]",
  );
}

export function personaRingClass(id: SpeakingPersonaVisualId) {
  return cn(
    id === "EMMA" && "ring-1 ring-amber-400/15 shadow-[0_0_60px_rgba(245,158,11,0.08)]",
    id === "LUKAS" && "ring-1 ring-sky-400/15 shadow-[0_0_60px_rgba(56,189,248,0.08)]",
    id === "HANNA" && "ring-1 ring-teal-400/18 shadow-[0_0_60px_rgba(45,212,191,0.1)]",
    (id === "DEFAULT" || id === "KLAUS") && "ring-1 ring-white/10",
  );
}
