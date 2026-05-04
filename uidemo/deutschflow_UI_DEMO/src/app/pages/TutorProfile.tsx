import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Code2, Coffee, Star, Zap, BookOpen,
  MapPin, Briefcase, MessageSquare, CheckCircle,
} from "lucide-react";
import { DevCharacter } from "../components/DevCharacter";
import { BottomNav } from "../components/BottomNav";

const SKILLS = [
  { label: "Backend Architecture", pct: 96, color: "#00305E" },
  { label: "API Design",           pct: 92, color: "#2D9CDB" },
  { label: "System Design",        pct: 88, color: "#9B51E0" },
  { label: "Deutsch Didaktik",     pct: 85, color: "#27AE60" },
];

const BADGES = [
  { icon: Code2,         label: "10+ Jahre Dev",    bg: "#EBF2FA", color: "#00305E" },
  { icon: Coffee,        label: "Berlin Local",      bg: "#FFF8E1", color: "#F59E0B" },
  { icon: Star,          label: "4.9 ★ Rating",      bg: "#FFF0F0", color: "#EB5757" },
  { icon: Zap,           label: "500+ Schüler",      bg: "#F4EDFF", color: "#9B51E0" },
  { icon: BookOpen,      label: "A1 – C2",           bg: "#E8F8F0", color: "#27AE60" },
  { icon: MessageSquare, label: "Native English",    bg: "#EBF5FB", color: "#2D9CDB" },
];

const FACTS = [
  "Arbeitet bei einem Berliner FinTech-Startup als Senior Backend Engineer",
  "Lernt selbst Japanisch – versteht deine Lernkurve genau",
  "Erklärt Grammatik wie Code-Architektur: klar, strukturiert, logisch",
  "Nutzt spaced-repetition & KI-Feedback für maximalen Fortschritt",
];

export default function TutorProfile() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-28" style={{ background: "#F5F5F5" }}>
      <div className="max-w-[430px] mx-auto">

        {/* ── Header ── */}
        <header
          className="flex items-center gap-3 px-5 pt-12 pb-4 bg-white"
          style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.06)" }}
        >
          <motion.button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: "#F0F4F8" }}
            whileTap={{ scale: 0.88 }}
          >
            <ArrowLeft size={18} style={{ color: "#00305E" }} />
          </motion.button>
          <span className="font-extrabold" style={{ color: "#0F172A" }}>
            Dein KI-Tutor
          </span>
        </header>

        {/* ── Hero card with character ── */}
        <div
          className="mx-4 mt-5 rounded-[24px] overflow-hidden relative"
          style={{
            background: "linear-gradient(160deg, #00305E 0%, #00498C 60%, #1A6FAE 100%)",
            boxShadow: "0 8px 32px rgba(0,48,94,0.28)",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full"
            style={{ background: "rgba(255,206,0,0.06)" }} />
          <div className="absolute -bottom-14 -left-8 w-40 h-40 rounded-full"
            style={{ background: "rgba(45,156,219,0.08)" }} />

          <div className="flex items-end gap-0 px-6 pt-8 pb-0">
            {/* Text left */}
            <div className="flex-1 pb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black mb-3"
                  style={{ background: "#FFCE00", color: "#00305E" }}
                >
                  ✦ KI-TUTOR
                </span>
                <h1 className="font-extrabold text-2xl leading-tight text-white mb-1">
                  Kai Müller
                </h1>
                <p className="text-sm text-white/70 mb-3">
                  Senior Backend Dev · Berlin
                </p>
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <MapPin size={11} />
                  <span>Mitte, Berlin</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-xs mt-1">
                  <Briefcase size={11} />
                  <span>FinTech Startup</span>
                </div>
              </motion.div>
            </div>

            {/* Character illustration */}
            <motion.div
              className="w-52 flex-shrink-0 -mb-0"
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.15 }}
            >
              <DevCharacter />
            </motion.div>
          </div>

          {/* Bottom stat strip */}
          <div
            className="flex divide-x mx-0"
            style={{
              background: "rgba(0,0,0,0.25)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              divideColor: "rgba(255,255,255,0.1)",
            }}
          >
            {[
              { val: "4.9★", sub: "Bewertung" },
              { val: "500+", sub: "Schüler" },
              { val: "A1–C2", sub: "Niveau" },
            ].map(({ val, sub }) => (
              <div key={sub} className="flex-1 text-center py-3">
                <p className="font-black text-sm text-white">{val}</p>
                <p className="text-[10px] text-white/55">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quote ── */}
        <motion.div
          className="mx-4 mt-4 px-5 py-4 rounded-[18px] bg-white"
          style={{ border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
            <span className="text-3xl font-black leading-none mr-1" style={{ color: "#FFCE00" }}>"</span>
            Ich erkläre Grammatik wie sauberen Code – strukturiert, logisch,
            wiederverwendbar. Deutsch lernen ist kein Bug, sondern ein Feature.
            <span className="text-3xl font-black leading-none ml-1" style={{ color: "#FFCE00" }}>"</span>
          </p>
          <p className="text-xs font-bold mt-2" style={{ color: "#94A3B8" }}>— Kai Müller, DeutschFlow AI Tutor</p>
        </motion.div>

        {/* ── Skills ── */}
        <div className="px-4 mt-5">
          <p className="font-black text-sm mb-3 px-1" style={{ color: "#0F172A" }}>
            Expertise
          </p>
          <div
            className="rounded-[20px] bg-white p-4"
            style={{ border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="space-y-4">
              {SKILLS.map(({ label, pct, color }, i) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: "#334155" }}>{label}</span>
                    <span className="text-[11px] font-black" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#F0F4F8" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Badge grid ── */}
        <div className="px-4 mt-5">
          <p className="font-black text-sm mb-3 px-1" style={{ color: "#0F172A" }}>
            Über Kai
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {BADGES.map(({ icon: Icon, label, bg, color }) => (
              <motion.div
                key={label}
                className="flex flex-col items-center gap-2 py-3.5 rounded-[16px]"
                style={{
                  background: bg,
                  border: "1.5px solid rgba(0,0,0,0.05)",
                }}
                whileTap={{ scale: 0.94 }}
              >
                <Icon size={20} style={{ color }} />
                <span className="text-[10px] font-bold text-center leading-tight"
                  style={{ color: "#334155" }}>
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Fun facts ── */}
        <div className="px-4 mt-5">
          <p className="font-black text-sm mb-3 px-1" style={{ color: "#0F172A" }}>
            Wusstest du?
          </p>
          <div
            className="rounded-[20px] bg-white p-4"
            style={{ border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          >
            <div className="space-y-3">
              {FACTS.map((fact, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                >
                  <CheckCircle size={16} className="flex-shrink-0 mt-0.5"
                    style={{ color: "#27AE60" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                    {fact}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="px-4 mt-6">
          <motion.button
            className="w-full py-4 rounded-[16px] font-black text-base flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #00305E, #0052A0)",
              color: "#FFCE00",
              boxShadow: "0 4px 0 0 #001F3D",
            }}
            whileTap={{ scale: 0.97, y: 4, boxShadow: "0 0px 0 0 #001F3D" }}
            onClick={() => navigate("/lesson")}
          >
            <Zap size={18} fill="#FFCE00" />
            Lektion mit Kai starten
          </motion.button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
