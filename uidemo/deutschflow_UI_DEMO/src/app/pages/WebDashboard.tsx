// ─────────────────────────────────────────────────────────────────────────────
// DeutschFlow · Web Dashboard  (/web)
// Desktop-first experience: Persistent TopNav + Fixed Left Sidebar
// Views: Learning Progress · User Management · AI Workstation · Persona · Profile
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, TrendingUp, Users, Mic, Layers, BookOpen, Map,
  Gamepad2, Settings, Bell, ChevronRight, Play, Clock, Flame,
  Trophy, Target, Zap, Star, BarChart2, LogOut, Search, Filter,
  Check, X, RefreshCcw, Send, Sparkles, Brain, Award, Shield,
  ArrowUpRight, Activity, UserCheck, ChevronDown, Moon, Sun,
  MessageSquare, Globe, Volume2, PenLine, CheckCircle2,
} from "lucide-react";
// recharts removed — custom SVG charts avoid internal duplicate-key bug

import { PERSONA_TOKENS, PERSONA_LIST, PersonaId } from "../lib/personas";
import { LukasCharacter } from "../components/characters/LukasCharacter";
import { EmmaCharacter } from "../components/characters/EmmaCharacter";
import { ChatBubble } from "../components/chat/ChatBubble";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { useLanguage, Lang } from "../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  navy: "#00305E", navyDark: "#002447", navyLight: "#EBF2FA",
  blue: "#2D9CDB", blueLight: "#EBF5FB",
  yellow: "#FFCE00", yellowLight: "#FFF8E1",
  green: "#27AE60", greenLight: "#E8F8F0",
  red: "#EB5757", redLight: "#FDEAEA",
  purple: "#9B51E0", purpleLight: "#F4EDFF",
  orange: "#F2994A", orangeLight: "#FEF3E8",
  teal: "#00BFA5",
  bg: "#F0F4F8", card: "#FFFFFF",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
};

