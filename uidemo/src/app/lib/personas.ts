// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · AI Companion Design Tokens
// Single source of truth for all persona configuration.
// Both CompanionSelect and AIChat read from this file.
// ─────────────────────────────────────────────────────────────────────────────

export type PersonaId = "lukas" | "emma";

export interface PersonaToken {
  id: PersonaId;
  // Labels
  name: string;
  role: string;
  tag: string;
  desc: string;
  // Colors — light variants
  accent: string;       // primary brand color for this persona
  glow: string;         // rgba glow (used in box-shadow / filter)
  bubble: string;       // AI message bubble background
  border: string;       // bubble border / card border color
  bg: string;           // subtle card background tint
  tagBg: string;        // tag pill background
  // CTA button gradient (used on confirm button)
  ctaFrom: string;
  ctaTo: string;
  ctaShadow: string;
  // Mock AI conversation replies (cycled round-robin)
  replies: readonly string[];
}

export const PERSONA_TOKENS: Record<PersonaId, PersonaToken> = {
  lukas: {
    id: "lukas",
    name: "Lukas",
    role: "Senior Tech Mentor",
    tag: "Backend Dev · Berlin",
    desc: "Erklärt Grammatik wie sauberen Code. Strukturiert, logisch, präzise.",
    // Lukas Navy Blue
    accent: "#2D9CDB",
    glow: "rgba(45,156,219,0.4)",
    bubble: "#1A3A52",
    border: "rgba(45,156,219,0.25)",
    bg: "rgba(45,156,219,0.08)",
    tagBg: "rgba(45,156,219,0.15)",
    ctaFrom: "#1A6A9A",
    ctaTo: "#2D9CDB",
    ctaShadow: "0 4px 0 #0E4A6E, 0 8px 24px rgba(45,156,219,0.35)",
    replies: [
      "Hallo! Als Backend-Engineer erkläre ich dir Grammatik wie sauberen Code. Was möchtest du heute lernen? 👋",
      "Sehr gut! Das war absolut korrekt. Grammatik ist wie Clean Code – strukturiert und präzise!",
      "Interessante Frage! Der Unterschied zwischen Dativ und Akkusativ: Dativ antwortet auf 'wem', Akkusativ auf 'wen'. Stell dir Dativ als den Empfänger vor!",
      "Achtung! Bug entdeckt in deiner Grammatik! Schreibe: 'Ich gehe IN DIE Schule' – Akkusativ bei Bewegung! 🐛",
      "Weiter so! Du machst schnell Fortschritte. Nächste Challenge: der Genitiv. Magst du das versuchen?",
      "Perfekt! Das ist der richtige Ansatz. Denk immer an die vier Fälle: Nominativ, Akkusativ, Dativ, Genitiv – wie Stack Traces! 🚀",
    ],
  },
  emma: {
    id: "emma",
    name: "Emma",
    role: "Berlin Culture Guide",
    tag: "Künstlerin · Neukölln",
    desc: "Bringt dir Deutsch durch Kunst, Kultur und Berliner Flair bei.",
    // Emma Teal / Amber
    accent: "#00BFA5",
    glow: "rgba(0,191,165,0.4)",
    bubble: "#0A3832",
    border: "rgba(0,191,165,0.25)",
    bg: "rgba(0,191,165,0.08)",
    tagBg: "rgba(0,191,165,0.15)",
    ctaFrom: "#007A6A",
    ctaTo: "#00BFA5",
    ctaShadow: "0 4px 0 #005A4A, 0 8px 24px rgba(0,191,165,0.35)",
    replies: [
      "Hey hey! Ich bin Emma! Berlin ist so lebendig! Lass uns zusammen Deutsch durch Kultur und Kunst entdecken! 🎨",
      "Wunderbar! Du lernst so schnell! Das macht mich so froh! Weiter geht's! ✨",
      "Das ist eine super Frage! In Berlin sagen wir oft 'Kiez' für unser Nachbarschaftsviertel. Jedes Viertel hat seine eigene Seele!",
      "Haha, das war witzig! Aber lass uns trotzdem weiterlernen – Fehler machen ist Teil des Prozesses! 💪",
      "Schau mal! In der Berliner Szene hört man viele englische Lehnwörter. Kannst du ein Beispiel nennen?",
      "Das klingt fast wie ein Berliner Ureinwohner! Ich bin beeindruckt! Weiter so, du machst das fantastisch! 🌟",
    ],
  },
};

/** Ordered list for rendering (Lukas first, then Emma) */
export const PERSONA_LIST: PersonaToken[] = [
  PERSONA_TOKENS.lukas,
  PERSONA_TOKENS.emma,
];
