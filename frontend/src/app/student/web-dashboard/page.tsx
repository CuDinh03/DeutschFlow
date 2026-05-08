'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, TrendingUp, Users, Mic, Layers, BookOpen, Map,
  Gamepad2, Settings, Bell, ChevronRight, Play, Clock, Flame,
  Trophy, Target, Zap, Star, BarChart2, LogOut, Search, Filter,
  Check, X, RefreshCcw, Send, Sparkles, Brain, Award, Shield,
  ArrowUpRight, Activity, UserCheck, ChevronDown, Moon, Sun,
  MessageSquare, Globe, Volume2, PenLine, CheckCircle2,
} from "lucide-react";

import { PERSONA_TOKENS, PERSONA_LIST, PersonaId } from "@/lib/personas";
import { LukasCharacter } from "@/components/characters/LukasCharacter";
import { EmmaCharacter } from "@/components/characters/EmmaCharacter";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  navy: "#121212", navyDark: "#000000", navyLight: "#EBF2FA",
  blue: "#2D9CDB", blueLight: "#EBF5FB",
  yellow: "#FFCD00", yellowLight: "#FFF8E1",
  green: "#27AE60", greenLight: "#E8F8F0",
  red: "#EB5757", redLight: "#FDEAEA",
  purple: "#9B51E0", purpleLight: "#F4EDFF",
  orange: "#F2994A", orangeLight: "#FEF3E8",
  teal: "#00BFA5",
  bg: "#F0F4F8", card: "#FFFFFF",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────
const WEEKLY = [
  { day: "Mo", min: 25, xp: 180 }, { day: "Di", min: 40, xp: 320 },
  { day: "Mi", min: 15, xp: 95 }, { day: "Do", min: 55, xp: 440 },
  { day: "Fr", min: 35, xp: 260 }, { day: "Sa", min: 60, xp: 510 },
  { day: "So", min: 20, xp: 140 },
];

const MONTHLY_AREA = [
  { m: "Okt", active: 210, new: 45 }, { m: "Nov", active: 235, new: 52 },
  { m: "Dez", active: 280, new: 68 }, { m: "Jan", active: 312, new: 81 },
  { m: "Feb", active: 298, new: 74 }, { m: "Mär", active: 340, new: 95 },
  { m: "Apr", active: 378, new: 112 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Custom SVG Charts
// ─────────────────────────────────────────────────────────────────────────────
function WeeklyBarChart({ data }: { data: typeof WEEKLY }) {
  const VW = 280; const VH = 120; const LH = 18;
  const maxVal = Math.max(...data.map(d => d.min));
  const barW = 28;
  const slotW = VW / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH + LH}`} style={{ overflow: "visible" }}>
      {data.map((entry, i) => {
        const barH = Math.max(6, (entry.min / maxVal) * (VH - 12));
        const cx = slotW * i + slotW / 2;
        return (
          <g key={i}>
            <rect
              x={cx - barW / 2} y={VH - barH} width={barW} height={barH}
              rx={6} fill={entry.day === "Sa" ? P.yellow : P.navy}
            />
            <text x={cx} y={VH + 13} textAnchor="middle"
              fill={P.muted} fontSize={10} fontFamily="Inter,sans-serif">
              {entry.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyAreaChart({ data }: { data: typeof MONTHLY_AREA }) {
  const VW = 400; const VH = 100; const LH = 18;
  const n = data.length;
  const xStep = VW / (n - 1);
  const maxA = Math.max(...data.map(d => d.active));
  const sy = (v: number) => VH - (v / maxA) * (VH - 8);
  const ptA = data.map((d, i) => ({ x: i * xStep, y: sy(d.active) }));
  const ptN = data.map((d, i) => ({ x: i * xStep, y: sy(d.new) }));
  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const area = (pts: { x: number; y: number }[]) =>
    `${line(pts)} L ${pts[n - 1].x},${VH} L 0,${VH} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH + LH}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="svgGradActive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.navy} stopOpacity={0.28} />
          <stop offset="100%" stopColor={P.navy} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="svgGradNew" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.yellow} stopOpacity={0.35} />
          <stop offset="100%" stopColor={P.yellow} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area(ptA)} fill="url(#svgGradActive)" />
      <path d={line(ptA)} fill="none" stroke={P.navy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={area(ptN)} fill="url(#svgGradNew)" />
      <path d={line(ptN)} fill="none" stroke={P.yellow} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <text key={i} x={i * xStep} y={VH + 13} textAnchor="middle"
          fill={P.muted} fontSize={10} fontFamily="Inter,sans-serif">
          {d.m}
        </text>
      ))}
    </svg>
  );
}

