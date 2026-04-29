"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Lock,
  Check,
  Star,
  Flame,
  Trophy,
  ChevronLeft,
  Play,
  BookOpen,
  Zap,
  Map,
  Target,
  Users,
} from "lucide-react";

// ─── Level Data ───────────────────────────────────────────────────────────────

type LevelState = "completed" | "current" | "locked";

interface Level {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  state: LevelState;
  xpReward: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  category: string;
  color: string;
  shadowColor: string;
  description: string;
}

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Grammatik Basics",
    subtitle: "A1 · Grammatik",
    emoji: "📖",
    state: "completed",
    xpReward: 500,
    lessonsTotal: 10,
    lessonsCompleted: 10,
    category: "Grammatik",
    color: "#10B981",
    shadowColor: "#059669",
    description: "Artikel, Verben & Satzstruktur",
  },
  {
    id: 2,
    title: "Alltags-Vokabular",
    subtitle: "A1 · Vokabular",
    emoji: "🗣️",
    state: "completed",
    xpReward: 400,
    lessonsTotal: 8,
    lessonsCompleted: 8,
    category: "Vokabular",
    color: "#10B981",
    shadowColor: "#059669",
    description: "Familie, Essen, Farben & Zahlen",
  },
  {
    id: 3,
    title: "IT-Technologie",
    subtitle: "A2 · Fachvokabular",
    emoji: "💻",
    state: "current",
    xpReward: 600,
    lessonsTotal: 12,
    lessonsCompleted: 4,
    category: "IT",
    color: "#FFCE00",
    shadowColor: "#C9A200",
    description: "Code, Software & Tech-Begriffe",
  },
  {
    id: 4,
    title: "Badminton & Sport",
    subtitle: "A2 · Sport",
    emoji: "🏸",
    state: "locked",
    xpReward: 400,
    lessonsTotal: 8,
    lessonsCompleted: 0,
    category: "Sport",
    color: "#94A3B8",
    shadowColor: "#64748B",
    description: "Sport, Fitness & Gesundheit",
  },
  {
    id: 5,
    title: "Business Deutsch",
    subtitle: "B1 · Beruf",
    emoji: "💼",
    state: "locked",
    xpReward: 700,
    lessonsTotal: 15,
    lessonsCompleted: 0,
    category: "Business",
    color: "#94A3B8",
    shadowColor: "#64748B",
    description: "Meetings, E-Mails & Präsentationen",
  },
  {
    id: 6,
    title: "Redewendungen",
    subtitle: "B1 · Phrasen",
    emoji: "💬",
    state: "locked",
    xpReward: 500,
    lessonsTotal: 10,
    lessonsCompleted: 0,
    category: "Phrasen",
    color: "#94A3B8",
    shadowColor: "#64748B",
    description: "Idiome & kulturelle Ausdrücke",
  },
  {
    id: 7,
    title: "Kultur & Geschichte",
    subtitle: "B2 · Kultur",
    emoji: "🏛️",
    state: "locked",
    xpReward: 800,
    lessonsTotal: 12,
    lessonsCompleted: 0,
    category: "Kultur",
    color: "#94A3B8",
    shadowColor: "#64748B",
    description: "Deutsche Geschichte & Traditionen",
  },
  {
    id: 8,
    title: "C1 Meister",
    subtitle: "C1 · Fortgeschritten",
    emoji: "🏆",
    state: "locked",
    xpReward: 1000,
    lessonsTotal: 20,
    lessonsCompleted: 0,
    category: "Meister",
    color: "#94A3B8",
    shadowColor: "#64748B",
    description: "Fortgeschrittene Grammatik & Stil",
  },
];

const totalXP = LEVELS.filter((l) => l.state === "completed").reduce(
  (s, l) => s + l.xpReward,
  0
);

// ─── Node Component ───────────────────────────────────────────────────────────

