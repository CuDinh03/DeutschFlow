// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · CompanionSelect  (/companion)
// Master frame: Persona selection screen.
// Reads from PERSONA_LIST (single source of truth).
// Uses PersonaCard component for selection cards.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { PERSONA_LIST, PersonaId } from "../lib/personas";
import { PersonaCard } from "../components/chat/PersonaCard";

export default function CompanionSelect() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selectedPersona = selected ? PERSONA_LIST.find((p) => p.id === selected) : null;

  const handleConfirm = () => {
    if (!selected || !selectedPersona || confirming) return;
    setConfirming(true);
    setTimeout(() => navigate("/chat", { state: { character: selected } }), 450);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#080818", color: "#fff" }}
    >
      <div className="max-w-[430px] mx-auto w-full flex flex-col min-h-screen">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-5 pt-14 pb-6 flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Back button */}
            <motion.button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 mb-5"
              style={{ color: "rgba(255,255,255,0.5)" }}
              whileTap={{ scale: 0.92 }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <ArrowLeft size={15} />
              </div>
              <span className="text-sm">Dashboard</span>
            </motion.button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} style={{ color: "#FFCE00" }} />
              <span
                className="text-[11px] font-black tracking-widest uppercase"
                style={{ color: "#FFCE00" }}
              >
                DeutschFlow AI
              </span>
            </div>
            <h1 className="font-black text-2xl leading-tight text-white">
              Wähle deinen
            </h1>
            <h1 className="font-black text-2xl leading-tight" style={{ color: "#FFCE00" }}>
              Begleiter
            </h1>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Wer begleitet dich heute auf deiner Lernreise?
            </p>
          </motion.div>
        </div>

        {/* ── Persona Cards ────────────────────────────────────────── */}
        <div className="flex-1 px-4 flex gap-3 pb-4">
          {PERSONA_LIST.map((persona, idx) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isSelected={selected === persona.id}
              index={idx}
              onClick={() => setSelected(persona.id)}
            />
          ))}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <div className="px-4 pb-10 flex-shrink-0">
          <AnimatePresence mode="wait">
            {selectedPersona ? (
              <motion.button
                key="cta-active"
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] font-black text-base text-white"
                style={{
                  background: `linear-gradient(135deg, ${selectedPersona.ctaFrom}, ${selectedPersona.ctaTo})`,
                  boxShadow: selectedPersona.ctaShadow,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                whileTap={{ scale: 0.97, y: 3 }}
                onClick={handleConfirm}
              >
                {confirming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles size={18} />
                  </motion.div>
                ) : (
                  <>
                    Mit {selectedPersona.name} starten
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            ) : (
              <motion.p
                key="cta-hint"
                className="text-center text-sm"
                style={{ color: "rgba(255,255,255,0.25)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Wähle einen Begleiter, um zu beginnen
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
