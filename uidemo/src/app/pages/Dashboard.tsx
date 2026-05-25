import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell, Flame, Trophy, Target, Zap, Play, Clock, Star,
  ChevronRight, BookOpen, Mic, Layers, Gamepad2, Map,
  ShieldCheck, TrendingUp, BarChart2, Repeat2, Check, Monitor,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import { BottomNav } from "../components/BottomNav";
import { NotificationDrawer } from "../components/NotificationDrawer";

const weeklyData = [
  { day: "Mo", v: 25 }, { day: "Di", v: 40 }, { day: "Mi", v: 15 },
  { day: "Do", v: 55 }, { day: "Fr", v: 35 }, { day: "Sa", v: 60 }, { day: "So", v: 20 },
];

const QUICK = [
  { label: "KI Sprechen", icon: Mic, path: "/speaking", color: "#2D9CDB", bg: "#EBF5FB" },
  { label: "Wischen", icon: Repeat2, path: "/swipe", color: "#7C3AED", bg: "#F5F0FF" },
  { label: "Karten", icon: Layers, path: "/flashcards", color: "#27AE60", bg: "#E8F8F0" },
  { label: "Spiel", icon: Gamepad2, path: "/game", color: "#F2994A", bg: "#FEF3E8" },
  { label: "Vokabeln", icon: BookOpen, path: "/vocabulary", color: "#EB5757", bg: "#FDEAEA" },
  { label: "Fehler", icon: ShieldCheck, path: "/errors", color: "#00305E", bg: "#EBF2FA" },
  { label: "Roadmap", icon: Map, path: "/roadmap", color: "#7C3AED", bg: "#F5F0FF" },
];

const GOALS = [
  { label: "Vokabeln üben", current: 18, total: 20, color: "#FFCE00" },
  { label: "Lektion", current: 1, total: 1, color: "#27AE60" },
  { label: "Aussprache", current: 5, total: 10, color: "#2D9CDB" },
  { label: "Hörübung", current: 2, total: 3, color: "#7C3AED" },
];