function LevelNode({
  level,
  index,
  isLeft,
  onClick,
  selected,
}: {
  level: Level;
  index: number;
  isLeft: boolean;
  onClick: () => void;
  selected: boolean;
}) {
  const isCompleted = level.state === "completed";
  const isCurrent = level.state === "current";
  const isLocked = level.state === "locked";

  const nodeSize = isCurrent ? 76 : isCompleted ? 68 : 64;

  return (
    <motion.div
      className="flex items-center w-full"
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
    >
      {/* Left Info Card (odd index) */}
      <div className="flex-1 flex justify-end pr-5">
        {isLeft && (
          <InfoCard level={level} onClick={onClick} selected={selected} />
        )}
      </div>

      {/* Center Node */}
      <div className="flex flex-col items-center relative z-10">
        <motion.button
          onClick={!isLocked ? onClick : undefined}
          className="relative flex items-center justify-center rounded-full transition-all"
          style={{
            width: nodeSize,
            height: nodeSize,
            background: isCompleted
              ? "linear-gradient(145deg, #34D399, #10B981)"
              : isCurrent
              ? "linear-gradient(145deg, #FFD940, #FFCE00)"
              : "linear-gradient(145deg, #E2E8F0, #CBD5E1)",
            boxShadow: isCompleted
              ? `0 6px 0 0 ${level.shadowColor}, 0 10px 28px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.4)`
              : isCurrent
              ? `0 6px 0 0 ${level.shadowColor}, 0 10px 28px rgba(255,206,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)`
              : `0 4px 0 0 #94A3B8, 0 6px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)`,
            border: selected
              ? "3px solid white"
              : isCurrent
              ? "3px solid rgba(255,255,255,0.6)"
              : "3px solid rgba(255,255,255,0.3)",
            cursor: isLocked ? "not-allowed" : "pointer",
            filter: selected ? "brightness(1.08)" : "none",
          }}
          whileHover={!isLocked ? { scale: 1.06, y: -2 } : {}}
          whileTap={!isLocked ? { scale: 0.96, y: 4 } : {}}
          animate={
            isCurrent
              ? { scale: [1, 1.05, 1] }
              : {}
          }
          transition={
            isCurrent
              ? { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
              : {}
          }
        >
          {/* Shine */}
          <div
            className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: "55%",
              height: 4,
              background: "rgba(255,255,255,0.35)",
            }}
          />

          {isCompleted && (
            <Check size={28} className="text-white" strokeWidth={3} />
          )}
          {isCurrent && (
            <span className="text-2xl">{level.emoji}</span>
          )}
          {isLocked && (
            <Lock size={20} className="text-[#94A3B8]" />
          )}

          {/* Pulse ring for current */}
          {isCurrent && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: "3px solid rgba(255,206,0,0.5)" }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
          )}
        </motion.button>

        {/* Level number badge */}
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{
            background: isCompleted ? "#059669" : isCurrent ? "#C9A200" : "#94A3B8",
            color: "white",
            border: "2px solid white",
          }}
        >
          {level.id}
        </div>
      </div>

      {/* Right Info Card (even index) */}
      <div className="flex-1 pl-5">
        {!isLeft && (
          <InfoCard level={level} onClick={onClick} selected={selected} />
        )}
      </div>
    </motion.div>
  );
}