const LESSONS = [
  { id: 1, title: "Der Weg zur Arbeit", level: "A2", duration: "8 min", tag: "Weiter", tagColor: P.navy, xp: 250 },
  { id: 2, title: "German Greetings & Small Talk", level: "A1", duration: "12 min", tag: "Beliebt", tagColor: P.green, xp: 180 },
  { id: 3, title: "Café & Restaurant Deutsch", level: "A2", duration: "15 min", tag: "Neu", tagColor: P.orange, xp: 300 },
  { id: 4, title: "Präteritum & Konjunktiv", level: "B1", duration: "22 min", tag: "Fortgesch.", tagColor: P.purple, xp: 420 },
  { id: 5, title: "Berliner Alltagssprache", level: "B1", duration: "18 min", tag: "Neu", tagColor: P.teal, xp: 380 },
];

const ACHIEVEMENTS = [
  { label: "Wortschatz Held", icon: BookOpen, color: P.yellow, done: true },
  { label: "7-Tage Streak", icon: Flame, color: P.orange, done: true },
  { label: "Erste B1 Lektion", icon: Trophy, color: P.purple, done: false },
  { label: "AI Meister", icon: Sparkles, color: P.blue, done: false },
];

const USERS = [
  { id: "U01", name: "Nguyen Thi Mai", av: "NM", level: "B1", tokens: 8450, ai: 890, vocab: 650, active: true, streak: 23, progress: 78 },
  { id: "U02", name: "Tran Van Minh", av: "TM", level: "A2", tokens: 9120, ai: 445, vocab: 320, active: true, streak: 7, progress: 45 },
  { id: "U03", name: "Le Hoang Nam", av: "LN", level: "A1", tokens: 9780, ai: 120, vocab: 145, active: true, streak: 3, progress: 22 },
  { id: "U04", name: "Pham Thi Lan", av: "PL", level: "B2", tokens: 6230, ai: 1890, vocab: 920, active: true, streak: 45, progress: 91 },
  { id: "U05", name: "Vo Duc Khoa", av: "VK", level: "A2", tokens: 7890, ai: 560, vocab: 410, active: false, streak: 0, progress: 38 },
];

type View = "learning" | "users" | "ai" | "persona" | "profile";