const LESSONS = [
  { id: 1, title: "Kapitel 4: Der Weg zur Arbeit", level: "A2", duration: "8 min", tag: "Weiter", tagColor: "#00305E", bg: "#EBF2FA" },
  { id: 2, title: "German Greetings & Small Talk", level: "A1", duration: "12 min", tag: "Beliebt", tagColor: "#27AE60", bg: "#E8F8F0" },
  { id: 3, title: "Café & Restaurant Deutsch", level: "A2", duration: "15 min", tag: "Neu", tagColor: "#F2994A", bg: "#FEF3E8" },
  { id: 4, title: "Pronunciation Mastery", level: "B1", duration: "22 min", tag: "Fortgesch.", tagColor: "#7C3AED", bg: "#F5F0FF" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-[10px] shadow-lg px-2.5 py-2 border border-[#E2E8F0]">
      <p className="text-[10px] text-[#94A3B8]">{label}</p>
      <p className="text-sm font-bold text-[#00305E]">{payload[0].value} Min.</p>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const [activeLesson, setActiveLesson] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const lessonScrollRef = useRef<HTMLDivElement>(null);

  const handleLessonScroll = () => {
    if (!lessonScrollRef.current) return;
    const el = lessonScrollRef.current;
    // card width + gap ≈ 84vw + 12px; we calculate from scrollLeft
    const cardWidth = el.offsetWidth * 0.84 + 12;
    const index = Math.min(
      Math.round(el.scrollLeft / cardWidth),
      LESSONS.length - 1
    );
    setActiveLesson(index);
  };

  const done = GOALS.filter((g) => g.current >= g.total).length;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#F5F5F5" }}>
      <div className="max-w-[430px] mx-auto">

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="bg-white px-5 pt-12 pb-4 flex items-center justify-between"
          style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base"
              style={{ background: "linear-gradient(135deg, #00305E, #2D9CDB)", color: "#fff" }}>
              HC
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Willkommen zurück 👋</p>
              <p className="font-extrabold" style={{ color: "#00305E" }}>Huy Cự</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "#FFF8E1", border: "1.5px solid #FDE68A" }}>
              <Flame size={14} className="text-orange-500" fill="#f97316" />
              <span className="font-bold text-sm" style={{ color: "#00305E" }}>14</span>
            </div>
            <motion.button
              className="relative w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: showNotifs ? "#00305E" : "#F5F7FA" }}
              whileTap={{ scale: 0.88 }}
              onClick={() => setShowNotifs(true)}
            >
              <Bell size={18} style={{ color: showNotifs ? "#FFCE00" : "#64748B" }} />
              {/* unread badge */}
              <motion.span
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: "#FFCE00", color: "#00305E", border: "2px solid white" }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                3
              </motion.span>
            </motion.button>
          </div>
        </header>

        {/* ── Stats Row ────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Trophy, label: "XP", val: "1.240", color: "#FFCE00", bg: "#FFF8E1" },
              { icon: Target, label: "Einh.", val: "28", color: "#27AE60", bg: "#E8F8F0" },
              { icon: Zap, label: "Min/Tag", val: "36", color: "#2D9CDB", bg: "#EBF5FB" },
              { icon: TrendingUp, label: "Niveau", val: "A2", color: "#7C3AED", bg: "#F5F0FF" },
            ].map(({ icon: Icon, label, val, color, bg }) => (
              <motion.div key={label}
                className="rounded-[16px] p-3 flex flex-col items-center gap-1.5"
                style={{ background: "white", border: `1.5px solid ${color}20`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                whileTap={{ scale: 0.96 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <p className="font-black text-sm" style={{ color: "#0F172A" }}>{val}</p>
                <p className="text-[9px] font-semibold" style={{ color: "#94A3B8" }}>{label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Continue Learning ────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <motion.div
            className="rounded-[24px] p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #00305E 0%, #004898 100%)",
              boxShadow: "0 8px 32px rgba(0,48,94,0.25), 0 3px 0 0 #002447",
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/lesson")}
          >
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full"
              style={{ background: "rgba(255,206,0,0.08)" }} />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#FFCE00", color: "#00305E" }}>▶ Weiter lernen</span>
                <span className="text-white/50 text-xs">Kapitel 4</span>
              </div>
              <h2 className="font-extrabold text-white text-lg leading-tight mb-1">
                Der Weg zur Arbeit
              </h2>
              <p className="text-white/60 text-xs mb-4">A2 · Präteritum & Wegbeschreibungen</p>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs">Fortschritt</span>
                  <span className="text-[#FFCE00] font-bold text-xs">68%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: "#FFCE00" }}
                    initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ duration: 1, delay: 0.3 }} />
                </div>
                <div className="flex items-center gap-3 mt-2 text-white/50 text-[10px]">
                  <span className="flex items-center gap-1"><Clock size={10} /> 8 Min. übrig</span>
                  <span>Lektion 4 von 6</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] font-bold text-sm"
                  style={{ background: "#FFCE00", color: "#00305E", boxShadow: "0 3px 0 0 #C9A200" }}
                  whileTap={{ scale: 0.94, y: 3, boxShadow: "0 0 0 0 #C9A200" }}>
                  <Play size={14} fill="#00305E" /> Fortsetzen
                </motion.button>
                <div className="flex items-center gap-1 text-white/50 text-xs">
                  <Zap size={11} />
                  <span>+250 XP</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Daily Goals ──────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <div className="bg-white rounded-[20px] p-5" style={{ boxShadow: "0 2px 12px rgba(0,48,94,0.06)", border: "1.5px solid #E2E8F0" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} style={{ color: "#00305E" }} />
                <span className="font-bold" style={{ color: "#0F172A" }}>Tagesziele</span>
              </div>
              <span className="font-black text-sm" style={{ color: "#00305E" }}>{done}/4</span>
            </div>
            <div className="space-y-3">
              {GOALS.map(({ label, current, total, color }) => {
                const pct = Math.min((current / total) * 100, 100);
                const isDone = current >= total;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm" style={{ color: "#0F172A" }}>{label}</span>
                      <span className="text-xs font-semibold"
                        style={{ color: isDone ? "#27AE60" : "#94A3B8" }}>
                        {isDone ? "✓" : `${current}/${total}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#F0F4F8" }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Quick Access ─────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          {/* AI Companion Banner */}
          <motion.button
            onClick={() => navigate("/companion")}
            className="w-full mb-3 flex items-center gap-4 p-4 rounded-[20px] overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, #080818 0%, #101030 100%)",
              border: "1.5px solid rgba(255,206,0,0.2)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Glow orbs */}
            <div className="absolute left-20 top-0 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: "rgba(45,156,219,0.2)", filter: "blur(20px)" }} />
            <div className="absolute left-40 top-0 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: "rgba(0,191,165,0.18)", filter: "blur(20px)" }} />

            {/* Avatar previews */}
            <div className="flex -space-x-3 flex-shrink-0 relative z-10">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#2D9CDB]"
                style={{ background: "#080818" }}>
                <svg viewBox="80 130 200 210" xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "100%", height: "100%" }}>
                  <ellipse cx="150" cy="150" rx="64" ry="60" fill="#1A1A2E" />
                  <ellipse cx="150" cy="194" rx="58" ry="64" fill="#F5C89A" />
                  <rect x="109" y="167" width="38" height="22" rx="7" fill="rgba(196,220,242,0.18)" stroke="#1A1A2E" strokeWidth="2.5" />
                  <rect x="151" y="167" width="38" height="22" rx="7" fill="rgba(196,220,242,0.18)" stroke="#1A1A2E" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#00BFA5]"
                style={{ background: "#080818" }}>
                <svg viewBox="60 100 230 260" xmlns="http://www.w3.org/2000/svg"
                  style={{ width: "100%", height: "100%" }}>
                  <g transform="rotate(5 144 310)">
                    <ellipse cx="144" cy="148" rx="76" ry="80" fill="#D97200" />
                    <ellipse cx="144" cy="196" rx="60" ry="66" fill="#F4C88A" />
                    <ellipse cx="113" cy="176" rx="17" ry="12" fill="white" />
                    <ellipse cx="115" cy="177" rx="8" ry="8" fill="#3A1A08" />
                    <ellipse cx="175" cy="176" rx="17" ry="12" fill="white" />
                    <ellipse cx="177" cy="177" rx="8" ry="8" fill="#3A1A08" />
                  </g>
                </svg>
              </div>
            </div>

            <div className="flex-1 text-left relative z-10">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#FFCE00", color: "#00305E" }}>NEU</span>
                <span className="text-[10px] text-white/40">AI Companion</span>
              </div>
              <p className="font-extrabold text-sm text-white">Chọn người đồng hành</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Lukas oder Emma · Chat auf Deutsch
              </p>
            </div>
            <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
          </motion.button>

          <div className="flex items-center justify-between mb-3">
            <span className="font-bold" style={{ color: "#0F172A" }}>Schnellzugang</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {QUICK.map(({ label, icon: Icon, path, color, bg }) => (
              <motion.button key={path} onClick={() => navigate(path)}
                className="flex flex-col items-center gap-2 py-4 rounded-[16px] bg-white"
                style={{ border: "1.5px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                whileTap={{ scale: 0.93 }}>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: "#0F172A" }}>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Recommended Lessons ──────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-5 mb-3">
            <span className="font-bold" style={{ color: "#0F172A" }}>Empfohlen für dich</span>
            <button className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#2D9CDB" }}>
              Alle <ChevronRight size={13} />
            </button>
          </div>

          {/* Swipeable snap-scroll track */}
          <div
            ref={lessonScrollRef}
            onScroll={handleLessonScroll}
            className="flex pb-3 overflow-x-auto"
            style={{
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x mandatory",
              gap: 12,
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            {LESSONS.map((l, idx) => (
              <motion.div
                key={l.id}
                className="flex-shrink-0 rounded-[20px] overflow-hidden bg-white"
                style={{
                  width: "84vw",
                  maxWidth: 340,
                  scrollSnapAlign: "start",
                  border: "1.5px solid #E2E8F0",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
                }}
                animate={{
                  scale: activeLesson === idx ? 1 : 0.95,
                  opacity: activeLesson === idx ? 1 : 0.72,
                }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/lesson")}
              >
                {/* Card top color block */}
                <div className="p-4 pb-3" style={{ background: l.bg }}>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ background: l.tagColor }}
                    >
                      {l.tag}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(255,255,255,0.75)", color: "#00305E" }}
                    >
                      {l.level}
                    </span>
                  </div>
                  <p className="font-bold text-base leading-snug" style={{ color: "#0F172A" }}>
                    {l.title}
                  </p>
                </div>

                {/* Card bottom */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94A3B8" }}>
                    <Clock size={12} />
                    <span>{l.duration}</span>
                  </div>
                  <motion.div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: "#00305E", color: "#FFCE00" }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <Play size={11} fill="#FFCE00" />
                    Start
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {LESSONS.map((_, i) => (
              <motion.div
                key={i}
                className="rounded-full"
                animate={{
                  width: activeLesson === i ? 18 : 6,
                  background: activeLesson === i ? "#00305E" : "#D1D5DB",
                }}
                style={{ height: 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            ))}
          </div>
        </div>

        {/* ── Weekly Chart ─────────────────────────────────────────── */}
        <div className="px-5 mb-6">
          <div className="bg-white rounded-[20px] p-5"
            style={{ border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold" style={{ color: "#0F172A" }}>Woche</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>250 Min. total</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: "#EBF2FA" }}>
                <BarChart2 size={12} style={{ color: "#00305E" }} />
                <span className="text-xs font-bold" style={{ color: "#00305E" }}>Min/Tag</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weeklyData} barSize={24} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F0F4F8", radius: 6 }} />
                <Bar
                  dataKey="v"
                  radius={[6, 6, 0, 0]}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    return (
                      <rect
                        x={x} y={y} width={width} height={height}
                        fill={payload.day === "Sa" ? "#FFCE00" : "#00305E"}
                        rx={6} ry={6}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Admin shortcut ────────────────────────────────────────── */}
        <div className="px-5 pb-2">
          {/* Meet your Tutor card */}
          <motion.button
            onClick={() => navigate("/tutor")}
            className="w-full flex items-center gap-4 p-4 rounded-[20px] mb-3 overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, #00305E 0%, #0052A0 100%)",
              boxShadow: "0 4px 16px rgba(0,48,94,0.22)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Decorative circle */}
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full"
              style={{ background: "rgba(255,206,0,0.07)" }} />

            <div className="w-14 h-14 rounded-[16px] flex-shrink-0 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
              {/* Mini character preview */}
              <svg viewBox="80 140 220 200" xmlns="http://www.w3.org/2000/svg"
                style={{ width: "100%", height: "100%" }}>
                <ellipse cx="188" cy="158" rx="60" ry="58" fill="#1A1A2E" />
                <ellipse cx="188" cy="204" rx="56" ry="62" fill="#F5C89A" />
                <rect x="146" y="180" width="40" height="24" rx="8" fill="rgba(196,220,242,0.18)" />
                <rect x="190" y="180" width="40" height="24" rx="8" fill="rgba(196,220,242,0.18)" />
                <rect x="146" y="180" width="40" height="24" rx="8" fill="none" stroke="#1A1A2E" strokeWidth="2.8" />
                <rect x="190" y="180" width="40" height="24" rx="8" fill="none" stroke="#1A1A2E" strokeWidth="2.8" />
                <path d="M 144,270 C 120,280 100,310 94,342 L 84,400 L 292,400 L 282,342 C 276,310 256,280 232,270 Z" fill="#2C2C3A" />
              </svg>
            </div>

            <div className="flex-1 text-left relative z-10">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#FFCE00", color: "#00305E" }}>
                  KI-TUTOR
                </span>
              </div>
              <p className="font-extrabold text-white text-sm">Kai Müller</p>
              <p className="text-xs text-white/60">Senior Dev · Berlin · 4.9 ★</p>
            </div>
            <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
          </motion.button>

          <button onClick={() => navigate("/admin")}
            className="w-full flex items-center gap-3 p-4 rounded-[16px]"
            style={{ background: "white", border: "1.5px solid #E2E8F0" }}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ background: "#EBF2FA" }}>
              <ShieldCheck size={18} style={{ color: "#00305E" }} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>Admin-Dashboard</p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>System & Nutzerverwaltung</p>
            </div>
            <ChevronRight size={16} style={{ color: "#94A3B8" }} />
          </button>

          {/* Web Dashboard shortcut */}
          <button onClick={() => navigate("/web")}
            className="w-full flex items-center gap-3 p-4 rounded-[16px] mt-2"
            style={{ background: "linear-gradient(135deg, #00305E, #004898)", border: "1.5px solid rgba(45,156,219,0.3)" }}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ background: "rgba(255,206,0,0.15)" }}>
              <Monitor size={18} style={{ color: "#FFCE00" }} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm text-white">Web Dashboard</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Desktop-Erlebnis · Vollbild-KI</p>
            </div>
            <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>
      </div>

      <BottomNav />
      <NotificationDrawer open={showNotifs} onClose={() => setShowNotifs(false)} />
    </div>
  );
}