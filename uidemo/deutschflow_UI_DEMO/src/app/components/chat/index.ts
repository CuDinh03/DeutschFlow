// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · Chat component barrel export
// Import all chat primitives from this single entry point:
//   import { ChatBubble, ChatInput, TypingIndicator, CharacterFloat, PersonaCard } from "../components/chat";
// ─────────────────────────────────────────────────────────────────────────────

export { ChatBubble } from "./ChatBubble";
export type { ChatBubbleProps, BubbleVariant } from "./ChatBubble";

export { ChatInput } from "./ChatInput";
export type { InputState } from "./ChatInput";

export { TypingIndicator } from "./TypingIndicator";

export { CharacterFloat } from "./CharacterFloat";

export { PersonaCard } from "./PersonaCard";
