import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard, TrendingUp, Coins, Users, Bot, Settings,
  ChevronLeft, Shield, Bell, ArrowUpRight, ArrowDownRight,
  Zap, Brain, Cpu, Timer, RefreshCw, Search,
  MoreHorizontal, Check, X, AlertTriangle, Database,
  MessageSquare, BookOpen, Mic, DollarSign, Activity,
  Sliders, FileText, Copy, Save, Globe, Menu,
  ToggleLeft, ToggleRight, ChevronDown, Sparkles,
  CircuitBoard, Flame, Target, Layers, Lock, Eye,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

// ─── Palette ────────────────────────────────────────────────────────────────────
const P = {
  navy: "#00305E", navyDk: "#002447", navyLt: "#EBF2FA",
  blue: "#2D9CDB", blueLt: "#EBF5FB",
  red: "#EB5757", redLt: "#FDEAEA",
  green: "#27AE60", greenLt: "#E8F8F0",
  yellow: "#FFCE00", yellowLt: "#FFF8E1",
  purple: "#9B51E0", purpleLt: "#F4EDFF",
  orange: "#F2994A", orangeLt: "#FEF3E8",
  bg: "#F5F5F5", white: "#FFFFFF",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
};

// ─── Mock Data ───────────────────────────────────────────────────────────────────

const MONTHLY_REVENUE = [
  { month: "Jan", revenue: 31500, profit: 19200, users: 315 },
  { month: "Feb", revenue: 33000, profit: 20100, users: 330 },
  { month: "Mar", revenue: 35000, profit: 21350, users: 350 },
  { month: "Apr", revenue: 34500, profit: 20980, users: 345 },
  { month: "May", revenue: 38000, profit: 23120, users: 380 },
  { month: "Jun", revenue: 40000, profit: 24350, users: 400 },
  { month: "Jul", revenue: 42500, profit: 25840, users: 425 },
  { month: "Aug", revenue: 44000, profit: 26750, users: 440 },
  { month: "Sep", revenue: 43500, profit: 26430, users: 435 },
  { month: "Oct", revenue: 45000, profit: 27360, users: 450 },
  { month: "Nov", revenue: 46500, profit: 28290, users: 465 },
  { month: "Dec", revenue: 47250, profit: 28730, users: 472 },
];

const TOKEN_BREAKDOWN = [
  { name: "AI Speaking STT", value: 2100000, color: P.blue },
  { name: "AI Antwort (LLM)", value: 1800000, color: P.purple },
  { name: "Grammatikprüfung", value: 650000, color: P.orange },
  { name: "Transkription", value: 297320, color: P.green },
];

const USERS_DATA = [
  { id: "USR001", name: "Nguyen Thi Mai", avatar: "NM", level: "B1", tokensLeft: 8450, aiSpeaking: 890, grammar: 234, errors: ["Auxiliarverb", "der Artikel"], vocabProgress: 650, status: "active", streak: 23 },
  { id: "USR002", name: "Tran Van Minh", avatar: "TM", level: "A2", tokensLeft: 9120, aiSpeaking: 445, grammar: 156, errors: ["Praeteritum", "Dativ/Akk."], vocabProgress: 320, status: "active", streak: 7 },
  { id: "USR003", name: "Le Hoang Nam", avatar: "LN", level: "A1", tokensLeft: 9780, aiSpeaking: 120, grammar: 67, errors: ["Artikel", "Plural"], vocabProgress: 145, status: "active", streak: 3 },
  { id: "USR004", name: "Pham Thi Lan", avatar: "PL", level: "B2", tokensLeft: 6230, aiSpeaking: 1890, grammar: 567, errors: ["Konjunktiv II", "die Kontraktion"], vocabProgress: 920, status: "active", streak: 45 },
  { id: "USR005", name: "Vo Duc Khoa", avatar: "VK", level: "A2", tokensLeft: 7890, aiSpeaking: 560, grammar: 189, errors: ["Praeteritum", "das Genus"], vocabProgress: 410, status: "inactive", streak: 0 },
  { id: "USR006", name: "Dang Thi Hoa", avatar: "DH", level: "B1", tokensLeft: 5560, aiSpeaking: 1200, grammar: 345, errors: ["Passiv", "der/die/das"], vocabProgress: 730, status: "active", streak: 18 },
  { id: "USR007", name: "Bui Quang Thai", avatar: "BT", level: "A1", tokensLeft: 9900, aiSpeaking: 55, grammar: 23, errors: ["Artikel", "Verb Konjug."], vocabProgress: 89, status: "active", streak: 2 },
  { id: "USR008", name: "Hoang Minh Duc", avatar: "HD", level: "A2", tokensLeft: 3450, aiSpeaking: 2100, grammar: 678, errors: ["Akkusativ", "Separable Verbs"], vocabProgress: 465, status: "inactive", streak: 0 },
];