export default function WebDashboardPage() {
  const [activeView, setActiveView] = useState<View>("learning");
  const [lang, setLang] = useState<"vi" | "de">("vi");
  const [notifications, setNotifications] = useState(false);
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F0F4F8] pt-16 pl-[72px]">
      
      {/* ── Top Navigation ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 h-16 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10"
      >
        <div className="flex items-center gap-2.5 mr-8 flex-shrink-0 cursor-pointer" onClick={() => router.push('/student')}>
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-[#FFCD00]">
            <span className="text-sm">🇩🇪</span>
          </div>
          <span className="font-black text-white text-lg tracking-tight">Deutsch<span style={{ color: P.yellow }}>Flow</span></span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {[
            { id: "learning", label: "Tiến độ", icon: TrendingUp },
            { id: "users",    label: "Người dùng",    icon: Users },
            { id: "ai",       label: "Trạm AI",       icon: Mic },
            { id: "persona",  label: "Nhân vật",  icon: Sparkles },
            { id: "profile",  label: "Hồ sơ",  icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as View)}
              className={`flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all relative ${activeView === id ? 'text-[#FFCD00] bg-[#FFCD00]/15' : 'text-white/60 hover:text-white'}`}
            >
              <Icon size={15} />
              <span className="text-sm whitespace-nowrap">{label}</span>
              {activeView === id && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-[10px] border border-[#FFCD00]/25 bg-[#FFCD00]/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setLang(lang === "vi" ? "de" : "vi")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/85 border border-white/20"
          >
            {lang === "vi" ? "🇩🇪 Deutsch" : "🇻🇳 Tiếng Việt"}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFCD00]/15 border border-[#FFCD00]/25">
            <Flame size={13} className="text-orange-400 fill-orange-500" />
            <span className="text-sm font-bold text-[#FFCD00]">14</span>
          </div>
          <button
            className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all ${notifications ? 'bg-[#FFCD00]' : 'bg-white/10'}`}
            onClick={() => setNotifications(!notifications)}
          >
            <Bell size={16} className={notifications ? 'text-[#121212]' : 'text-white/70'} />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black bg-[#EB5757] text-white border-2 border-[#121212]">3</span>
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-br from-[#2D9CDB] to-[#00BFA5] text-white">
            HC
          </div>
        </div>
      </header>

      {/* ── Left Sidebar ── */}
      <aside
        className="fixed left-0 top-16 bottom-0 w-[72px] flex flex-col items-center py-6 z-40 bg-[#121212] border-r border-white/10"
      >
        <div className="flex flex-col gap-2 flex-1">
          {[
            { id: "learning", icon: LayoutDashboard, label: "Dashboard" },
            { id: "users",    icon: Users,           label: "Người dùng" },
            { id: "ai",       icon: Mic,             label: "AI Chat" },
            { id: "persona",  icon: Sparkles,        label: "Nhân vật" },
            { id: "profile",  icon: Settings,        label: "Hồ sơ" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as View)}
              className={`w-12 h-12 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${activeView === id ? 'bg-[#FFCD00] text-[#121212]' : 'text-white/45 hover:text-white'}`}
              title={label}
            >
              <Icon size={18} />
              <span className="text-[9px]">{label}</span>
            </button>
          ))}
        </div>
        <button
          className="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center gap-1 text-white/30"
          title="Đăng xuất"
        >
          <LogOut size={16} />
          <span className="text-[9px]">Thoát</span>
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="p-8 max-w-[1400px] mx-auto">
        <AnimatePresence mode="wait">
          {activeView === "learning" && (
            <motion.div
              key="learning"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="grid gap-6 grid-cols-12"
            >
              {/* Hero: Continue Learning */}
              <div className="col-span-8 rounded-[24px] p-8 relative overflow-hidden bg-gradient-to-br from-[#121212] to-[#004898] shadow-2xl">
                <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-[#FFCD00] text-[#121212]">TIẾP TỤC HỌC</span>
                    <span className="text-white/40 text-xs">Chương 4 · A2</span>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2">Der Weg zur Arbeit</h2>
                  <p className="text-white/50 text-sm mb-6">Quá khứ & Chỉ đường · còn 8 phút</p>
                  
                  <div className="max-w-md mb-8">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-white/60 font-bold uppercase tracking-wider">Tiến độ</span>
                      <span className="text-xs font-black text-[#FFCD00]">68%</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10">
                      <motion.div className="h-full rounded-full bg-[#FFCD00]"
                        initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ duration: 1.5, ease: "easeOut" }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 px-8 py-4 rounded-[16px] font-black text-base bg-[#FFCD00] text-[#121212] shadow-[0_4px_0_#C9A200] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all">
                      <Play size={18} fill="#121212" /> TIẾP TỤC
                    </button>
                    <div className="flex items-center gap-2 text-white/40 font-bold">
                      <Zap size={16} /> <span>+250 XP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats & Goals */}
              <div className="col-span-4 space-y-6">
                <div className="bg-white rounded-[24px] p-6 border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Target size={18} className="text-[#121212]" />
                      <span className="font-black text-[#0F172A]">MỤC TIÊU NGÀY</span>
                    </div>
                    <span className="text-sm font-black px-3 py-1 rounded-full bg-[#EBF2FA] text-[#121212]">3/4</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "Luyện từ vựng", curr: 18, total: 20, color: P.yellow },
                      { label: "Hoàn thành bài học", curr: 1, total: 1, color: P.green },
                      { label: "Luyện phát âm", curr: 5, total: 10, color: P.blue },
                    ].map(({ label, curr, total, color }) => (
                      <div key={label}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#64748B]">{label}</span>
                          <span className="text-[10px] font-black" style={{ color: curr >= total ? P.green : P.muted }}>{curr}/{total}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F1F5F9]">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(curr/total)*100}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Streak", val: "14", unit: "Ngày", color: "#F97316", icon: Flame },
                    { label: "XP Tổng", val: "1.240", unit: "", color: P.yellow, icon: Trophy },
                  ].map(({ label, val, unit, color, icon: Icon }) => (
                    <div key={label} className="bg-white rounded-[20px] p-5 border border-[#E2E8F0] shadow-sm">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: color + '15' }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#0F172A]">{val}</span>
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase">{unit}</span>
                      </div>
                      <p className="text-[11px] font-bold text-[#64748B] mt-1 uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Chart */}
              <div className="col-span-8 bg-white rounded-[24px] p-6 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-black text-[#0F172A]">HOẠT ĐỘNG TRONG TUẦN</h3>
                    <p className="text-xs text-[#94A3B8]">250 phút · 1.945 XP tuần này</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-[#F1F5F9] rounded-xl">
                    {['Min', 'XP'].map((t, i) => (
                      <button key={t} className={`px-4 py-1.5 rounded-[10px] text-xs font-bold transition-all ${i === 0 ? 'bg-white text-[#121212] shadow-sm' : 'text-[#64748B]'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="h-[180px]">
                  <WeeklyBarChart data={WEEKLY} />
                </div>
              </div>

              {/* Achievements */}
              <div className="col-span-4 bg-white rounded-[24px] p-6 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Award size={18} className="text-[#121212]" />
                  <span className="font-black text-[#0F172A]">THÀNH TÍCH</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ACHIEVEMENTS.map(({ label, icon: Icon, color, done }) => (
                    <div key={label} className={`p-4 rounded-[20px] border-2 transition-all ${done ? 'border-transparent' : 'border-[#F1F5F9] opacity-50'}`} style={{ backgroundColor: done ? color + '10' : '#F8FAFC' }}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${done ? '' : 'bg-[#E2E8F0]'}`} style={{ backgroundColor: done ? color + '20' : '' }}>
                        <Icon size={20} style={{ color: done ? color : '#94A3B8' }} />
                      </div>
                      <p className="text-[11px] font-black leading-tight text-[#0F172A]">{label.toUpperCase()}</p>
                      {done && <span className="text-[9px] font-black mt-1 block" style={{ color }}>ĐÃ MỞ KHÓA</span>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === "users" && (
             <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
             >
               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black text-[#121212]">QUẢN LÝ NGƯỜI DÙNG</h2>
                 <div className="flex gap-3">
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
                     <input type="text" placeholder="Tìm người dùng..." className="pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:border-[#121212] transition-all w-64 shadow-sm" />
                   </div>
                   <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#121212] text-[#FFCD00] font-black text-sm shadow-lg shadow-[#121212]/20">
                     <Users size={16} /> THÊM MỚI
                   </button>
                 </div>
               </div>

               <div className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                 <table className="w-full text-left">
                   <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                     <tr>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Người dùng</th>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Trình độ</th>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Tokens</th>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Tiến độ</th>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest">Trạng thái</th>
                       <th className="px-6 py-4 text-[10px] font-black text-[#64748B] uppercase tracking-widest"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F1F5F9]">
                     {USERS.map((u) => (
                       <tr key={u.id} className="hover:bg-[#F8FAFC] transition-colors">
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-[#121212]/10 flex items-center justify-center font-black text-[#121212] text-xs">{u.av}</div>
                             <div>
                               <p className="font-bold text-[#0F172A] text-sm">{u.name}</p>
                               <p className="text-[10px] text-[#94A3B8]">ID: {u.id}</p>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className="px-3 py-1 rounded-full bg-[#EBF2FA] text-[#121212] text-[10px] font-black">{u.level}</span>
                         </td>
                         <td className="px-6 py-4">
                           <p className="font-bold text-[#0F172A] text-sm">{u.tokens.toLocaleString()}</p>
                           <p className="text-[10px] text-[#94A3B8]">{u.ai} msgs</p>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             <div className="w-24 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                               <div className="h-full bg-[#2D9CDB]" style={{ width: `${u.progress}%` }} />
                             </div>
                             <span className="text-[10px] font-black text-[#64748B]">{u.progress}%</span>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1 text-[10px] font-black ${u.active ? 'text-[#27AE60]' : 'text-[#94A3B8]'}`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-[#27AE60]' : 'bg-[#94A3B8]'}`} />
                             {u.active ? 'HOẠT ĐỘNG' : 'NGOẠI TUYẾN'}
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <button className="p-2 text-[#94A3B8] hover:text-[#121212] transition-colors"><ChevronRight size={18} /></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
