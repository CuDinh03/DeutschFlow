'use client'

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Code2, Coffee, Star, Zap, BookOpen,
  MapPin, Briefcase, MessageSquare, CheckCircle,
} from "lucide-react";
import { DevCharacter } from "@/components/characters/DevCharacter";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";

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
  "Nutzt spaced-repetition & KI-Feedback cho tiến bộ tối đa",
];

export default function TutorProfilePage() {
  const router = useRouter();
  const { me, loading, targetLevel, streakDays, initials, reload } = useStudentPracticeSession();

  if (loading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#00305E] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="tutor"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => {}}
      headerTitle="Hồ sơ gia sư"
      headerSubtitle="Kai Müller — Chuyên gia Backend & Tiếng Đức"
    >
      <div className="max-w-[430px] mx-auto pb-10">

        {/* ── Hero card with character ── */}
        <div
          className="rounded-[24px] overflow-hidden relative"
          style={{
            background: "linear-gradient(160deg, #00305E 0%, #00498C 60%, #1A6FAE 100%)",
            boxShadow: "0 8px 32px rgba(0,48,94,0.28)",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-14 -left-8 w-40 h-40 rounded-full bg-white/5" />

          <div className="flex items-end gap-0 px-6 pt-8 pb-0">
            {/* Text left */}
            <div className="flex-1 pb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black mb-3 bg-[#FFCE00] text-[#00305E]"
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
            className="flex divide-x mx-0 bg-black/25 border-t border-white/10 divide-white/10"
          >
            {[
              { val: "4.9★", sub: "Đánh giá" },
              { val: "500+", sub: "Học viên" },
              { val: "A1–C2", sub: "Trình độ" },
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
          className="mt-5 px-5 py-4 rounded-[18px] bg-white border-[1.5px] border-[#E2E8F0] shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm leading-relaxed text-[#334155]">
            <span className="text-3xl font-black leading-none mr-1 text-[#FFCE00]">"</span>
            Tôi giải thích ngữ pháp như code sạch – cấu trúc, logic,
            có thể tái sử dụng. Học tiếng Đức không phải là một lỗi, mà là một tính năng.
            <span className="text-3xl font-black leading-none ml-1 text-[#FFCE00]">"</span>
          </p>
          <p className="text-xs font-bold mt-2 text-[#94A3B8]">— Kai Müller, DeutschFlow AI Tutor</p>
        </motion.div>

        {/* ── Skills ── */}
        <div className="mt-6">
          <p className="font-black text-sm mb-3 px-1 text-[#0F172A]">
            Chuyên môn
          </p>
          <div
            className="rounded-[20px] bg-white p-4 border-[1.5px] border-[#E2E8F0] shadow-sm"
          >
            <div className="space-y-4">
              {SKILLS.map(({ label, pct, color }, i) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#334155]">{label}</span>
                    <span className="text-[11px] font-black" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F0F4F8]">
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
        <div className="mt-6">
          <p className="font-black text-sm mb-3 px-1 text-[#0F172A]">
            Về Kai
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {BADGES.map(({ icon: Icon, label, bg, color }) => (
              <motion.div
                key={label}
                className="flex flex-col items-center gap-2 py-3.5 rounded-[16px] border-[1.5px] border-black/5 shadow-sm"
                style={{ background: bg }}
                whileTap={{ scale: 0.94 }}
              >
                <Icon size={20} style={{ color }} />
                <span className="text-[10px] font-bold text-center leading-tight text-[#334155]">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Fun facts ── */}
        <div className="mt-6">
          <p className="font-black text-sm mb-3 px-1 text-[#0F172A]">
            Bạn có biết?
          </p>
          <div
            className="rounded-[20px] bg-white p-4 border-[1.5px] border-[#E2E8F0] shadow-sm"
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
                  <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-[#27AE60]" />
                  <p className="text-xs leading-relaxed text-[#475569]">
                    {fact}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="mt-8">
          <motion.button
            className="w-full py-4 rounded-[16px] font-black text-base flex items-center justify-center gap-2 text-[#FFCE00] shadow-xl"
            style={{
              background: "linear-gradient(135deg, #00305E, #0052A0)",
              boxShadow: "0 4px 0 0 #001F3D",
            }}
            whileTap={{ scale: 0.97, y: 4, boxShadow: "0 0px 0 0 #001F3D" }}
            onClick={() => router.push("/student/roadmap")}
          >
            <Zap size={18} fill="#FFCE00" />
            Bắt đầu bài học với Kai
          </motion.button>
        </div>

      </div>
    </StudentShell>
  );
}