const ERROR_HEATMAP = [
  { category: "der-Genus (Maskulin)", count: 287, gender: "masculine", pct: 82 },
  { category: "die-Genus (Feminin)", count: 234, gender: "feminine", pct: 67 },
  { category: "das-Genus (Neutrum)", count: 198, gender: "neuter", pct: 57 },
  { category: "Auxiliarverb haben/sein", count: 312, gender: "verb", pct: 89 },
  { category: "Praeteritum Konjug.", count: 178, gender: "verb", pct: 51 },
  { category: "Dativ vs. Akkusativ", count: 256, gender: "neutral", pct: 73 },
];

const SYSTEM_PROMPT_DEFAULT = `Du bist ein erfahrener Deutschlehrer-KI für DeutschFlow.

Deine Aufgaben:
1. Analysiere die Grammatik des Nutzers genau
2. Korrigiere Fehler höflich und konstruktiv
3. Erkläre Grammatikregeln auf Englisch/Vietnamesisch
4. Passe dein Niveau an den Lernfortschritt an (A1-B2)
5. Motiviere den Lernenden nach jeder Interaktion

Fehler-Priorisierung:
- HOCH: Falsche Artikel (der/die/das)
- MITTEL: Auxiliarverb haben/sein
- NIEDRIG: Rechtschreibfehler

Antwortformat: JSON mit {corrected, explanation, tip}`;

// ─── Sidebar Items ────────────────────────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "revenue", label: "Revenue Analytics", icon: TrendingUp },
  { id: "tokens", label: "Token Management", icon: Coins },
  { id: "users", label: "Nutzer-Intelligenz", icon: Users },
  { id: "ai", label: "KI-Konfiguration", icon: Bot },
  { id: "settings", label: "Systemeinstellungen", icon: Settings },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}k`
    : n.toString();

const fmtVND = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M ₫` : `${n.toLocaleString()} ₫`;

const genderColor: Record<string, string> = {
  masculine: P.blue, feminine: P.red, neuter: P.green, verb: P.purple, neutral: P.muted,
};
const genderBg: Record<string, string> = {
  masculine: P.blueLt, feminine: P.redLt, neuter: P.greenLt, verb: P.purpleLt, neutral: "#F1F5F9",
};

// ─── KPI Card ────────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, trend, trendLabel, accent, delay = 0,
}: {
  icon: React.FC<any>; label: string; value: string; sub?: string;
  trend?: "up" | "down" | "neutral"; trendLabel?: string; accent: string; delay?: number;
}) {
  return (
    <motion.div
      className="bg-white rounded-[16px] p-5 flex flex-col gap-3"
      style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 22 }}
    >
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon size={22} style={{ color: accent }} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              background: trend === "up" ? "#E8F8F0" : trend === "down" ? "#FDEAEA" : "#F1F5F9",
              color: trend === "up" ? P.green : trend === "down" ? P.red : P.muted,
            }}>
            {trend === "up" ? <ArrowUpRight size={12} /> : trend === "down" ? <ArrowDownRight size={12} /> : null}
            {trendLabel}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: P.muted }}>{label}</p>
        <p className="font-black text-2xl tracking-tight" style={{ color: P.text }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: P.muted }}>{sub}</p>}
      </div>
      <div className="h-1 rounded-full" style={{ background: `${accent}20` }}>
        <div className="h-full rounded-full" style={{ background: accent, width: "100%" }} />
      </div>
    </motion.div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────────
