"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { CYAN, PURPLE, glass } from "./types";

const SUGGESTED_TOPICS = [
  { label: "Alltag",   emoji: "🏠", desc: "Tägliches Leben"  },
  { label: "Reise",    emoji: "✈️", desc: "Reisen & Urlaub"  },
  { label: "Beruf",    emoji: "💼", desc: "Arbeit & Karriere" },
  { label: "Freizeit", emoji: "🎮", desc: "Hobbys & Spaß"    },
  { label: "Essen",    emoji: "🍽️", desc: "Essen & Trinken"  },
  { label: "Familie",  emoji: "👨‍👩‍👧", desc: "Familie & Freunde"},
];

interface WelcomeScreenProps {
  onStart: (topic?: string) => void;
  isStarting: boolean;
}

export function WelcomeScreen({ onStart, isStarting }: WelcomeScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom]     = useState("");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}>
      {/* Hero */}
      <div className="rounded-[20px] p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))`, border: `1px solid rgba(34,211,238,0.2)` }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 70%)`, filter: "blur(20px)" }} />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{ background: `${CYAN}20`, border: `1px solid ${CYAN}40`, color: CYAN }}>
            ✨ KI-gestützt · Groq Llama 4 Scout
          </div>
          <h2 className="text-white font-extrabold text-xl mb-1">Sprich Deutsch mit KI</h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Dein persönlicher Tutor korrigiert Fehler und erklärt Grammatik auf Vietnamesisch.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Sofortige Korrekturen", "Grammatik-Tipps", "Natürliche Gespräche"].map((t) => (
              <span key={t} className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Topic grid */}
      <div className="rounded-[20px] p-4" style={glass}>
        <p className="text-xs font-semibold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>THEMA WÄHLEN</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SUGGESTED_TOPICS.map(({ label, emoji, desc }) => (
            <button key={label} onClick={() => { setSelected(label); setCustom(""); }}
              className="flex flex-col items-center gap-1 p-3 rounded-[14px] transition-all"
              style={{
                background: selected === label && !custom ? `${CYAN}15` : "rgba(255,255,255,0.05)",
                border: selected === label && !custom ? `1px solid ${CYAN}50` : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span className="text-xl">{emoji}</span>
              <span className="text-[11px] font-semibold" style={{ color: selected === label && !custom ? CYAN : "rgba(255,255,255,0.8)" }}>{label}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <input type="text" value={custom}
            onChange={(e) => { setCustom(e.target.value); if (e.target.value) setSelected(null); }}
            placeholder="Eigenes Thema eingeben…"
            className="w-full px-4 py-2.5 pr-8 rounded-[12px] text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.06)", border: `1px solid ${custom ? CYAN + "50" : "rgba(255,255,255,0.1)"}`,
              color: "rgba(255,255,255,0.9)", caretColor: CYAN,
            }} />
          {custom && (
            <button onClick={() => setCustom("")} className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Start button */}
      <motion.button
        onClick={() => onStart(custom.trim() || selected || undefined)}
        disabled={isStarting}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] font-bold text-sm"
        style={{
          background: isStarting ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
          color: "white",
          boxShadow: isStarting ? "none" : `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 24px rgba(34,211,238,0.3)`,
          opacity: isStarting ? 0.7 : 1,
        }}
        whileHover={!isStarting ? { scale: 1.02 } : {}}
        whileTap={!isStarting ? { scale: 0.97 } : {}}
      >
        {isStarting ? (
          <>
            <motion.div className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            Sitzung wird gestartet…
          </>
        ) : (
          <>
            <Plus size={18} />
            Neue Sitzung starten
            {(selected || custom) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(0,0,0,0.25)" }}>
                {custom || selected}
              </span>
            )}
          </>
        )}
      </motion.button>
    </div>
  );
}
