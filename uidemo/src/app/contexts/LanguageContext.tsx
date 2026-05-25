// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · Language Context
// Provides VI (Tiếng Việt) ↔ DE (Deutsch) toggle across the whole app.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "vi" | "de";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>({
  lang: "vi",
  setLang: () => {},
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("vi");
  const toggle = () => setLang(l => (l === "vi" ? "de" : "vi"));
  return (
    <LangContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLanguage = () => useContext(LangContext);