function Section({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <motion.section className="mb-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg" style={{ color: P.text }}>{title}</h2>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: P.muted }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-[12px] p-3 shadow-xl border" style={{ border: `1px solid ${P.border}` }}>
      <p className="text-xs font-bold mb-1.5" style={{ color: P.muted }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: P.text }}>{p.name}:</span>
          <span style={{ color: p.color }}>
            {p.name.includes("Token") ? fmt(p.value) : fmtVND(p.value * 1000)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── SECTION: Overview ───────���────────────────────────────────────────────────────
function OverviewSection() {
  const totalTokens = 10_000_000;
  const usedTokens = TOKEN_BREAKDOWN.reduce((s, t) => s + t.value, 0);
  const usedPct = ((usedTokens / totalTokens) * 100).toFixed(1);

  const systemChecks = [
    { label: "OpenRouter API", status: "ok" },
    { label: "Llama-4 Maverick", status: "ok" },
    { label: "Llama-3.3-70B", status: "degraded" },
    { label: "Supabase DB", status: "ok" },
    { label: "Token Billing", status: "ok" },
    { label: "STT Service", status: "ok" },
  ];

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={DollarSign} label="Gesamtumsatz" value="47.25M ₫"
          sub="472 aktive Abos × 100k ₫" trend="up" trendLabel="+12.3%" accent={P.green} delay={0} />
        <KpiCard icon={TrendingUp} label="Nettogewinn" value="28.73M ₫"
          sub="nach 15% Store-Gebühr & API" trend="up" trendLabel="+8.1%" accent={P.blue} delay={0.05} />
        <KpiCard icon={Users} label="Aktive Nutzer" value="472 / 1.000"
          sub="+34 Nutzer diese Woche" trend="up" trendLabel="+7.8%" accent={P.purple} delay={0.1} />
        <KpiCard icon={Coins} label="Token-Quota" value={`${fmt(usedTokens)} / 10M`}
          sub={`${usedPct}% verbraucht · ${fmt(totalTokens - usedTokens)} übrig`}
          trend="neutral" trendLabel={`${usedPct}%`} accent={P.orange} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Revenue Sparkline */}
        <div className="xl:col-span-2 bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold" style={{ color: P.text }}>Umsatz & Gewinn 2025</h3>
              <p className="text-xs" style={{ color: P.muted }}>Monatliche Entwicklung (×1.000 ₫)</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#2D9CDB]" />Umsatz</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#27AE60]" />Gewinn</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={MONTHLY_REVENUE} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={P.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={P.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={P.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={P.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Umsatz" stroke={P.blue} strokeWidth={2.5} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="profit" name="Gewinn" stroke={P.green} strokeWidth={2.5} fill="url(#profGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-[16px] p-5 flex flex-col" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <h3 className="font-bold mb-4" style={{ color: P.text }}>System-Status</h3>
          <div className="space-y-2.5 flex-1">
            {systemChecks.map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between py-2 px-3 rounded-[10px]" style={{ background: P.bg }}>
                <span className="text-sm font-medium" style={{ color: P.text }}>{label}</span>
                <div className="flex items-center gap-1.5">
                  <motion.div className="w-2 h-2 rounded-full"
                    style={{ background: status === "ok" ? P.green : P.orange }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: status === "ok" ? 2 : 0.8, repeat: Infinity }} />
                  <span className="text-[10px] font-bold uppercase"
                    style={{ color: status === "ok" ? P.green : P.orange }}>
                    {status === "ok" ? "Online" : "Degraded"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${P.border}` }}>
            <span className="text-xs" style={{ color: P.muted }}>Gesamt-Uptime</span>
            <span className="text-sm font-black" style={{ color: P.green }}>99.7%</span>
          </div>
        </div>
      </div>

      {/* Token Quick Stats */}
      <div className="bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <h3 className="font-bold mb-4" style={{ color: P.text }}>Token-Verbrauch nach Service</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {TOKEN_BREAKDOWN.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: P.text }}>{t.name}</span>
                <span className="text-xs font-bold" style={{ color: t.color }}>{fmt(t.value)}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: `${t.color}20` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(t.value / 10_000_000) * 100}%`, background: t.color }} />
              </div>
              <span className="text-[10px]" style={{ color: P.muted }}>{((t.value / 10_000_000) * 100).toFixed(1)}% der Quota</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── SECTION: Revenue Analytics ──────────────────────────────────────────────────