const glass = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const glassDark = {
  background: "rgba(0,30,60,0.45)",
  backdropFilter: "blur(32px) saturate(180%)",
  WebkitBackdropFilter: "blur(32px) saturate(180%)",
  border: "1px solid rgba(45,156,219,0.18)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Translations (VI / DE)
// ─────────────────────────────────────────────────────────────────────────────
const WD_T = {
  de: {
    langBtn: "🇻🇳 Tiếng Việt",
    nav: { learning: "Learning Progress", users: "User Management", ai: "AI Workstation", persona: "Persona Selection", profile: "Profile Settings" },
    sidebar: { dashboard: "Dashboard", users: "Nutzer", chat: "KI Chat", persona: "Persona", profile: "Profil", logout: "Abmelden", exit: "Exit" },
    views: {
      learning: { title: "Learning Dashboard", sub: "Dein persönlicher Lernfortschritt & Aktivitäten" },
      users: { title: "User Management", sub: "Nutzerverwaltung & Lernstatistiken" },
      persona: { title: "Persona Selection", sub: "Wähle deinen idealen KI-Lernbegleiter" },
      profile: { title: "Profile Settings", sub: "Persönliche Einstellungen & Präferenzen" },
    },
    continueLearning: "▶ Weiter lernen",
    chapterLabel: "Kapitel 4 · A2",
    progress: "Fortschritt",
    timeLeft: "8 Min. übrig",
    lessonOf: "Lektion 4 von 6",
    continueBtn: "Fortsetzen",
    xpAfterComplete: "+250 XP nach Abschluss",
    lessonLabel: "Lektion",
    exercisesLabel: "Übungen",
    scoreLabel: "Score",
    dailyGoals: "Tagesziele",
    goals: ["Vokabeln üben", "Lektion abschließen", "Aussprache", "Hörübung"],
    stats: {
      labels: ["Gesamt XP", "Streak", "Vokabeln", "Niveau"],
      deltas: ["+180 heute", "Neuer Rekord!", "+12 diese Woche", "78% zu B1"],
    },
    weeklyActivity: "Wochenaktivität",
    weeklySubtitle: "250 Min. · 1.945 XP diese Woche",
    achievements: "Achievements",
    achievementItems: ["Wortschatz Held", "7-Tage Streak", "Erste B1 Lektion", "AI Meister"],
    unlocked: "✓ Freigeschaltet",
    recommendedLessons: "Empfohlene Lektionen",
    viewAll: "Alle anzeigen",
    lessonTagMap: { Weiter: "Weiter", Beliebt: "Beliebt", Neu: "Neu", "Fortgesch.": "Fortgesch." } as Record<string,string>,
    totalUsers: "Gesamt Nutzer", activeUsers: "Aktive Nutzer", avgStreak: "Ø Streak", avgProgress: "Ø Fortschritt",
    userGrowth: "Nutzer Wachstum", activeVsNew: "Aktive vs. Neue Nutzer", levelDist: "Niveau-Verteilung",
    searchUsers: "Nutzer suchen...", all: "Alle", active: "Aktiv", inactive: "Inaktiv",
    totalProgress: "Gesamtfortschritt", dayStreak: "Tage Streak 🔥", offline: "Offline",
    vocabLabel: "Vokabeln", aiMsgs: "AI Msgs", tokens: "Tokens",
    grammarAnalysis: "Grammatik-Analyse", dictionary: "Wörterbuch", exercises: "Übungen",
    enterText: "Deutschen Text eingeben", analyze: "Analysieren",
    grammarBreakdown: "Grammatik-Aufschlüsselung", keyVocab: "Schlüsselvokabeln",
    wordTypes: { maskulin: "Maskulin (der)", feminin: "Feminin (die)", neutrum: "Neutrum (das)", verb: "Verb", prep: "Präposition", pronoun: "Pronomen" },
    thinking: "denkt nach...", typing: "tippt gerade...",
    writeTo: (name: string) => `Schreib auf Deutsch an ${name}...`,
    chooseCompanion: "Wähle deinen KI-Begleiter",
    companionSub: "Jeder Begleiter hat seinen eigenen Lernstil und Persönlichkeit",
    lukasTraits: ["Grammatik", "Code-Analogien", "Strukturiert", "Präzise"],
    emmaTraits: ["Kultur", "Berliner Flair", "Kreativ", "Motivierend"],
    selected: (name: string) => `✓ ${name} gewählt`,
    selectBtn: (name: string) => `${name} wählen`,
    personalInfo: "Persönliche Informationen", learningSettings: "Lerneinstellungen", appSettings: "App-Einstellungen",
    fields: { firstname: "Vorname", lastname: "Nachname", email: "E-Mail", native: "Muttersprache", level: "Deutschniveau", daily: "Tägliches Lernziel (Min.)", speed: "Lerngeschwindigkeit" },
    notifLabel: "Benachrichtigungen", notifDesc: "Tägliche Lern-Erinnerungen",
    darkMode: "Dunkelmodus", darkModeDesc: "Augenschonende Ansicht",
    changePhoto: "Foto ändern", saveSettings: "Einstellungen speichern",
    continueLesson: "Lektion fortsetzen", addUser: "Nutzer hinzufügen",
    notifications: "Benachrichtigungen",
    notifs: [
      { title: "Streak-Erinnerung 🔥", desc: "Du hast heute noch nicht geübt! Halte deinen 14-Tage-Streak.", time: "vor 10 Min." },
      { title: "Neue Lektion verfügbar 📚", desc: "Kapitel 5: Am Bahnhof ist jetzt freigeschaltet.", time: "vor 2 Std." },
      { title: "Achievement freigeschaltet 🏆", desc: "Du hast '7-Tage Streak' verdient!", time: "gestern" },
    ],
  },
  vi: {
    langBtn: "🇩🇪 Deutsch",
    nav: { learning: "Tiến độ học tập", users: "Quản lý người dùng", ai: "Trạm AI", persona: "Chọn nhân vật", profile: "Cài đặt hồ sơ" },
    sidebar: { dashboard: "Bảng điều khiển", users: "Người dùng", chat: "Chat AI", persona: "Nhân vật", profile: "Hồ sơ", logout: "Đăng xuất", exit: "Thoát" },
    views: {
      learning: { title: "Bảng học tập", sub: "Tiến độ học tập cá nhân & hoạt động của bạn" },
      users: { title: "Quản lý người dùng", sub: "Quản lý người dùng & thống kê học tập" },
      persona: { title: "Chọn nhân vật AI", sub: "Chọn trợ lý AI học tập lý tưởng của bạn" },
      profile: { title: "Cài đặt hồ sơ", sub: "Cài đặt cá nhân & tuỳ chọn" },
    },
    continueLearning: "▶ Tiếp tục học",
    chapterLabel: "Chương 4 · A2",
    progress: "Tiến độ",
    timeLeft: "còn 8 phút",
    lessonOf: "Bài 4 / 6",
    continueBtn: "Tiếp tục",
    xpAfterComplete: "+250 XP khi hoàn thành",
    lessonLabel: "Bài học",
    exercisesLabel: "Bài tập",
    scoreLabel: "Điểm",
    dailyGoals: "Mục tiêu ngày",
    goals: ["Luyện từ vựng", "Hoàn thành bài học", "Phát âm", "Nghe hiểu"],
    stats: {
      labels: ["Tổng XP", "Chuỗi ngày", "Từ vựng", "Trình độ"],
      deltas: ["+180 hôm nay", "Kỷ lục mới!", "+12 tuần này", "78% đến B1"],
    },
    weeklyActivity: "Hoạt động trong tuần",
    weeklySubtitle: "250 phút · 1.945 XP tuần này",
    achievements: "Thành tích",
    achievementItems: ["Anh hùng từ vựng", "Chuỗi 7 ngày", "Bài B1 đầu tiên", "Bậc thầy AI"],
    unlocked: "✓ Đã mở khóa",
    recommendedLessons: "Bài học được đề xuất",
    viewAll: "Xem tất cả",
    lessonTagMap: { Weiter: "Tiếp tục", Beliebt: "Phổ biến", Neu: "Mới", "Fortgesch.": "Nâng cao" } as Record<string,string>,
    totalUsers: "Tổng người dùng", activeUsers: "Người dùng hoạt động", avgStreak: "Streak TB", avgProgress: "Tiến độ TB",
    userGrowth: "Tăng trưởng người dùng", activeVsNew: "Hoạt động vs. Người mới", levelDist: "Phân bổ trình độ",
    searchUsers: "Tìm người dùng...", all: "Tất cả", active: "Hoạt động", inactive: "Không hoạt động",
    totalProgress: "Tiến độ tổng", dayStreak: "ngày chuỗi 🔥", offline: "Ngoại tuyến",
    vocabLabel: "Từ vựng", aiMsgs: "AI Msgs", tokens: "Tokens",
    grammarAnalysis: "Phân tích ngữ pháp", dictionary: "Từ điển", exercises: "Bài tập",
    enterText: "Nhập văn bản tiếng Đức", analyze: "Phân tích",
    grammarBreakdown: "Phân tích chi tiết ngữ pháp", keyVocab: "Từ vựng chính",
    wordTypes: { maskulin: "Maskulin (der)", feminin: "Feminin (die)", neutrum: "Neutrum (das)", verb: "Động từ", prep: "Giới từ", pronoun: "Đại từ" },
    thinking: "đang suy nghĩ...", typing: "đang nhắn tin...",
    writeTo: (name: string) => `Viết tiếng Đức cho ${name}...`,
    chooseCompanion: "Chọn trợ lý AI của bạn",
    companionSub: "Mỗi trợ lý có phong cách học và tính cách riêng",
    lukasTraits: ["Ngữ pháp", "Tương tự Code", "Có cấu trúc", "Chính xác"],
    emmaTraits: ["Văn hóa", "Phong cách Berlin", "Sáng tạo", "Truyền cảm hứng"],
    selected: (name: string) => `✓ Đã chọn ${name}`,
    selectBtn: (name: string) => `Chọn ${name}`,
    personalInfo: "Thông tin cá nhân", learningSettings: "Cài đặt học tập", appSettings: "Cài đặt ứng dụng",
    fields: { firstname: "Tên", lastname: "Họ", email: "Email", native: "Tiếng mẹ đẻ", level: "Trình độ tiếng Đức", daily: "Mục tiêu học ngày (phút)", speed: "Tốc độ học" },
    notifLabel: "Thông báo", notifDesc: "Nhắc nhở học hàng ngày",
    darkMode: "Chế độ tối", darkModeDesc: "Bảo vệ mắt ban đêm",
    changePhoto: "Đổi ảnh", saveSettings: "Lưu cài đặt",
    continueLesson: "Tiếp tục bài học", addUser: "Thêm người dùng",
    notifications: "Thông báo",
    notifs: [
      { title: "Nhắc nhở học 🔥", desc: "Bạn chưa luyện tập hôm nay! Giữ chuỗi 14 ngày của bạn.", time: "10 phút trước" },
      { title: "Bài học mới 📚", desc: "Chương 5: Tại nhà ga đã được mở khóa.", time: "2 giờ trước" },
      { title: "Thành tích mới 🏆", desc: "Bạn đã đạt 'Chuỗi 7 ngày'!", time: "hôm qua" },
    ],
  },
} as const;

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
// Custom SVG Charts (replaces recharts to avoid internal duplicate-key warnings)
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

const GOALS = [
  { label: "Vokabeln üben", current: 18, total: 20, color: P.yellow },
  { label: "Lektion abschließen", current: 1, total: 1, color: P.green },
  { label: "Aussprache", current: 5, total: 10, color: P.blue },
  { label: "Hörübung", current: 2, total: 3, color: P.purple },
];

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
  { id: "U06", name: "Dang Thi Hoa", av: "DH", level: "B1", tokens: 5560, ai: 1200, vocab: 730, active: true, streak: 18, progress: 65 },
  { id: "U07", name: "Nguyen Minh Duc", av: "ND", level: "A2", tokens: 4320, ai: 340, vocab: 280, active: true, streak: 5, progress: 33 },
  { id: "U08", name: "Hoang Thu Huong", av: "HH", level: "B1", tokens: 7100, ai: 780, vocab: 590, active: false, streak: 0, progress: 55 },
];