function InfoCard({
  level,
  onClick,
  selected,
}: {
  level: Level;
  onClick: () => void;
  selected: boolean;
}) {
  const isLocked = level.state === "locked";
  const isCurrent = level.state === "current";
  const isCompleted = level.state === "completed";

  return (
    <motion.div
      onClick={!isLocked ? onClick : undefined}
      className="rounded-[16px] p-4 max-w-[210px] w-full transition-all duration-200"
      style={{
        background: selected
          ? isCurrent
            ? "#FFF8E1"
            : isCompleted
            ? "#ECFDF5"
            : "white"
          : "white",
        border: selected
          ? `2px solid ${level.color}`
          : "2px solid #E2E8F0",
        boxShadow: selected
          ? `0 6px 20px rgba(0,48,94,0.12), 0 0 0 1px ${level.color}30`
          : "0 2px 10px rgba(0,48,94,0.06)",
        cursor: isLocked ? "default" : "pointer",
        opacity: isLocked ? 0.6 : 1,
      }}
      whileHover={!isLocked ? { y: -2, boxShadow: "0 8px 24px rgba(0,48,94,0.14)" } : {}}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{level.emoji}</span>
        <div>
          <p
            className="font-bold text-sm leading-tight"
            style={{ color: isLocked ? "#94A3B8" : "#0F172A" }}
          >
            {level.title}
          </p>
          <p className="text-[10px]" style={{ color: "#94A3B8" }}>
            {level.subtitle}
          </p>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: "#64748B" }}>
        {level.description}
      </p>

      {isLocked ? (
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-[#94A3B8]" />
          <span className="text-[11px] text-[#94A3B8]">Gesperrt</span>
        </div>
      ) : isCompleted ? (
        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#D1FAE5] overflow-hidden">
            <div className="h-full bg-[#10B981] rounded-full" style={{ width: "100%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#10B981] font-semibold">Abgeschlossen ✓</span>
            <span className="text-[11px] font-bold" style={{ color: "#FFCE00" }}>
              +{level.xpReward} XP
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#FEF9C3] overflow-hidden">
            <div
              className="h-full bg-[#FFCE00] rounded-full"
              style={{
                width: `${Math.round((level.lessonsCompleted / level.lessonsTotal) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#92400E]">
              {level.lessonsCompleted}/{level.lessonsTotal} Lektionen
            </span>
            <span className="text-[11px] text-[#94A3B8]">+{level.xpReward} XP</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Connector Line Between Nodes ─────────────────────────────────────────────

function Connector({ fromState, toState }: { fromState: LevelState; toState: LevelState }) {
  const bothDone = fromState === "completed" && toState === "completed";
  const toCurrent = fromState === "completed" && toState === "current";

  return (
    <div className="flex flex-col items-center" style={{ height: 36, position: "relative", zIndex: 1 }}>
      <div
        className="w-0.5 h-full"
        style={{
          background: bothDone
            ? "#10B981"
            : toCurrent
            ? "linear-gradient(180deg, #10B981 0%, #FFCE00 100%)"
            : "#E2E8F0",
          boxShadow: bothDone
            ? "0 0 6px rgba(16,185,129,0.4)"
            : toCurrent
            ? "0 0 6px rgba(255,206,0,0.3)"
            : "none",
        }}
      />
    </div>
  );
}

// ─── Stats Bento Cards ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  delay,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  delay: number;
}) {
  return (
    <motion.div
      className="bg-white rounded-[16px] p-4"
      style={{ border: "2px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,48,94,0.06)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-[#64748B] text-xs mb-0.5">{label}</p>
      <p className="text-[#0F172A] font-extrabold text-xl">{value}</p>
      <p className="text-[#94A3B8] text-xs mt-0.5">{sub}</p>
    </motion.div>
  );
}

// ─── Main Roadmap Page ────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(3);

  const selected = LEVELS.find((l) => l.id === selectedLevel);

  return (
    <div
      className="min-h-screen flex flex-col overflow-y-auto"
      style={{
        background: "#F1F4F9",
        backgroundImage:
          "radial-gradient(circle, rgba(0,48,94,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <motion.div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #00305E 0%, #004080 60%, #0052A3 100%)",
          borderBottom: "3px solid rgba(255,206,0,0.3)",
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-32 w-40 h-40 rounded-full bg-[#FFCE00]/8" />
        <div className="absolute top-0 left-1/3 w-64 h-64 rounded-full bg-white/3" />

        <div className="relative max-w-5xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <ChevronLeft size={16} /> Dashboard
            </button>

            <div className="w-px h-8 bg-white/20" />

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center text-xl"
                style={{
                  background: "linear-gradient(145deg, #FFD940, #FFCE00)",
                  boxShadow: "0 4px 0 0 #C9A200, 0 6px 14px rgba(255,206,0,0.3)",
                }}
              >
                🗺️
              </div>
              <div>
                <h1 className="text-white font-extrabold text-xl tracking-tight">
                  My Deutsch Journey
                </h1>
                <p className="text-white/60 text-xs">Dein Lernpfad · A1 → C1</p>
              </div>
            </div>
          </div>

          {/* XP Score */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px]"
              style={{
                background: "rgba(255,206,0,0.15)",
                border: "1.5px solid rgba(255,206,0,0.4)",
              }}
            >
              <Star size={16} fill="#FFCE00" className="text-[#FFCE00]" />
              <span className="font-extrabold text-white">{totalXP.toLocaleString()}</span>
              <span className="text-white/60 text-xs">XP</span>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px]"
              style={{
                background: "rgba(249,115,22,0.15)",
                border: "1.5px solid rgba(249,115,22,0.4)",
              }}
            >
              <Flame size={16} fill="#F97316" className="text-orange-400" />
              <span className="font-extrabold text-white">14</span>
              <span className="text-white/60 text-xs">Tage</span>
            </div>
          </div>
        </div>

        {/* Level progress strip */}
        <div className="relative max-w-5xl mx-auto px-5 pb-4">
          <div className="flex gap-1.5">
            {LEVELS.map((l) => (
              <div
                key={l.id}
                className="flex-1 h-1.5 rounded-full"
                style={{
                  background:
                    l.state === "completed"
                      ? "#FFCE00"
                      : l.state === "current"
                      ? "rgba(255,206,0,0.4)"
                      : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white/40 text-[10px]">A1</span>
            <span className="text-white/40 text-[10px]">A2</span>
            <span className="text-white/40 text-[10px]">B1</span>
            <span className="text-white/40 text-[10px]">B2</span>
            <span className="text-white/40 text-[10px]">C1</span>
          </div>
        </div>
      </motion.div>

      {/* ── Bento Grid Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-5 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── Left Stats Column ──────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-4 order-last lg:order-first">
          <StatCard icon={Trophy} label="Stufe erreicht" value="A2" sub="IT-Technologie aktiv" iconBg="#FFF8E1" iconColor="#D97706" delay={0.1} />
          <StatCard icon={Star} label="Gesamt-XP" value={`${totalXP}`} sub="+600 XP erreichbar" iconBg="#EEF4FF" iconColor="#00305E" delay={0.17} />
          <StatCard icon={Flame} label="Tages-Serie" value="14 Tage 🔥" sub="Weiter so!" iconBg="#FFF4EC" iconColor="#F97316" delay={0.24} />
          <StatCard icon={Target} label="Lektionen gesamt" value="23 / 95" sub="24% abgeschlossen" iconBg="#F0FDF4" iconColor="#10B981" delay={0.31} />
          <StatCard icon={Users} label="Platzierung" value="#234" sub="Top 12% global" iconBg="#F5F3FF" iconColor="#7C3AED" delay={0.38} />
        </div>

        {/* ── Roadmap Center Column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 order-first lg:order-none">
          <motion.div
            className="rounded-[20px] p-5 sm:p-6"
            style={{
              background: "white",
              border: "2px solid #E2E8F0",
              boxShadow: "0 4px 24px rgba(0,48,94,0.07)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-[#0F172A]">Lernpfad</h2>
                <p className="text-[#94A3B8] text-xs mt-0.5">
                  {LEVELS.filter((l) => l.state === "completed").length} von {LEVELS.length} Level abgeschlossen
                </p>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-semibold"
                style={{
                  background: "#EEF4FF",
                  color: "#00305E",
                  border: "1.5px solid rgba(0,48,94,0.12)",
                }}
              >
                <Map size={12} />
                A1 → C1
              </div>
            </div>

            {/* Roadmap Path */}
            <div className="flex flex-col items-stretch">
              {LEVELS.map((level, i) => (
                <div key={level.id}>
                  <LevelNode
                    level={level}
                    index={i}
                    isLeft={i % 2 === 0}
                    onClick={() => setSelectedLevel(level.id === selectedLevel ? null : level.id)}
                    selected={selectedLevel === level.id}
                  />
                  {i < LEVELS.length - 1 && (
                    <Connector fromState={level.state} toState={LEVELS[i + 1].state} />
                  )}
                </div>
              ))}
            </div>

            {/* ── Action Panel ─────────────────────────────────────────── */}
            {selected && (
              <motion.div
                className="mt-6 rounded-[16px] p-4"
                style={{
                  background: selected.state === "completed"
                    ? "#F0FDF4"
                    : selected.state === "current"
                    ? "#FFF8E1"
                    : "#F8FAFC",
                  border: `2px solid ${selected.state === "completed"
                    ? "#BBF7D0"
                    : selected.state === "current"
                    ? "#FDE68A"
                    : "#E2E8F0"}`,
                }}
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{selected.emoji}</span>
                  <div className="flex-1">
                    <h3
                      className="font-bold text-base"
                      style={{
                        color: selected.state === "locked" ? "#94A3B8" : "#0F172A",
                      }}
                    >
                      {selected.title}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">{selected.description}</p>
                  </div>
                  <div
                    className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                      background:
                        selected.state === "completed"
                          ? "#10B981"
                          : selected.state === "current"
                          ? "#FFCE00"
                          : "#E2E8F0",
                      color:
                        selected.state === "completed"
                          ? "white"
                          : selected.state === "current"
                          ? "#00305E"
                          : "#94A3B8",
                    }}
                  >
                    +{selected.xpReward} XP
                  </div>
                </div>

                {/* Progress bar */}
                {!selected.state.includes("locked") && (
                  <div className="mb-4">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-[#64748B]">
                        {selected.lessonsCompleted}/{selected.lessonsTotal} Lektionen
                      </span>
                      <span className="text-xs font-semibold" style={{ color: selected.color }}>
                        {Math.round((selected.lessonsCompleted / selected.lessonsTotal) * 100)}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-white/60">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: selected.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round((selected.lessonsCompleted / selected.lessonsTotal) * 100)}%`,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}

                {/* CTA button */}
                {selected.state === "current" && (
                  <button
                    onClick={() => router.push("/game")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-sm transition-all"
                    style={{
                      background: "#00305E",
                      color: "white",
                      boxShadow: "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)",
                    }}
                  >
                    <Play size={16} fill="white" /> Lektion fortsetzen
                  </button>
                )}
                {selected.state === "completed" && (
                  <button
                    onClick={() => router.push("/game")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-sm transition-all"
                    style={{
                      background: "#10B981",
                      color: "white",
                      boxShadow: "0 5px 0 0 #059669, 0 8px 20px rgba(16,185,129,0.25)",
                    }}
                  >
                    <RotateCcwIcon /> Wiederholen
                  </button>
                )}
                {selected.state === "locked" && (
                  <div
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-semibold"
                    style={{ background: "#F5F7FA", color: "#94A3B8", border: "2px solid #E2E8F0" }}
                  >
                    <Lock size={14} /> Noch gesperrt — schließe vorherige Level ab
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* ── Mobile Stats Row ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 lg:hidden">
            <StatCard icon={Trophy} label="Stufe" value="A2" sub="Aktuell" iconBg="#FFF8E1" iconColor="#D97706" delay={0} />
            <StatCard icon={Star} label="Gesamt-XP" value={`${totalXP}`} sub="Punkte" iconBg="#EEF4FF" iconColor="#00305E" delay={0.05} />
            <StatCard icon={Flame} label="Serie" value="14 🔥" sub="Tage" iconBg="#FFF4EC" iconColor="#F97316" delay={0.1} />
            <StatCard icon={Zap} label="Lektionen" value="23" sub="Abgeschlossen" iconBg="#F0FDF4" iconColor="#10B981" delay={0.15} />
          </div>
        </div>
      </div>
    </div>
  );
}

// small helper to avoid import confusion
function RotateCcwIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"></polyline>
      <path d="M3.51 15a9 9 0 1 0 .49-3.8"></path>
    </svg>
  );
}