function RevenueSection() {
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  const quarterly = [
    { label: "Q1", revenue: 99500, profit: 60650, users: 350 },
    { label: "Q2", revenue: 112500, profit: 68450, users: 400 },
    { label: "Q3", revenue: 130000, profit: 79120, users: 435 },
    { label: "Q4", revenue: 138750, profit: 84380, users: 472 },
  ];

  const yearly = [
    { label: "2023", revenue: 285000, profit: 173850, users: 285 },
    { label: "2024", revenue: 412000, profit: 250000, users: 412 },
    { label: "2025", revenue: 480750, profit: 292600, users: 472 },
  ];

  const chartData = period === "monthly" ? MONTHLY_REVENUE.map(d => ({ ...d, label: d.month }))
    : period === "quarterly" ? quarterly
    : yearly;

  const totalRevenue = MONTHLY_REVENUE.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = MONTHLY_REVENUE.reduce((s, d) => s + d.profit, 0);
  const margin = ((totalProfit / totalRevenue) * 100).toFixed(1);

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jahresumsatz", val: `${fmtVND(totalRevenue * 1000)}`, color: P.blue, bg: P.blueLt },
          { label: "Jahresgewinn", val: `${fmtVND(totalProfit * 1000)}`, color: P.green, bg: P.greenLt },
          { label: "Gewinnmarge", val: `${margin}%`, color: P.purple, bg: P.purpleLt },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className="bg-white rounded-[16px] p-4 text-center" style={{ border: `1.5px solid ${color}30`, background: bg }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color }}>{label}</p>
            <p className="font-black text-xl" style={{ color: P.text }}>{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[16px] p-6 mb-6" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold" style={{ color: P.text }}>Umsatz & Gewinn Analyse</h3>
            <p className="text-xs" style={{ color: P.muted }}>Abonnement-Modell: 100.000 ₫/Monat</p>
          </div>
          <div className="flex rounded-[10px] overflow-hidden" style={{ border: `1.5px solid ${P.border}` }}>
            {(["monthly", "quarterly", "yearly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: period === p ? P.navy : P.white,
                  color: period === p ? P.white : P.muted,
                }}>
                {p === "monthly" ? "Monatlich" : p === "quarterly" ? "Quartal" : "Jährlich"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="ra-rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={P.blue} stopOpacity={0.25} />
                <stop offset="95%" stopColor={P.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ra-prof" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={P.green} stopOpacity={0.25} />
                <stop offset="95%" stopColor={P.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: P.muted }} />
            <Area type="monotone" dataKey="revenue" name="Umsatz" stroke={P.blue} strokeWidth={2.5} fill="url(#ra-rev)" dot={{ fill: P.blue, r: 3 }} />
            <Area type="monotone" dataKey="profit" name="Gewinn" stroke={P.green} strokeWidth={2.5} fill="url(#ra-prof)" dot={{ fill: P.green, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-[16px] overflow-hidden" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${P.border}` }}>
          <h3 className="font-bold" style={{ color: P.text }}>Monatliche Aufschlüsselung 2025</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: P.bg }}>
                {["Monat", "Abonnenten", "Bruttoumsatz", "Store-Gebühr (15%)", "API-Kosten", "Nettogewinn", "Marge"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: P.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHLY_REVENUE.map((row, i) => {
                const gross = row.revenue * 1000;
                const store = gross * 0.15;
                const api = 8000000;
                const net = gross - store - api;
                const marg = ((net / gross) * 100).toFixed(0);
                return (
                  <tr key={row.month} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none", background: i % 2 === 0 ? P.white : "#FAFBFF" }}>
                    <td className="px-4 py-3 font-bold" style={{ color: P.text }}>{row.month}</td>
                    <td className="px-4 py-3" style={{ color: P.muted }}>{row.users}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: P.blue }}>{fmtVND(gross)}</td>
                    <td className="px-4 py-3" style={{ color: P.red }}>-{fmtVND(store)}</td>
                    <td className="px-4 py-3" style={{ color: P.orange }}>-{fmtVND(api)}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: P.green }}>{fmtVND(net)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: P.greenLt, color: P.green }}>{marg}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── SECTION: Token Management ────────────────────────────────────────────────────
function TokenSection() {
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const diff = next.getTime() - now.getTime();
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const totalTokens = 10_000_000;
  const usedTokens = TOKEN_BREAKDOWN.reduce((s, t) => s + t.value, 0);
  const usedPct = (usedTokens / totalTokens) * 100;

  const topConsumers = [...USERS_DATA].sort((a, b) => b.aiSpeaking - a.aiSpeaking).slice(0, 5);

  const PIE_DATA = TOKEN_BREAKDOWN;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Donut Chart */}
        <div className="bg-white rounded-[16px] p-5 flex flex-col items-center" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <h3 className="font-bold mb-4 self-start" style={{ color: P.text }}>Gesamte Quota-Nutzung</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                dataKey="value" paddingAngle={3}>
                {PIE_DATA.map((entry, i) => (
                  <Cell key={`tok-${i}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-2 mb-4">
            <p className="font-black text-3xl" style={{ color: P.text }}>{usedPct.toFixed(1)}%</p>
            <p className="text-xs" style={{ color: P.muted }}>von 10M Tokens verbraucht</p>
          </div>
          <div className="w-full space-y-2">
            {PIE_DATA.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                  <span style={{ color: P.text }}>{t.name}</span>
                </div>
                <span className="font-bold" style={{ color: t.color }}>{fmt(t.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="bg-white rounded-[16px] p-5 flex flex-col" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Timer size={18} style={{ color: P.orange }} />
            <h3 className="font-bold" style={{ color: P.text }}>Nächster Monats-Reset</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="grid grid-cols-4 gap-3 w-full">
              {[
                { val: countdown.d, label: "Tage" },
                { val: countdown.h, label: "Std" },
                { val: countdown.m, label: "Min" },
                { val: countdown.s, label: "Sek" },
              ].map(({ val, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-[12px]"
                  style={{ background: P.navyLt, border: `1.5px solid ${P.navy}20` }}>
                  <motion.span className="font-black text-2xl" style={{ color: P.navy }}
                    key={val} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 0.15 }}>
                    {String(val).padStart(2, "0")}
                  </motion.span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: P.muted }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="w-full px-2 text-center">
              <p className="text-xs" style={{ color: P.muted }}>Reset am <strong>1. {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString("de-DE", { month: "long" })} 00:00 UTC</strong></p>
              <div className="mt-3 h-2 rounded-full" style={{ background: P.border }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${usedPct}%`, background: usedPct > 80 ? P.red : usedPct > 60 ? P.orange : P.green }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: P.muted }}>{fmt(totalTokens - usedTokens)} Tokens verbleibend</p>
            </div>
          </div>
          <div className="mt-4 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: `1px solid ${P.border}` }}>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: P.blue }}>{fmt(usedTokens)}</p>
              <p className="text-[10px]" style={{ color: P.muted }}>Verbraucht</p>
            </div>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: P.green }}>{fmt(totalTokens - usedTokens)}</p>
              <p className="text-[10px]" style={{ color: P.muted }}>Verfügbar</p>
            </div>
          </div>
        </div>

        {/* Per-User Token Quick Stats */}
        <div className="bg-white rounded-[16px] p-5 flex flex-col" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <h3 className="font-bold mb-4" style={{ color: P.text }}>Ø Nutzer-Token Statistik</h3>
          <div className="space-y-3 flex-1">
            {[
              { label: "Ø Token pro Nutzer/Monat", val: "21.326", color: P.blue },
              { label: "Ø AI-Gespräche / Nutzer", val: "14.2", color: P.purple },
              { label: "Größter Einzelverbraucher", val: "2.100 Tks", color: P.red },
              { label: "Niedrigster Verbraucher", val: "55 Tks", color: P.green },
              { label: "Nutzer mit < 10% verbl.", val: "12 Nutzer", color: P.orange },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-[10px]" style={{ background: P.bg }}>
                <span className="text-xs" style={{ color: P.text }}>{label}</span>
                <span className="text-sm font-black" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full py-2.5 rounded-[10px] text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            style={{ background: P.navy, color: P.white }}>
            <RefreshCw size={14} /> Manuell zurücksetzen
          </button>
        </div>
      </div>

      {/* Top Token Consumers */}
      <div className="bg-white rounded-[16px] overflow-hidden" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <h3 className="font-bold" style={{ color: P.text }}>Top Token-Verbraucher</h3>
          <p className="text-xs mt-0.5" style={{ color: P.muted }}>Nutzer mit höchstem AI-Speaking-Verbrauch diesen Monat</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: P.bg }}>
              {["#", "Nutzer", "Level", "AI Speaking", "Grammatik", "Tokens übrig", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: P.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topConsumers.map((u, i) => (
              <tr key={u.id} style={{ borderTop: `1px solid ${P.border}` }}>
                <td className="px-4 py-3 font-black text-base" style={{ color: i === 0 ? P.yellow : P.muted }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})` }}>
                      {u.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: P.text }}>{u.name}</p>
                      <p className="text-[10px]" style={{ color: P.muted }}>{u.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: P.navyLt, color: P.navy }}>{u.level}</span>
                </td>
                <td className="px-4 py-3 font-bold" style={{ color: P.purple }}>{u.aiSpeaking.toLocaleString()} Tks</td>
                <td className="px-4 py-3 font-bold" style={{ color: P.blue }}>{u.grammar.toLocaleString()} Tks</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: P.border }}>
                      <div className="h-full rounded-full" style={{ width: `${(u.tokensLeft / 10000) * 100}%`, background: u.tokensLeft > 5000 ? P.green : u.tokensLeft > 2000 ? P.orange : P.red }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: P.text }}>{u.tokensLeft.toLocaleString()}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: u.status === "active" ? P.greenLt : P.redLt, color: u.status === "active" ? P.green : P.red }}>
                    {u.status === "active" ? "● Aktiv" : "○ Inaktiv"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── SECTION: User Intelligence ───────────────────────────────────────────────────
function UsersSection() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = USERS_DATA.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || u.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      {/* Error Heatmap */}
      <div className="bg-white rounded-[16px] p-5 mb-6" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} style={{ color: P.orange }} />
          <h3 className="font-bold" style={{ color: P.text }}>Fehler-Heatmap (Grammatik)</h3>
          <span className="ml-auto text-xs px-2 py-1 rounded-full font-semibold" style={{ background: P.orangeLt, color: P.orange }}>System-weit</span>
        </div>
        <div className="space-y-3">
          {ERROR_HEATMAP.map((e) => (
            <div key={e.category} className="flex items-center gap-4">
              <div className="w-52 flex-shrink-0">
                <span className="text-sm font-medium" style={{ color: P.text }}>{e.category}</span>
              </div>
              <div className="flex-1 h-7 rounded-[8px] relative overflow-hidden" style={{ background: P.bg }}>
                <motion.div className="absolute left-0 top-0 h-full rounded-[8px] flex items-center px-3"
                  style={{ background: `${genderColor[e.gender]}25`, width: `${e.pct}%`, minWidth: 40 }}
                  initial={{ width: 0 }} animate={{ width: `${e.pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}>
                  <span className="text-xs font-bold" style={{ color: genderColor[e.gender] }}>{e.pct}%</span>
                </motion.div>
              </div>
              <span className="text-xs font-black w-12 text-right" style={{ color: genderColor[e.gender] }}>{e.count}</span>
              <div className="w-3 h-3 rounded-full" style={{ background: genderColor[e.gender] }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 text-xs" style={{ borderTop: `1px solid ${P.border}` }}>
          {[["Maskulin (der)", P.blue], ["Feminin (die)", P.red], ["Neutrum (das)", P.green], ["Verb", P.purple], ["Sonstige", P.muted]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              <span style={{ color: P.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-[16px] overflow-hidden" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
        <div className="px-5 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: `1px solid ${P.border}` }}>
          <h3 className="font-bold" style={{ color: P.text }}>Nutzertabelle</h3>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-[10px]" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
              <Search size={14} style={{ color: P.muted }} />
              <input className="bg-transparent outline-none text-sm w-36" placeholder="Suchen..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ color: P.text }} />
            </div>
            <div className="flex rounded-[10px] overflow-hidden" style={{ border: `1px solid ${P.border}` }}>
              {(["all", "active", "inactive"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-2 text-xs font-bold transition-all"
                  style={{ background: filter === f ? P.navy : P.white, color: filter === f ? P.white : P.muted }}>
                  {f === "all" ? "Alle" : f === "active" ? "Aktiv" : "Inaktiv"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: P.bg }}>
                {["Nutzer", "Level", "Streak", "Token-Balance", "Häufige Fehler (Top 2)", "Vokabular", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: P.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
                  className="hover:bg-[#FAFBFF] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})` }}>
                        {u.avatar}
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: P.text }}>{u.name}</p>
                        <p className="text-[10px]" style={{ color: P.muted }}>{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: P.navyLt, color: P.navy }}>{u.level}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <Flame size={13} style={{ color: u.streak > 0 ? P.orange : P.border }} />
                      <span className="font-bold text-sm" style={{ color: u.streak > 0 ? P.orange : P.muted }}>{u.streak}d</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full" style={{ background: P.border }}>
                        <div className="h-full rounded-full" style={{ width: `${(u.tokensLeft / 10000) * 100}%`, background: u.tokensLeft > 5000 ? P.green : u.tokensLeft > 2000 ? P.orange : P.red }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: P.text }}>{u.tokensLeft.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.errors.map((err, ei) => {
                        const isArtikel = err.toLowerCase().includes("artikel") || err.toLowerCase().includes("genus") || err.toLowerCase().includes("der") || err.toLowerCase().includes("die") || err.toLowerCase().includes("das");
                        const clr = ei === 0 ? P.blue : P.red;
                        return (
                          <span key={err} className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold"
                            style={{ background: `${clr}15`, color: clr, border: `1px solid ${clr}30` }}>
                            {err}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full" style={{ background: P.border }}>
                        <div className="h-full rounded-full" style={{ width: `${(u.vocabProgress / 1000) * 100}%`, background: P.green }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: P.text }}>{u.vocabProgress}/1000</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: u.status === "active" ? P.greenLt : P.redLt, color: u.status === "active" ? P.green : P.red }}>
                      {u.status === "active" ? "● Aktiv" : "○ Inaktiv"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center" style={{ color: P.muted }}>Keine Nutzer gefunden</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── SECTION: AI Configuration ────────────────────────────────────────────────────
function AISection() {
  const [activeModel, setActiveModel] = useState<"llama4" | "llama33">("llama4");
  const [hybridMode, setHybridMode] = useState(true);
  const [prompt, setPrompt] = useState(SYSTEM_PROMPT_DEFAULT);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(0.9);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const models = [
    { id: "llama4", name: "Llama-4 Maverick", params: "17B aktive Parameter", speed: "Schnell", quality: "Hoch", cost: "$0.12/1M Tks", badge: "Empfohlen", badgeColor: P.green },
    { id: "llama33", name: "Llama-3.3-70B", params: "70B Parameter", speed: "Langsam", quality: "Sehr hoch", cost: "$0.80/1M Tks", badge: "Präzise", badgeColor: P.blue },
  ];

  const estimatedCostPerConvo = activeModel === "llama4"
    ? ((maxTokens * 0.12) / 1_000_000).toFixed(5)
    : ((maxTokens * 0.80) / 1_000_000).toFixed(5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Left: Prompt Editor (3/5) */}
      <div className="xl:col-span-3 flex flex-col gap-6">
        {/* Model Selector */}
        <div className="bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <CircuitBoard size={18} style={{ color: P.purple }} />
            <h3 className="font-bold" style={{ color: P.text }}>Modell-Auswahl</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {models.map((m) => (
              <button key={m.id} onClick={() => setActiveModel(m.id as any)}
                className="rounded-[14px] p-4 text-left transition-all"
                style={{
                  border: `2px solid ${activeModel === m.id ? m.badgeColor : P.border}`,
                  background: activeModel === m.id ? `${m.badgeColor}08` : P.white,
                }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: `${m.badgeColor}18` }}>
                    <Brain size={18} style={{ color: m.badgeColor }} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${m.badgeColor}20`, color: m.badgeColor }}>{m.badge}</span>
                </div>
                <p className="font-bold text-sm mb-0.5" style={{ color: P.text }}>{m.name}</p>
                <p className="text-[10px] mb-2" style={{ color: P.muted }}>{m.params}</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span style={{ color: P.muted }}>Speed: <strong style={{ color: P.text }}>{m.speed}</strong></span>
                  <span style={{ color: P.muted }}>Qualität: <strong style={{ color: P.text }}>{m.quality}</strong></span>
                  <span className="col-span-2" style={{ color: P.muted }}>Kosten: <strong style={{ color: m.badgeColor }}>{m.cost}</strong></span>
                </div>
                {activeModel === m.id && (
                  <div className="mt-2 pt-2 flex items-center gap-1" style={{ borderTop: `1px solid ${m.badgeColor}30` }}>
                    <Check size={12} style={{ color: m.badgeColor }} />
                    <span className="text-[10px] font-bold" style={{ color: m.badgeColor }}>Aktiv</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Hybrid Mode Toggle */}
          <div className="mt-4 flex items-center justify-between p-4 rounded-[12px]"
            style={{ background: hybridMode ? `${P.purple}08` : P.bg, border: `1.5px solid ${hybridMode ? P.purple + "40" : P.border}` }}>
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles size={14} style={{ color: P.purple }} />
                <p className="text-sm font-bold" style={{ color: P.text }}>Hybrid-Modus</p>
              </div>
              <p className="text-xs" style={{ color: P.muted }}>
                Llama-4 für einfachen Chat · Llama-3.3-70B für Grammatikkorrekturen
              </p>
            </div>
            <button onClick={() => setHybridMode((v) => !v)} className="flex-shrink-0">
              {hybridMode
                ? <ToggleRight size={32} style={{ color: P.purple }} />
                : <ToggleLeft size={32} style={{ color: P.muted }} />}
            </button>
          </div>
        </div>

        {/* System Prompt Editor */}
        <div className="bg-white rounded-[16px] p-5 flex flex-col" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} style={{ color: P.blue }} />
              <h3 className="font-bold" style={{ color: P.text }}>System-Prompt Editor</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors"
                style={{ background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}>
                <Copy size={12} /> Kopieren
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all"
                style={{ background: saved ? P.green : P.navy, color: P.white }}>
                {saved ? <><Check size={12} /> Gespeichert!</> : <><Save size={12} /> Speichern</>}
              </button>
            </div>
          </div>
          <div className="relative flex-1">
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              <span className="ml-2 text-[10px] font-mono" style={{ color: P.muted }}>system_prompt.txt</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={14}
              className="w-full rounded-[12px] p-4 pt-10 text-sm font-mono resize-none outline-none"
              style={{
                background: "#0F172A", color: "#E2E8F0",
                border: `1.5px solid #1E293B`,
                lineHeight: 1.7,
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: P.muted }}>
            <span>{prompt.split("\n").length} Zeilen · {prompt.length} Zeichen</span>
            <span style={{ color: P.orange }}>⚠ Änderungen betreffen alle zukünftigen Sitzungen</span>
          </div>
        </div>
      </div>

      {/* Right: Parameters (2/5) */}
      <div className="xl:col-span-2 flex flex-col gap-5">
        {/* Parameter Sliders */}
        <div className="bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={18} style={{ color: P.orange }} />
            <h3 className="font-bold" style={{ color: P.text }}>Modell-Parameter</h3>
          </div>
          <div className="space-y-5">
            {[
              { label: "Temperatur", val: temperature, min: 0, max: 2, step: 0.05, set: setTemperature, hint: "Kreativität der Antworten", color: P.orange },
              { label: "Max. Tokens", val: maxTokens, min: 256, max: 4096, step: 128, set: setMaxTokens, hint: "Maximale Antwortlänge", color: P.blue },
              { label: "Top-P", val: topP, min: 0, max: 1, step: 0.05, set: setTopP, hint: "Sampling-Wahrscheinlichkeit", color: P.purple },
            ].map(({ label, val, min, max, step, set, hint, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold" style={{ color: P.text }}>{label}</span>
                  <span className="text-sm font-black px-2.5 py-0.5 rounded-[8px]" style={{ background: `${color}15`, color }}>{val}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={(e) => set(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: color, background: `linear-gradient(to right, ${color} ${((val - min) / (max - min)) * 100}%, ${P.border} ${((val - min) / (max - min)) * 100}%)` }}
                />
                <p className="text-[10px] mt-1" style={{ color: P.muted }}>{hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Estimator */}
        <div className="bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} style={{ color: P.green }} />
            <h3 className="font-bold" style={{ color: P.text }}>Kosten-Schätzer</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Modell", val: activeModel === "llama4" ? "Llama-4 Maverick" : "Llama-3.3-70B" },
              { label: "Kosten / 1M Tokens", val: activeModel === "llama4" ? "$0.12" : "$0.80" },
              { label: "Max Tokens / Gespräch", val: maxTokens.toLocaleString() },
              { label: "Gesch. Kosten / Gespräch", val: `$${estimatedCostPerConvo}` },
              { label: "Gesch. Kosten / 472 Nutzer", val: `$${(parseFloat(estimatedCostPerConvo) * 472 * 14.2).toFixed(2)}/Monat` },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: P.muted }}>{label}</span>
                <span className="text-sm font-bold" style={{ color: P.text }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* API Health */}
        <div className="bg-white rounded-[16px] p-5" style={{ border: `1.5px solid ${P.border}`, boxShadow: "0 2px 12px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} style={{ color: P.blue }} />
            <h3 className="font-bold" style={{ color: P.text }}>OpenRouter API</h3>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Latenz (Ø)", val: "1.24s", color: P.green },
              { label: "Erfolgsrate", val: "99.4%", color: P.green },
              { label: "Rate Limit", val: "60 req/min", color: P.blue },
              { label: "API-Key Status", val: "● Gültig", color: P.green },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center justify-between py-2 px-3 rounded-[8px]" style={{ background: P.bg }}>
                <span className="text-xs" style={{ color: P.muted }}>{label}</span>
                <span className="text-xs font-bold" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Component ──────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionTitles: Record<string, { title: string; subtitle: string }> = {
    overview: { title: "System-Übersicht", subtitle: "Echtzeitdaten & KPI-Dashboard" },
    revenue: { title: "Revenue Analytics", subtitle: "Finanzkennzahlen & Umsatztrends" },
    tokens: { title: "Token-Management", subtitle: "Quota-Tracking & Verbrauchsanalyse" },
    users: { title: "Nutzer-Intelligenz", subtitle: "Lernfortschritt, Fehler & Vokabular" },
    ai: { title: "KI-Konfiguration", subtitle: "Modell-Setup & System-Prompts" },
    settings: { title: "Systemeinstellungen", subtitle: "Plattform & Sicherheitskonfiguration" },
  };

  const current = sectionTitles[activeSection];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: P.bg }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`fixed lg:relative z-30 flex flex-col h-full w-64 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: P.navy }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center font-black text-lg" style={{ background: P.yellow, color: P.navy }}>D</div>
          <div>
            <p className="font-bold text-white text-sm">DeutschFlow</p>
            <p className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>Admin Panel</p>
          </div>
          <button className="ml-auto lg:hidden text-white/50" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button key={id} onClick={() => { setActiveSection(id); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-left transition-all"
                style={{
                  background: isActive ? P.yellow : "transparent",
                  color: isActive ? P.navy : "rgba(255,255,255,0.65)",
                }}>
                <Icon size={18} className="flex-shrink-0" />
                <span className="font-semibold text-sm">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: P.navy }} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: P.yellow, color: P.navy }}>AD</div>
            <div>
              <p className="text-white text-xs font-semibold">Admin</p>
              <p className="text-white/40 text-[10px]">admin@deutschflow.app</p>
            </div>
          </div>
          <button onClick={() => navigate("/")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold transition-colors"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}>
            <ChevronLeft size={14} /> Zurück zum App
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}`, boxShadow: "0 1px 4px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-[8px] hover:bg-[#F5F5F5]" onClick={() => setSidebarOpen(true)} style={{ color: P.muted }}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="font-bold text-lg" style={{ color: P.text }}>{current.title}</h1>
              <p className="text-xs" style={{ color: P.muted }}>{current.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-semibold" style={{ background: `${P.green}15`, color: P.green, border: `1px solid ${P.green}30` }}>
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: P.green }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
              System Nominal
            </div>
            <button className="relative p-2 rounded-[10px]" style={{ background: P.bg }}>
              <Bell size={18} style={{ color: P.muted }} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: P.red, border: "2px solid white" }} />
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})`, color: "white" }}>AD</div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}>
              {activeSection === "overview" && <OverviewSection />}
              {activeSection === "revenue" && <RevenueSection />}
              {activeSection === "tokens" && <TokenSection />}
              {activeSection === "users" && <UsersSection />}
              {activeSection === "ai" && <AISection />}
              {activeSection === "settings" && (
                <div className="flex items-center justify-center py-24 flex-col gap-4">
                  <Lock size={48} style={{ color: P.border }} />
                  <p className="font-bold text-lg" style={{ color: P.muted }}>Systemeinstellungen</p>
                  <p className="text-sm" style={{ color: P.border }}>In Entwicklung · Bald verfügbar</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