const GERMAN_TEXT_SAMPLE = [
  { word: "Ich", type: "pronoun" }, { word: " " }, { word: "gehe", type: "verb" },
  { word: " heute " }, { word: "in", type: "prep" }, { word: " " },
  { word: "die", type: "feminin" }, { word: " " }, { word: "Schule", type: "feminin" },
  { word: ". " }, { word: "Der", type: "maskulin" }, { word: " " },
  { word: "Lehrer", type: "maskulin" }, { word: " erklärt " },
  { word: "das", type: "neutrum" }, { word: " " }, { word: "Grammatik", type: "neutrum" },
  { word: " " }, { word: "sehr", type: "" }, { word: " gut." },
];

const WORD_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  maskulin: { bg: "rgba(45,156,219,0.2)", color: P.blue, label: "der" },
  feminin:  { bg: "rgba(235,87,87,0.2)",  color: P.red,   label: "die" },
  neutrum:  { bg: "rgba(39,174,96,0.2)",  color: P.green, label: "das" },
  verb:     { bg: "rgba(155,81,224,0.2)", color: P.purple, label: "V" },
  prep:     { bg: "rgba(242,153,74,0.2)", color: P.orange, label: "Präp" },
  pronoun:  { bg: "rgba(0,191,165,0.2)",  color: P.teal,   label: "Pro" },
};

type View = "learning" | "users" | "ai" | "persona" | "profile";

interface ChatMsg { id: string; from: "user" | "ai"; text: string; }

