import { cn } from "@/lib/utils";

export type SpeakingPersonaVisualId =
  | "DEFAULT"
  | "LUKAS"
  | "EMMA"
  | "ANNA"
  | "KLAUS"
  | "LENA"
  | "PETRA"
  | "TUAN"
  | "LAN"
  | "MAX"
  | "OLIVER"
  | "NIKLAS"
  | "NINA"
  | "SCHNEIDER"
  | "WEBER"
  | "THOMAS"
  | "HANNIE"
  | "SARAH"
  | "MINH";

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
    case "ANNA":
      return {
        accent: "#14b8a6",
        glow: "rgba(20,184,166,0.35)",
        bubble: "#0f2724",
        border: "rgba(45,212,191,0.28)",
      };
    case "KLAUS":
      return {
        accent: "#B91C1C",
        glow: "rgba(185,28,28,0.42)",
        bubble: "#241218",
        border: "rgba(185,28,28,0.32)",
      };
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
  if (u === "ANNA") return "ANNA";
  if (u === "KLAUS") return "KLAUS";
  if (u === "ANNA") return "ANNA";
  if (u === "LENA") return "LENA";
  if (u === "PETRA") return "PETRA";
  if (u === "TUAN") return "TUAN";
  if (u === "LAN") return "LAN";
  if (u === "MAX") return "MAX";
  if (u === "OLIVER") return "OLIVER";
  if (u === "NIKLAS") return "NIKLAS";
  if (u === "NINA") return "NINA";
  if (u === "SCHNEIDER") return "SCHNEIDER";
  if (u === "WEBER") return "WEBER";
  return "DEFAULT";
}

/** Action chips + focus ring on warm paper. The persona hue is carried by a tinted
 *  fill and its AA-safe ink (lib/personaPaper) — the old neon gradients assumed a
 *  near-black surface and turned muddy on paper. */
export function personaActionChipClasses(id: SpeakingPersonaVisualId) {
  return cn(
    "rounded-full px-3.5 py-2 text-xs font-medium transition-transform duration-200 border",
    "border-ga-line bg-ga-card text-ga-ink hover:scale-[1.03] active:scale-[0.98]",
    id === "EMMA" && "border-ga-teal bg-ga-teal-soft text-ga-teal",
    id === "LUKAS" && "border-ga-blue bg-ga-blue-soft text-ga-blue",
    id === "ANNA" && "border-ga-teal bg-ga-teal-soft text-ga-teal",
    id === "KLAUS" && "border-ga-red bg-ga-red-soft text-ga-red",
  );
}

export function personaRingClass(id: SpeakingPersonaVisualId) {
  return cn(
    "ring-1",
    id === "EMMA" && "ring-ga-teal",
    id === "LUKAS" && "ring-ga-blue",
    id === "ANNA" && "ring-ga-teal",
    id === "KLAUS" && "ring-ga-red",
    id === "DEFAULT" && "ring-ga-line",
  );
}