// ─────────────────────────────────────────────────────────────────────────────
// Sub: Top Navigation Bar
// ─────────────────────────────────────────────────────────────────────────────
function TopNav({
  activeView, setActiveView, notifications, setNotifications, lang, onToggleLang,
}: {
  activeView: View;
  setActiveView: (v: View) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  lang: Lang;
  onToggleLang: () => void;
}) {
  const T = WD_T[lang];
  const NAV_ITEMS: { id: View; label: string; icon: any }[] = [
    { id: "learning", label: T.nav.learning, icon: TrendingUp },
    { id: "users",    label: T.nav.users,    icon: Users },
    { id: "ai",       label: T.nav.ai,       icon: Mic },
    { id: "persona",  label: T.nav.persona,  icon: Sparkles },
    { id: "profile",  label: T.nav.profile,  icon: Settings },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 h-16"
      style={{
        background: "rgba(0,48,94,0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,206,0,0.15)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-8 flex-shrink-0">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: P.yellow }}>
          <span className="text-sm">🇩🇪</span>
        </div>
        <span className="font-black text-white text-lg tracking-tight">Deutsch<span style={{ color: P.yellow }}>Flow</span></span>
      </div>

      {/* Nav Items */}
      <nav className="flex items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all relative"
            style={{
              background: activeView === id ? "rgba(255,206,0,0.15)" : "transparent",
              color: activeView === id ? P.yellow : "rgba(255,255,255,0.6)",
            }}
          >
            <Icon size={15} />
            <span className="text-sm whitespace-nowrap">{label}</span>
            {activeView === id && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-[10px]"
                style={{ background: "rgba(255,206,0,0.12)", border: "1px solid rgba(255,206,0,0.25)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          {WD_T[lang].langBtn}
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(255,206,0,0.15)", border: "1px solid rgba(255,206,0,0.25)" }}>
          <Flame size={13} className="text-orange-400" fill="#f97316" />
          <span className="text-sm font-bold" style={{ color: P.yellow }}>14</span>
        </div>
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-full transition-all"
          style={{ background: notifications ? P.yellow : "rgba(255,255,255,0.1)" }}
          onClick={() => setNotifications(!notifications)}
        >
          <Bell size={16} style={{ color: notifications ? P.navy : "rgba(255,255,255,0.7)" }} />
          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black"
            style={{ background: P.red, color: "white", border: "2px solid #00305E" }}>3</span>
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2D9CDB, #00BFA5)", color: "white" }}>
          HC
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub: Left Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function LeftSidebar({ activeView, setActiveView, lang }: { activeView: View; setActiveView: (v: View) => void; lang: Lang }) {
  const T = WD_T[lang].sidebar;
  const ITEMS: { id: View; icon: any; label: string }[] = [
    { id: "learning", icon: LayoutDashboard, label: T.dashboard },
    { id: "users",    icon: Users,           label: T.users },
    { id: "ai",       icon: Mic,             label: T.chat },
    { id: "persona",  icon: Sparkles,        label: T.persona },
    { id: "profile",  icon: Settings,        label: T.profile },
  ];

  return (
    <aside
      className="fixed left-0 top-16 bottom-0 w-[72px] flex flex-col items-center py-6 z-40"
      style={{
        background: P.navy,
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex flex-col gap-2 flex-1">
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              background: activeView === id ? P.yellow : "transparent",
              color: activeView === id ? P.navy : "rgba(255,255,255,0.45)",
            }}
            title={label}
          >
            <Icon size={18} />
            <span className="text-[9px]">{label}</span>
          </button>
        ))}
      </div>
      <button
        className="w-12 h-12 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all"
        style={{ color: "rgba(255,255,255,0.3)" }}
        title={WD_T[lang].sidebar.logout}
      >
        <LogOut size={16} />
        <span className="text-[9px]">{WD_T[lang].sidebar.exit}</span>
      </button>
    </aside>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// View: Learning Progress (Bento Grid)
// ─────────────────────────────────────────────────────────────────────────────
function LearningView() {
  const { lang } = useLanguage();
  const T = WD_T[lang];
  const GOALS_DATA = [
    { label: T.goals[0], current: 18, total: 20, color: P.yellow },
    { label: T.goals[1], current: 1,  total: 1,  color: P.green },
    { label: T.goals[2], current: 5,  total: 10, color: P.blue },
    { label: T.goals[3], current: 2,  total: 3,  color: P.purple },
  ];
  const ACHIEVEMENTS_DATA = [
    { label: T.achievementItems[0], icon: BookOpen, color: P.yellow, done: true },
    { label: T.achievementItems[1], icon: Flame,    color: P.orange, done: true },
    { label: T.achievementItems[2], icon: Trophy,   color: P.purple, done: false },
    { label: T.achievementItems[3], icon: Sparkles, color: P.blue,   done: false },
  ];
  const LESSONS_DATA = [
    { id: 1, title: "Der Weg zur Arbeit",             level: "A2", duration: "8 min",  tag: "Weiter",      tagColor: P.navy,   xp: 250 },
    { id: 2, title: "German Greetings & Small Talk",  level: "A1", duration: "12 min", tag: "Beliebt",     tagColor: P.green,  xp: 180 },
    { id: 3, title: "Café & Restaurant Deutsch",      level: "A2", duration: "15 min", tag: "Neu",         tagColor: P.orange, xp: 300 },
    { id: 4, title: "Präteritum & Konjunktiv",        level: "B1", duration: "22 min", tag: "Fortgesch.",  tagColor: P.purple, xp: 420 },
    { id: 5, title: "Berliner Alltagssprache",        level: "B1", duration: "18 min", tag: "Neu",         tagColor: P.teal,   xp: 380 },
  ];
  const done = GOALS_DATA.filter(g => g.current >= g.total).length;

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
      
      {/* Hero: Continue Lesson */}
      <motion.div
        className="col-span-8 rounded-[20px] p-6 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${P.navy} 0%, #004898 100%)`, boxShadow: "0 12px 40px rgba(0,48,94,0.35)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      >
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
        <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full" style={{ background: "rgba(255,206,0,0.06)" }} />
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: P.yellow, color: P.navy }}>{T.continueLearning}</span>
              <span className="text-white/40 text-xs">{T.chapterLabel}</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Der Weg zur Arbeit</h2>
            <p className="text-white/50 text-sm mb-5">Präteritum & Wegbeschreibungen · {T.timeLeft}</p>
            <div className="mb-5 max-w-sm">
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-white/60">{T.progress}</span>
                <span className="text-xs font-bold" style={{ color: P.yellow }}>68%</span>
              </div>
              <div className="h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                <motion.div className="h-full rounded-full" style={{ background: P.yellow }}
                  initial={{ width: 0 }} animate={{ width: "68%" }} transition={{ duration: 1.2, ease: "easeOut" }} />
              </div>
              <div className="flex gap-4 mt-2 text-white/40 text-xs">
                <span className="flex items-center gap-1"><Clock size={10} /> {T.timeLeft}</span>
                <span>{T.lessonOf}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                className="flex items-center gap-2 px-6 py-3 rounded-[14px] font-bold text-sm"
                style={{ background: P.yellow, color: P.navy, boxShadow: "0 4px 0 #C9A200" }}
                whileHover={{ y: -1 }} whileTap={{ y: 2, boxShadow: "none" }}>
                <Play size={14} fill={P.navy} /> {T.continueBtn}
              </motion.button>
              <div className="flex items-center gap-1.5 text-white/40 text-sm">
                <Zap size={13} /><span>{T.xpAfterComplete}</span>
              </div>
            </div>
          </div>
          <div className="ml-6 flex flex-col gap-2">
            {[
              { label: T.lessonLabel, val: "4/6" },
              { label: T.exercisesLabel, val: "12/18" },
              { label: T.scoreLabel, val: "94%" },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-[12px] px-4 py-3 text-center min-w-[90px]"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="font-black text-white">{val}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Daily Goals */}
      <motion.div className="col-span-4 rounded-[20px] p-5 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={16} style={{ color: P.navy }} />
            <span className="font-bold" style={{ color: P.text }}>{T.dailyGoals}</span>
          </div>
          <span className="font-black text-sm px-2.5 py-0.5 rounded-full"
            style={{ background: P.navyLight, color: P.navy }}>{done}/4</span>
        </div>
        <div className="space-y-3">
          {GOALS_DATA.map(({ label, current, total, color }) => {
            const pct = Math.min((current / total) * 100, 100);
            const isDone = current >= total;
            return (
              <div key={label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm" style={{ color: P.text }}>{label}</span>
                  <span className="text-xs font-bold" style={{ color: isDone ? P.green : P.muted }}>
                    {isDone ? <CheckCircle2 size={13} className="inline" /> : `${current}/${total}`}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: P.border }}>
                  <motion.div className="h-full rounded-full" style={{ background: color }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Stats Row */}
      {[
        { icon: Trophy, label: T.stats.labels[0], val: "1.240", color: P.yellow, bg: P.yellowLight, delta: T.stats.deltas[0] },
        { icon: Flame,  label: T.stats.labels[1], val: "14 Tage", color: "#F97316", bg: "#FFF7ED", delta: T.stats.deltas[1] },
        { icon: Brain,  label: T.stats.labels[2], val: "847",    color: P.blue,   bg: P.blueLight,   delta: T.stats.deltas[2] },
        { icon: Activity, label: T.stats.labels[3], val: "A2→B1", color: P.purple, bg: P.purpleLight, delta: T.stats.deltas[3] },
      ].map(({ icon: Icon, label, val, color, bg, delta }, i) => (
        <motion.div key={label} className="col-span-3 rounded-[16px] p-4 bg-white"
          style={{ border: `1.5px solid ${color}22`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: bg }}>
              <Icon size={18} style={{ color }} />
            </div>
            <ArrowUpRight size={14} style={{ color: P.green }} />
          </div>
          <p className="font-black text-xl" style={{ color: P.text }}>{val}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: P.muted }}>{label}</p>
          <p className="text-[11px] mt-1 font-medium" style={{ color }}>{delta}</p>
        </motion.div>
      ))}

      {/* Weekly Activity Chart */}
      <motion.div className="col-span-8 rounded-[20px] p-5 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold" style={{ color: P.text }}>{T.weeklyActivity}</p>
            <p className="text-xs" style={{ color: P.muted }}>{T.weeklySubtitle}</p>
          </div>
          <div className="flex gap-2">
            {["Min", "XP"].map((t, i) => (
              <button key={t} className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: i === 0 ? P.navy : P.border, color: i === 0 ? "white" : P.muted }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 160, paddingTop: 4 }}>
          <WeeklyBarChart data={WEEKLY} />
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div className="col-span-4 rounded-[20px] p-5 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-2 mb-4">
          <Award size={16} style={{ color: P.navy }} />
          <span className="font-bold" style={{ color: P.text }}>{T.achievements}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS_DATA.map(({ label, icon: Icon, color, done }) => (
            <div key={label} className="rounded-[14px] p-3 flex flex-col gap-2"
              style={{
                background: done ? `${color}12` : P.bg,
                border: `1.5px solid ${done ? color + "30" : P.border}`,
                opacity: done ? 1 : 0.6,
              }}>
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: done ? `${color}20` : P.border }}>
                <Icon size={16} style={{ color: done ? color : P.muted }} />
              </div>
              <p className="text-xs font-semibold leading-tight" style={{ color: done ? P.text : P.muted }}>{label}</p>
              {done && <span className="text-[10px] font-bold" style={{ color }}>{T.unlocked}</span>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recommended Lessons */}
      <motion.div className="col-span-12 rounded-[20px] p-5 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: P.navy }} />
            <span className="font-bold" style={{ color: P.text }}>{T.recommendedLessons}</span>
          </div>
          <button className="flex items-center gap-1 text-xs font-semibold" style={{ color: P.blue }}>
            {T.viewAll} <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {LESSONS_DATA.map((l) => (
            <motion.button key={l.id}
              className="rounded-[16px] overflow-hidden text-left bg-white"
              style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,48,94,0.12)" }}>
              <div className="p-3" style={{ background: P.navyLight }}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: l.tagColor }}>{T.lessonTagMap[l.tag] ?? l.tag}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "white", color: P.navy }}>{l.level}</span>
                </div>
                <p className="text-sm font-bold leading-snug" style={{ color: P.text }}>{l.title}</p>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs" style={{ color: P.muted }}>
                  <Clock size={11} /><span>{l.duration}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold" style={{ color: P.yellow }}>
                  <Zap size={11} /><span>+{l.xp}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: User Management
// ─────────────────────────────────────────────────────────────────────────────
function UserManagementView() {
  const { lang } = useLanguage();
  const T = WD_T[lang];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = USERS.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.level.includes(search);
    const matchFilter = filter === "all" || (filter === "active" ? u.active : !u.active);
    return matchSearch && matchFilter;
  });

  const LEVEL_COLOR: Record<string, string> = {
    A1: P.green, A2: P.blue, B1: P.purple, B2: P.orange,
  };

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: T.totalUsers,   val: "8",        icon: Users,      color: P.navy,   bg: P.navyLight },
          { label: T.activeUsers,  val: "6",        icon: UserCheck,  color: P.green,  bg: P.greenLight },
          { label: T.avgStreak,    val: "12,6 Tage",icon: Flame,      color: P.orange, bg: P.orangeLight },
          { label: T.avgProgress,  val: "53%",      icon: TrendingUp, color: P.blue,   bg: P.blueLight },
        ].map(({ label, val, icon: Icon, color, bg }) => (
          <motion.div key={label}
            className="rounded-[20px] p-5 bg-white"
            style={{ border: `1.5px solid ${color}22`, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: P.greenLight, color: P.green }}>↑ +2</span>
            </div>
            <p className="font-black text-2xl" style={{ color: P.text }}>{val}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: P.muted }}>{label}</p>
          </motion.div>
        ))}
      </div>

      {/* User Activity Chart */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div className="col-span-2 rounded-[20px] p-5 bg-white"
          style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold" style={{ color: P.text }}>{T.userGrowth}</p>
              <p className="text-xs" style={{ color: P.muted }}>{T.activeVsNew}</p>
            </div>
          </div>
          <div style={{ height: 140, paddingTop: 4 }}>
            <MonthlyAreaChart data={MONTHLY_AREA} />
          </div>
        </motion.div>

        {/* Level Distribution */}
        <motion.div className="rounded-[20px] p-5 bg-white"
          style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.06)" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <p className="font-bold mb-4" style={{ color: P.text }}>{T.levelDist}</p>
          <div className="space-y-3">
            {[
              { level: "A1", count: 1, total: 8, color: P.green },
              { level: "A2", count: 3, total: 8, color: P.blue },
              { level: "B1", count: 3, total: 8, color: P.purple },
              { level: "B2", count: 1, total: 8, color: P.orange },
            ].map(({ level, count, total, color }) => (
              <div key={level}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-bold" style={{ color }}>{level}</span>
                  <span className="text-xs" style={{ color: P.muted }}>{count}/{total}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: P.border }}>
                  <motion.div className="h-full rounded-full" style={{ background: color }}
                    initial={{ width: 0 }} animate={{ width: `${(count / total) * 100}%` }}
                    transition={{ duration: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: P.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={T.searchUsers}
            className="w-full pl-10 pr-4 py-2.5 rounded-[12px] text-sm outline-none"
            style={{ background: "white", border: `1.5px solid ${P.border}`, color: P.text }}
          />
        </div>
        {(["all", "active", "inactive"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
            style={{
              background: filter === f ? P.navy : "white",
              color: filter === f ? "white" : P.muted,
              border: `1.5px solid ${filter === f ? P.navy : P.border}`,
            }}>
            {f === "all" ? T.all : f === "active" ? T.active : T.inactive}
          </button>
        ))}
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filtered.map((u, i) => (
          <motion.div key={u.id}
            className="rounded-[20px] p-5 bg-white"
            style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(0,48,94,0.1)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                style={{ background: LEVEL_COLOR[u.level] + "22", color: LEVEL_COLOR[u.level], border: `2px solid ${LEVEL_COLOR[u.level]}40` }}>
                {u.av}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm" style={{ color: P.text }}>{u.name}</p>
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: u.active ? P.green : P.muted }} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: LEVEL_COLOR[u.level] + "18", color: LEVEL_COLOR[u.level] }}>{u.level}</span>
                  <span className="text-xs" style={{ color: P.muted }}>
                    {u.active ? `${u.streak} ${T.dayStreak}` : T.inactive}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: u.active ? P.greenLight : P.border, color: u.active ? P.green : P.muted }}>
                {u.active ? T.active : T.offline}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: P.muted }}>{T.totalProgress}</span>
                <span className="text-xs font-bold" style={{ color: P.text }}>{u.progress}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: P.border }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: LEVEL_COLOR[u.level] }}
                  initial={{ width: 0 }} animate={{ width: `${u.progress}%` }} transition={{ duration: 0.8 }} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { label: T.vocabLabel, val: u.vocab },
                  { label: T.aiMsgs,     val: u.ai },
                  { label: T.tokens,     val: `${(u.tokens / 1000).toFixed(1)}k` },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center rounded-[10px] py-2"
                    style={{ background: P.navyLight }}>
                    <p className="font-bold text-sm" style={{ color: P.navy }}>{val}</p>
                    <p className="text-[10px]" style={{ color: P.muted }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: AI Workstation (Split-screen + Glassmorphism)
// ─────────────────────────────────────────────────────────────────────────────
function AIWorkstationView({ selectedPersona }: { selectedPersona: PersonaId }) {
  const { lang } = useLanguage();
  const T = WD_T[lang];
  const p = PERSONA_TOKENS[selectedPersona];
  const CharComp = selectedPersona === "lukas" ? LukasCharacter : EmmaCharacter;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<"idle" | "thinking" | "streaming">("idle");
  const [replyIdx, setReplyIdx] = useState(0);
  const [analysisText, setAnalysisText] = useState("Ich gehe heute in die Schule. Der Lehrer erklärt das Grammatik sehr gut.");
  const [activeTab, setActiveTab] = useState<"analyze" | "vocab" | "exercises">("analyze");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => deliverAI(p.replies[0]), 600);
    return () => clearTimeout(t);
  }, [selectedPersona]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chatState]);

  const deliverAI = useCallback((text: string) => {
    setChatState("streaming");
    const id = Date.now().toString();
    setMessages(prev => [...prev, { id, from: "ai", text }]);
    setTimeout(() => setChatState("idle"), Math.max(2200, text.length * 28));
  }, []);

  const handleSend = () => {
    const t = input.trim();
    if (!t || chatState !== "idle") return;
    setMessages(prev => [...prev, { id: Date.now().toString(), from: "user", text: t }]);
    setInput("");
    setChatState("thinking");
    const next = (replyIdx + 1) % p.replies.length;
    setReplyIdx(next);
    setTimeout(() => deliverAI(p.replies[next]), 1400 + Math.random() * 600);
  };

  const renderAnalysisText = () => (
    <p className="text-lg leading-loose">
      {GERMAN_TEXT_SAMPLE.map((token, i) => {
        if (!token.type) return <span key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{token.word}</span>;
        const style = WORD_COLORS[token.type];
        if (!style) return <span key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{token.word}</span>;
        return (
          <span key={i} className="relative inline-block mx-0.5 px-1.5 py-0.5 rounded-[6px] cursor-pointer font-semibold"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}40` }}>
            {token.word}
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-black"
              style={{ color: style.color, opacity: 0.85 }}>{style.label}</span>
          </span>
        );
      })}
    </p>
  );

  return (
    <div className="flex h-full gap-5 min-h-[calc(100vh-140px)]"
      style={{ background: "linear-gradient(135deg, #030B18 0%, #050F22 50%, #060C1A 100%)" }}>

      {/* Ambient glows */}
      <div className="fixed pointer-events-none inset-0 z-0 overflow-hidden">
        <div className="absolute top-20 left-96 w-96 h-96 rounded-full"
          style={{ background: `${p.glow}`, filter: "blur(80px)", opacity: 0.2 }} />
        <div className="absolute bottom-20 right-96 w-80 h-80 rounded-full"
          style={{ background: "rgba(0,48,94,0.6)", filter: "blur(80px)", opacity: 0.4 }} />
      </div>

      {/* ── LEFT PANEL: German Tools ── */}
      <motion.div className="flex-1 flex flex-col gap-4 relative z-10 min-w-0"
        initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>

        {/* Tool Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-[14px]" style={glassDark}>
          {(["analyze", "vocab", "exercises"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-[10px] text-sm font-semibold transition-all"
              style={{
                background: activeTab === tab ? p.accent : "transparent",
                color: activeTab === tab ? (selectedPersona === "lukas" ? "white" : P.navy) : "rgba(255,255,255,0.5)",
              }}>
              {tab === "analyze" ? T.grammarAnalysis : tab === "vocab" ? T.dictionary : T.exercises}
            </button>
          ))}
        </div>

        {/* Text Input Area */}
        <div className="rounded-[20px] p-5 flex flex-col gap-3" style={glassDark}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenLine size={15} style={{ color: p.accent }} />
              <span className="text-sm font-bold text-white">{T.enterText}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: `${p.accent}22`, color: p.accent, border: `1px solid ${p.accent}40` }}>
                {T.analyze}
              </button>
            </div>
          </div>
          <textarea
            value={analysisText}
            onChange={e => setAnalysisText(e.target.value)}
            rows={3}
            className="w-full rounded-[14px] p-4 text-sm outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid rgba(255,255,255,0.1)`,
              color: "rgba(255,255,255,0.9)",
            }}
          />
        </div>

        {/* Analysis Results */}
        <div className="rounded-[20px] p-5 flex-1 overflow-y-auto" style={glassDark}>
          {activeTab === "analyze" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Brain size={15} style={{ color: p.accent }} />
                <span className="text-sm font-bold text-white">{T.grammarBreakdown}</span>
              </div>

              {/* Color Legend */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(WORD_COLORS).map(([type, style]) => (
                  <span key={type} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}40` }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: style.color }} />
                    {type === "maskulin" ? "Maskulin (der)" : type === "feminin" ? "Feminin (die)" :
                      type === "neutrum" ? "Neutrum (das)" : type === "verb" ? "Verb" :
                      type === "prep" ? "Präposition" : "Pronomen"}
                  </span>
                ))}
              </div>

              {/* Highlighted text display */}
              <div className="rounded-[14px] p-4 mb-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {renderAnalysisText()}
              </div>

              {/* Case Analysis */}
              <div className="space-y-2">
                {[
                  { case_: "Artikel-Fehler", note: "\"das Grammatik\" → ⚠️ sollte \"die Grammatik\" sein (Feminin)", severity: "high", color: P.red },
                  { case_: "Präposition + Bewegung", note: "\"in die Schule\" ✓ Korrekt — Akkusativ bei Bewegung", severity: "ok", color: P.green },
                  { case_: "Verbkonjugation", note: "\"gehe\", \"erklärt\" — beide korrekt konjugiert ✓", severity: "ok", color: P.green },
                ].map(({ case_, note, severity, color }) => (
                  <div key={case_} className="flex gap-3 p-3 rounded-[12px]"
                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}20` }}>
                      {severity === "ok" ? <Check size={12} style={{ color }} /> : <X size={12} style={{ color }} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{case_}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "vocab" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={15} style={{ color: p.accent }} />
                <span className="text-sm font-bold text-white">Schlüsselvokabeln</span>
              </div>
              {[
                { de: "die Schule", en: "the school", note: "Feminin · Plural: die Schulen", color: P.red },
                { de: "der Lehrer", en: "the teacher (male)", note: "Maskulin · Plural: die Lehrer", color: P.blue },
                { de: "das Grammatik", en: "the grammar", note: "⚠️ Achtung: tatsächlich Feminin! die Grammatik", color: P.orange },
                { de: "erklären", en: "to explain", note: "Starkes Verb · er erklärt, er erklärte, hat erklärt", color: P.purple },
                { de: "sehr gut", en: "very well", note: "Adverb + Adjektiv · idiomatischer Ausdruck", color: P.teal },
              ].map(({ de, en, note, color }) => (
                <div key={de} className="flex gap-3 p-3 rounded-[14px]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-1 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-white text-sm">{de}</span>
                      <button className="w-7 h-7 flex items-center justify-center rounded-full"
                        style={{ background: "rgba(255,255,255,0.07)" }}>
                        <Volume2 size={12} style={{ color: "rgba(255,255,255,0.5)" }} />
                      </button>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: p.accent }}>{en}</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "exercises" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Target size={15} style={{ color: p.accent }} />
                <span className="text-sm font-bold text-white">Übungen</span>
              </div>
              {[
                { q: "Was ist der richtige Artikel für 'Grammatik'?", opts: ["der", "die", "das"], correct: 1 },
                { q: "Welcher Fall wird nach 'in' bei Bewegung verwendet?", opts: ["Nominativ", "Dativ", "Akkusativ"], correct: 2 },
              ].map((ex, i) => (
                <div key={i} className="p-4 rounded-[16px]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-sm text-white mb-3">{i + 1}. {ex.q}</p>
                  <div className="flex gap-2 flex-wrap">
                    {ex.opts.map((opt, j) => (
                      <button key={opt}
                        className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all"
                        style={{
                          background: j === ex.correct ? `${p.accent}22` : "rgba(255,255,255,0.07)",
                          color: j === ex.correct ? p.accent : "rgba(255,255,255,0.6)",
                          border: j === ex.correct ? `1px solid ${p.accent}40` : "1px solid rgba(255,255,255,0.1)",
                        }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── RIGHT PANEL: Persona Interaction ── */}
      <motion.div className="w-[420px] flex flex-col relative z-10 flex-shrink-0"
        style={{ ...glassDark, borderRadius: 24 }}
        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>

        {/* Persona Header */}
        <div className="flex items-center gap-3 p-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="relative w-10 h-10">
            <div className="w-10 h-10 rounded-full overflow-hidden"
              style={{ border: `2px solid ${p.accent}`, background: "rgba(255,255,255,0.05)" }}>
              <CharComp expression={"smiling" as never} style={{ transform: "scale(1.5) translateY(15%)" }} />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
              style={{ background: P.green, borderColor: "#050F22" }} />
          </div>
          <div className="flex-1">
            <p className="font-black text-sm text-white">{p.name}</p>
            <p className="text-xs" style={{ color: p.accent }}>
              {chatState === "thinking" ? "denkt nach..." : chatState === "streaming" ? "tippt gerade..." : p.role}
            </p>
          </div>
          <button onClick={() => { setMessages([]); setTimeout(() => deliverAI(p.replies[0]), 300); }}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <RefreshCcw size={13} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>

        {/* Character Zone */}
        <div className="h-52 relative overflow-hidden flex items-center justify-center"
          style={{ background: `radial-gradient(ellipse at center, ${p.glow.replace("0.4", "0.15")} 0%, transparent 70%)` }}>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 180, height: 180 }}>
            <CharComp
              expression={chatState === "streaming" ? "talking" as never : "smiling" as never}
              isTalking={chatState === "streaming"}
              style={{ width: "100%", height: "100%" }}
            />
          </motion.div>
          <div className="absolute bottom-0 left-0 right-0 h-16"
            style={{ background: "linear-gradient(to top, rgba(5,15,34,0.8), transparent)" }} />
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5"
          style={{ scrollbarWidth: "none" }}>
          <AnimatePresence mode="popLayout">
            {messages.map((msg, idx) => {
              const isLastAI = msg.from === "ai" && idx === messages.length - 1 && chatState === "streaming";
              return (
                <div key={msg.id}>
                  <ChatBubble
                    variant={msg.from === "user" ? "user" : isLastAI ? "streaming" : "ai"}
                    text={msg.text}
                    accent={p.accent}
                    bubbleBg={p.bubble}
                    border={p.border}
                    glow={p.glow}
                  />
                </div>
              );
            })}
          </AnimatePresence>
          {chatState === "thinking" && (
            <motion.div className="flex justify-start"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <TypingIndicator color={p.accent} bubbleBg={p.bubble} borderColor={p.border} />
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={`Schreib auf Deutsch an ${p.name}...`}
              className="flex-1 px-4 py-2.5 rounded-[12px] text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `1px solid rgba(255,255,255,0.1)`,
                color: "white",
              }}
              disabled={chatState !== "idle"}
            />
            <motion.button
              onClick={handleSend}
              disabled={chatState !== "idle" || !input.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-[12px] flex-shrink-0"
              style={{ background: p.accent, opacity: chatState !== "idle" || !input.trim() ? 0.5 : 1 }}
              whileTap={{ scale: 0.9 }}>
              <Send size={15} style={{ color: selectedPersona === "lukas" ? "white" : P.navy }} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: Persona Selection
// ─────────────────────────────────────────────────────────────────────────────
function PersonaView({ selected, setSelected }: { selected: PersonaId; setSelected: (id: PersonaId) => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black mb-2" style={{ color: P.text }}>Wähle deinen KI-Begleiter</h2>
        <p className="text-base" style={{ color: P.muted }}>Jeder Begleiter hat seinen eigenen Lernstil und Persönlichkeit</p>
      </div>
      <div className="grid grid-cols-2 gap-8">
        {PERSONA_LIST.map((persona) => {
          const CharComp = persona.id === "lukas" ? LukasCharacter : EmmaCharacter;
          const isSelected = selected === persona.id;
          return (
            <motion.button key={persona.id}
              onClick={() => setSelected(persona.id)}
              className="rounded-[28px] overflow-hidden text-left relative"
              style={{
                background: isSelected ? `linear-gradient(135deg, ${persona.accent}18, ${persona.accent}08)` : "white",
                border: `2.5px solid ${isSelected ? persona.accent : P.border}`,
                boxShadow: isSelected ? `0 16px 48px ${persona.glow}` : "0 4px 20px rgba(0,48,94,0.07)",
              }}
              whileHover={{ y: -4, boxShadow: `0 20px 60px ${persona.glow}` }}
              animate={{ scale: isSelected ? 1.01 : 1 }}>

              {isSelected && (
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
                  style={{ background: persona.accent }}>
                  <Check size={16} style={{ color: persona.id === "lukas" ? "white" : P.navy }} />
                </div>
              )}

              {/* Character Display */}
              <div className="h-64 flex items-end justify-center relative overflow-hidden"
                style={{ background: `linear-gradient(to bottom, ${persona.bg}, ${persona.bg})` }}>
                <div className="absolute inset-0"
                  style={{ background: `radial-gradient(ellipse at top, ${persona.glow.replace("0.4", "0.12")} 0%, transparent 70%)` }} />
                <div style={{ width: 200, height: 220, position: "relative", zIndex: 2 }}>
                  <CharComp expression={"smiling" as never} style={{ width: "100%", height: "100%" }} />
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-black" style={{ color: P.text }}>{persona.name}</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: persona.tagBg, color: persona.accent }}>{persona.tag}</span>
                </div>
                <p className="text-sm font-semibold mb-2" style={{ color: persona.accent }}>{persona.role}</p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: P.muted }}>{persona.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {(persona.id === "lukas"
                    ? ["Grammatik", "Code-Analogien", "Strukturiert", "Präzise"]
                    : ["Kultur", "Berliner Flair", "Kreativ", "Motivierend"]
                  ).map(tag => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full"
                      style={{ background: persona.bg, color: persona.accent, border: `1px solid ${persona.border}` }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <motion.div
                  className="w-full mt-5 py-3 rounded-[14px] font-bold text-sm flex items-center justify-center cursor-pointer"
                  style={{
                    background: isSelected ? persona.accent : `${persona.accent}15`,
                    color: isSelected ? (persona.id === "lukas" ? "white" : P.navy) : persona.accent,
                    border: `2px solid ${persona.accent}40`,
                  }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {isSelected ? `✓ ${persona.name} gewählt` : `${persona.name} wählen`}
                </motion.div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View: Profile Settings
// ─────────────────────────────────────────────────────────────────────────────
function ProfileView() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifSettings] = useState(true);
  const [dailyGoal, setDailyGoal] = useState("30");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile Header */}
      <motion.div className="rounded-[24px] p-6 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.07)" }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black"
            style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})`, color: "white" }}>
            HC
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black" style={{ color: P.text }}>Huy Cự</h3>
            <p className="text-sm" style={{ color: P.muted }}>huycuDeutsch@gmail.com</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: P.blueLight, color: P.blue }}>A2 · Deutschlernender</span>
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: P.yellowLight, color: "#C9A200" }}>⭐ Premium</span>
            </div>
          </div>
          <button className="px-4 py-2 rounded-[12px] text-sm font-semibold"
            style={{ background: P.navyLight, color: P.navy, border: `1.5px solid ${P.border}` }}>
            Foto ändern
          </button>
        </div>
      </motion.div>

      {/* Settings Sections */}
      {[
        {
          title: "Persönliche Informationen",
          icon: Users,
          fields: [
            { label: "Vorname", value: "Huy", type: "text" },
            { label: "Nachname", value: "Cụ", type: "text" },
            { label: "E-Mail", value: "huycuDeutsch@gmail.com", type: "email" },
            { label: "Muttersprache", value: "Vietnamesisch", type: "select" },
          ]
        },
        {
          title: "Lerneinstellungen",
          icon: Target,
          fields: [
            { label: "Deutschniveau", value: "A2", type: "select" },
            { label: "Tägliches Lernziel (Min.)", value: dailyGoal, type: "number" },
            { label: "Lerngeschwindigkeit", value: "Mittel", type: "select" },
          ]
        }
      ].map(({ title, icon: Icon, fields }) => (
        <motion.div key={title} className="rounded-[24px] p-6 bg-white"
          style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.07)" }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: P.navyLight }}>
              <Icon size={15} style={{ color: P.navy }} />
            </div>
            <h4 className="font-bold" style={{ color: P.text }}>{title}</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: P.muted }}>{label}</label>
                <input defaultValue={value}
                  className="w-full px-3 py-2.5 rounded-[10px] text-sm outline-none"
                  style={{ background: P.bg, border: `1.5px solid ${P.border}`, color: P.text }} />
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Toggles */}
      <motion.div className="rounded-[24px] p-6 bg-white"
        style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 4px 20px rgba(0,48,94,0.07)" }}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: P.navyLight }}>
            <Settings size={15} style={{ color: P.navy }} />
          </div>
          <h4 className="font-bold" style={{ color: P.text }}>App-Einstellungen</h4>
        </div>
        <div className="space-y-4">
          {[
            { label: "Benachrichtigungen", desc: "Tägliche Lern-Erinnerungen", val: notifications, set: setNotifSettings, icon: Bell },
            { label: "Dunkelmodus", desc: "Augenschonende Ansicht", val: darkMode, set: setDarkMode, icon: darkMode ? Moon : Sun },
          ].map(({ label, desc, val, set, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between py-3"
              style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: P.navyLight }}>
                  <Icon size={15} style={{ color: P.navy }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: P.text }}>{label}</p>
                  <p className="text-xs" style={{ color: P.muted }}>{desc}</p>
                </div>
              </div>
              <button
                onClick={() => set(!val)}
                className="w-12 h-6 rounded-full transition-all relative"
                style={{ background: val ? P.navy : P.border }}>
                <motion.span className="absolute w-5 h-5 bg-white rounded-full top-0.5"
                  animate={{ left: val ? "calc(100% - 22px)" : 2 }}
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
              </button>
            </div>
          ))}
        </div>
        <motion.button
          className="w-full mt-5 py-3 rounded-[14px] font-bold text-sm"
          style={{ background: P.navy, color: "white", boxShadow: "0 4px 16px rgba(0,48,94,0.25)" }}
          whileHover={{ y: -1 }} whileTap={{ y: 1 }}>
          Einstellungen speichern
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: WebDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function WebDashboard() {
  const navigate = useNavigate();
  const { lang, toggle: toggleLang } = useLanguage();
  const T = WD_T[lang];
  const [activeView, setActiveView] = useState<View>("learning");
  const [selectedPersona, setSelectedPersona] = useState<PersonaId>("lukas");
  const [showNotifications, setShowNotifications] = useState(false);

  const VIEW_TITLES: Record<View, { title: string; sub: string }> = {
    learning: { title: T.views.learning.title, sub: T.views.learning.sub },
    users:    { title: T.views.users.title,    sub: T.views.users.sub },
    ai:       { title: "AI Workstation",       sub: `Chat với ${PERSONA_TOKENS[selectedPersona].name} · AI Workstation` },
    persona:  { title: T.views.persona.title,  sub: T.views.persona.sub },
    profile:  { title: T.views.profile.title,  sub: T.views.profile.sub },
  };

  const { title, sub } = VIEW_TITLES[activeView];

  return (
    <div className="min-h-screen" style={{ background: P.bg }}>
      {/* Top Navigation */}
      <TopNav
        activeView={activeView}
        setActiveView={setActiveView}
        notifications={showNotifications}
        setNotifications={setShowNotifications}
        lang={lang}
        onToggleLang={toggleLang}
      />

      {/* Left Sidebar */}
      <LeftSidebar activeView={activeView} setActiveView={setActiveView} lang={lang} />

      {/* Main Content Area */}
      <main className="pt-16 pl-[72px] min-h-screen">
        <div className={`h-full ${activeView === "ai" ? "p-5" : "p-8"}`}
          style={activeView === "ai" ? {
            background: "linear-gradient(135deg, #030B18 0%, #050F22 50%, #060C1A 100%)",
            minHeight: "calc(100vh - 64px)",
          } : {}}>

          {/* Page Header */}
          {activeView !== "ai" && (
            <motion.div className="mb-8 flex items-center justify-between"
              key={activeView}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div>
                <h1 className="text-2xl font-black" style={{ color: P.text }}>{title}</h1>
                <p className="text-sm mt-1" style={{ color: P.muted }}>{sub}</p>
              </div>
              {activeView === "learning" && (
                <motion.button
                  onClick={() => navigate("/lesson")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] font-bold text-sm"
                  style={{ background: P.navy, color: "white", boxShadow: "0 4px 16px rgba(0,48,94,0.3)" }}
                  whileHover={{ y: -1 }} whileTap={{ y: 1 }}>
                  <Play size={13} fill="white" /> Lektion fortsetzen
                </motion.button>
              )}
              {activeView === "users" && (
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] font-bold text-sm"
                  style={{ background: P.navy, color: "white" }}>
                  <Users size={14} /> Nutzer hinzufügen
                </button>
              )}
            </motion.div>
          )}

          {/* View Content */}
          <AnimatePresence mode="wait">
            <motion.div key={activeView}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="h-full">
              {activeView === "learning" && <LearningView />}
              {activeView === "users"    && <UserManagementView />}
              {activeView === "ai"       && <AIWorkstationView selectedPersona={selectedPersona} />}
              {activeView === "persona"  && <PersonaView selected={selectedPersona} setSelected={setSelectedPersona} />}
              {activeView === "profile"  && <ProfileView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Notification Drawer */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.3)" }} />
            <motion.div
              className="fixed top-16 right-4 w-80 z-50 rounded-[20px] overflow-hidden"
              style={{ background: "white", border: `1.5px solid ${P.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: `1px solid ${P.border}` }}>
                <span className="font-bold" style={{ color: P.text }}>Benachrichtigungen</span>
                <button onClick={() => setShowNotifications(false)}>
                  <X size={16} style={{ color: P.muted }} />
                </button>
              </div>
              {[
                { title: "Streak-Erinnerung 🔥", desc: "Du hast heute noch nicht geübt! Halte deinen 14-Tage-Streak.", time: "vor 10 Min.", color: P.orange },
                { title: "Neue Lektion verfügbar 📚", desc: "Kapitel 5: Am Bahnhof ist jetzt freigeschaltet.", time: "vor 2 Std.", color: P.blue },
                { title: "Achievement freigeschaltet 🏆", desc: "Du hast '7-Tage Streak' verdient!", time: "gestern", color: P.yellow },
              ].map(({ title: t, desc, time, color }) => (
                <div key={t} className="flex gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: P.text }}>{t}</p>
                    <p className="text-xs mt-0.5" style={{ color: P.muted }}>{desc}</p>
                    <p className="text-xs mt-1" style={{ color: P.muted }}>{time}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
