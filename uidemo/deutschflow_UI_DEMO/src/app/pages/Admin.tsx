import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard, TrendingUp, Coins, Users, Bot,
  ChevronLeft, Bell, ArrowUpRight, ArrowDownRight,
  Zap, Brain, Timer, RefreshCw, Search,
  Check, X, AlertTriangle, DollarSign, Activity,
  Sliders, FileText, Copy, Save, ToggleLeft, ToggleRight,
  Sparkles, CircuitBoard, Flame,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Palette ───────────────────────────────────────────────────────────────────
const P = {
  navy: "#00305E", navyLt: "#EBF2FA",
  blue: "#2D9CDB", blueLt: "#EBF5FB",
  red: "#EB5757", redLt: "#FDEAEA",
  green: "#27AE60", greenLt: "#E8F8F0",
  yellow: "#FFCE00", yellowLt: "#FFF8E1",
  purple: "#9B51E0", purpleLt: "#F4EDFF",
  orange: "#F2994A", orangeLt: "#FEF3E8",
  bg: "#F5F5F5", white: "#FFFFFF",
  text: "#0F172A", muted: "#64748B", border: "#E2E8F0",
};

// ─── Data ──────────────────────────────────────────────────────────────────────
const MONTHLY = [
  { m: "Jan", r: 31.5, p: 19.2 }, { m: "Feb", r: 33, p: 20.1 },
  { m: "Mar", r: 35, p: 21.4 }, { m: "Apr", r: 34.5, p: 21.0 },
  { m: "Mai", r: 38, p: 23.1 }, { m: "Jun", r: 40, p: 24.4 },
  { m: "Jul", r: 42.5, p: 25.8 }, { m: "Aug", r: 44, p: 26.8 },
  { m: "Sep", r: 43.5, p: 26.4 }, { m: "Okt", r: 45, p: 27.4 },
  { m: "Nov", r: 46.5, p: 28.3 }, { m: "Dez", r: 47.25, p: 28.7 },
];

const TOKEN_PIE = [
  { name: "AI Speaking", value: 2100000, color: P.blue },
  { name: "LLM Antwort", value: 1800000, color: P.purple },
  { name: "Grammatik", value: 650000, color: P.orange },
  { name: "Transkription", value: 297320, color: P.green },
];

const USERS = [
  { id: "USR001", name: "Nguyen Thi Mai", av: "NM", level: "B1", tokens: 8450, ai: 890, errors: ["Auxiliarverb", "der-Artikel"], vocab: 650, active: true, streak: 23 },
  { id: "USR002", name: "Tran Van Minh", av: "TM", level: "A2", tokens: 9120, ai: 445, errors: ["Präteritum", "Dativ/Akk."], vocab: 320, active: true, streak: 7 },
  { id: "USR003", name: "Le Hoang Nam", av: "LN", level: "A1", tokens: 9780, ai: 120, errors: ["Artikel", "Plural"], vocab: 145, active: true, streak: 3 },
  { id: "USR004", name: "Pham Thi Lan", av: "PL", level: "B2", tokens: 6230, ai: 1890, errors: ["Konjunktiv II", "Kontraktion"], vocab: 920, active: true, streak: 45 },
  { id: "USR005", name: "Vo Duc Khoa", av: "VK", level: "A2", tokens: 7890, ai: 560, errors: ["Präteritum", "Genus"], vocab: 410, active: false, streak: 0 },
  { id: "USR006", name: "Dang Thi Hoa", av: "DH", level: "B1", tokens: 5560, ai: 1200, errors: ["Passiv", "der/die/das"], vocab: 730, active: true, streak: 18 },
];

const ERRORS = [
  { cat: "der (Maskulin)", pct: 82, count: 287, color: P.blue },
  { cat: "die (Feminin)", pct: 67, count: 234, color: P.red },
  { cat: "das (Neutrum)", pct: 57, count: 198, color: P.green },
  { cat: "haben vs. sein", pct: 89, count: 312, color: P.purple },
  { cat: "Dativ vs. Akk.", pct: 73, count: 256, color: P.muted },
];

const PROMPT_DEFAULT = `Du bist ein erfahrener Deutschlehrer-KI.

Aufgaben:
1. Analysiere die Grammatik genau
2. Korrigiere Fehler konstruktiv
3. Erkläre Regeln auf Englisch/Vietnamesisch
4. Passe dein Niveau an (A1-B2)
5. Motiviere den Lernenden

Fehler-Priorisierung:
- HOCH: Falsche Artikel (der/die/das)
- MITTEL: Auxiliarverb haben/sein
- NIEDRIG: Rechtschreibfehler

Format: JSON {corrected, explanation, tip}`;

const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

// ─── Tab Navigation ────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Überblick", icon: LayoutDashboard },
  { id: "revenue", label: "Revenue", icon: TrendingUp },
  { id: "tokens", label: "Tokens", icon: Coins },
  { id: "users", label: "Nutzer", icon: Users },
  { id: "ai", label: "KI", icon: Bot },
];

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-[10px] shadow-lg px-3 py-2 border border-[#E2E8F0]">
      <p className="text-[10px] font-bold mb-1" style={{ color: P.muted }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-xs font-bold">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: p.color }}>{p.value}M ₫</span>
        </div>
      ))}
    </div>
  );
};

// ─── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const used = TOKEN_PIE.reduce((s, t) => s + t.value, 0);
  const kpis = [
    { label: "Umsatz", val: "47.25M ₫", trend: "+12.3%", up: true, color: P.green },
    { label: "Nettogewinn", val: "28.73M ₫", trend: "+8.1%", up: true, color: P.blue },
    { label: "Aktive Nutzer", val: "472 / 1.000", trend: "+7.8%", up: true, color: P.purple },
    { label: "Token-Quota", val: `${fmt(used)} / 10M`, trend: `${((used / 10e6) * 100).toFixed(0)}%`, up: false, color: P.orange },
  ];
  const sys = [
    { label: "OpenRouter API", ok: true },
    { label: "Llama-4 Maverick", ok: true },
    { label: "Llama-3.3-70B", ok: false },
    { label: "Supabase DB", ok: true },
    { label: "Token Billing", ok: true },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, val, trend, up, color }) => (
          <div key={label} className="bg-white rounded-[16px] p-4"
            style={{ border: `1.5px solid ${color}20`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.muted }}>{label}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: up ? P.greenLt : P.orangeLt, color: up ? P.green : P.orange }}>
                {up ? <ArrowUpRight size={10} className="inline" /> : null}{trend}
              </span>
            </div>
            <p className="font-black text-base" style={{ color: P.text }}>{val}</p>
            <div className="mt-2 h-1 rounded-full" style={{ background: `${color}20` }}>
              <div className="h-full rounded-full" style={{ background: color, width: "100%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Mini Chart */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold" style={{ color: P.text }}>Umsatz 2025</p>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2D9CDB] inline-block" />Umsatz</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#27AE60] inline-block" />Gewinn</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={MONTHLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rg-overview" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.blue} stopOpacity={0.2} />
                <stop offset="100%" stopColor={P.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pg-overview" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.green} stopOpacity={0.2} />
                <stop offset="100%" stopColor={P.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
            <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 10 }} />
            <Tooltip content={<CTip />} />
            <Area key="area-umsatz-ov" type="monotone" dataKey="r" stroke={P.blue} strokeWidth={2} fill="url(#rg-overview)" />
            <Area key="area-gewinn-ov" type="monotone" dataKey="p" stroke={P.green} strokeWidth={2} fill="url(#pg-overview)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <p className="font-bold mb-3" style={{ color: P.text }}>System-Status</p>
        <div className="space-y-2">
          {sys.map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between py-2 px-3 rounded-[10px]" style={{ background: P.bg }}>
              <span className="text-sm" style={{ color: P.text }}>{label}</span>
              <div className="flex items-center gap-1.5">
                <motion.div className="w-2 h-2 rounded-full" style={{ background: ok ? P.green : P.orange }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: ok ? 2 : 0.8, repeat: Infinity }} />
                <span className="text-[10px] font-bold" style={{ color: ok ? P.green : P.orange }}>
                  {ok ? "Online" : "Degraded"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Tab ───────────────────────────────────────────────────────────────
function RevenueTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jahresumsatz", val: "480.75M ₫", color: P.blue, bg: P.blueLt },
          { label: "Jahresgewinn", val: "292.6M ₫", color: P.green, bg: P.greenLt },
          { label: "Marge", val: "60.9%", color: P.purple, bg: P.purpleLt },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className="rounded-[14px] p-3 text-center" style={{ background: bg, border: `1.5px solid ${color}30` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color }}>{label}</p>
            <p className="font-black text-sm" style={{ color: P.text }}>{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <p className="font-bold mb-1" style={{ color: P.text }}>Monatlicher Verlauf</p>
        <p className="text-xs mb-3" style={{ color: P.muted }}>Abonnement: 100.000 ₫/Monat</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={MONTHLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.blue} stopOpacity={0.25} />
                <stop offset="100%" stopColor={P.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={P.green} stopOpacity={0.25} />
                <stop offset="100%" stopColor={P.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
            <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fill: P.muted, fontSize: 10 }} />
            <Tooltip content={<CTip />} />
            <Area key="area-umsatz-rev" type="monotone" dataKey="r" name="Umsatz" stroke={P.blue} strokeWidth={2.5} fill="url(#rg2)" dot={{ fill: P.blue, r: 2 }} />
            <Area key="area-gewinn-rev" type="monotone" dataKey="p" name="Gewinn" stroke={P.green} strokeWidth={2.5} fill="url(#pg2)" dot={{ fill: P.green, r: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly table (scrollable) */}
      <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: `1.5px solid ${P.border}` }}>
        <p className="font-bold px-4 py-3" style={{ color: P.text, borderBottom: `1px solid ${P.border}` }}>Aufschlüsselung</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: P.bg }}>
                {["Monat", "Nutzer", "Umsatz", "Store (15%)", "Netto"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-widest" style={{ color: P.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHLY.map((row, i) => {
                const gross = row.r * 1_000_000;
                const net = gross - gross * 0.15 - 8_000_000;
                return (
                  <tr key={row.m} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none", background: i % 2 === 0 ? P.white : "#FAFBFF" }}>
                    <td className="px-3 py-2.5 font-bold" style={{ color: P.text }}>{row.m}</td>
                    <td className="px-3 py-2.5" style={{ color: P.muted }}>{Math.round(row.r / 0.1)}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: P.blue }}>{row.r}M</td>
                    <td className="px-3 py-2.5" style={{ color: P.red }}>-{(row.r * 0.15).toFixed(2)}M</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: P.green }}>{(net / 1_000_000).toFixed(1)}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tokens Tab ────────────────────────────────────────────────────────────────
function TokensTab() {
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const diff = next.getTime() - now.getTime();
      setCd({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const total = 10_000_000;
  const used = TOKEN_PIE.reduce((s, t) => s + t.value, 0);
  const pct = (used / total) * 100;

  return (
    <div className="space-y-4">
      {/* Donut + meter */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <p className="font-bold mb-3" style={{ color: P.text }}>Quota-Nutzung</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={TOKEN_PIE} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" paddingAngle={3}>
              {TOKEN_PIE.map((e) => <Cell key={`pie-cell-${e.name}`} fill={e.color} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center -mt-2 mb-4">
          <p className="font-black text-2xl" style={{ color: P.text }}>{pct.toFixed(1)}%</p>
          <p className="text-xs" style={{ color: P.muted }}>von 10M Tokens verbraucht</p>
        </div>
        <div className="space-y-2">
          {TOKEN_PIE.map((t) => (
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

      {/* Countdown */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Timer size={16} style={{ color: P.orange }} />
          <p className="font-bold" style={{ color: P.text }}>Nächster Reset (UTC)</p>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[{ v: cd.d, l: "Tage" }, { v: cd.h, l: "Std" }, { v: cd.m, l: "Min" }, { v: cd.s, l: "Sek" }].map(({ v, l }) => (
            <div key={l} className="flex flex-col items-center py-3 rounded-[12px]"
              style={{ background: P.navyLt }}>
              <motion.span className="font-black text-xl" style={{ color: P.navy }}
                key={v} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 0.15 }}>
                {String(v).padStart(2, "0")}
              </motion.span>
              <span className="text-[9px] font-bold uppercase" style={{ color: P.muted }}>{l}</span>
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full mb-1.5" style={{ background: P.border }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct > 80 ? P.red : pct > 60 ? P.orange : P.green }} />
        </div>
        <p className="text-xs" style={{ color: P.muted }}>{fmt(total - used)} Tokens verbleibend</p>
      </div>

      {/* Per-service bars */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <p className="font-bold mb-3" style={{ color: P.text }}>Verbrauch nach Service</p>
        <div className="space-y-3">
          {TOKEN_PIE.map((t) => (
            <div key={t.name}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span style={{ color: P.text }}>{t.name}</span>
                <span className="font-bold" style={{ color: t.color }}>{fmt(t.value)} · {((t.value / total) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: `${t.color}20` }}>
                <motion.div className="h-full rounded-full" style={{ background: t.color }}
                  initial={{ width: 0 }} animate={{ width: `${(t.value / total) * 100}%` }} transition={{ duration: 0.8 }} />
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 w-full py-3 rounded-[12px] font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: P.navy, color: P.white }}>
          <RefreshCw size={14} /> Manuell zurücksetzen
        </button>
      </div>
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState("");
  const filtered = USERS.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search));

  return (
    <div className="space-y-4">
      {/* Error Heatmap */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={15} style={{ color: P.orange }} />
          <p className="font-bold" style={{ color: P.text }}>Fehler-Heatmap</p>
        </div>
        <div className="space-y-2.5">
          {ERRORS.map(({ cat, pct, count, color }) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span style={{ color: P.text }}>{cat}</span>
                <span className="font-bold" style={{ color }}>{count} Fehler · {pct}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: P.bg }}>
                <motion.div className="h-full rounded-full" style={{ background: `${color}60` }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}>
                  <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
                </motion.div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[9px] font-semibold">
          {[[P.blue, "der"], [P.red, "die"], [P.green, "das"], [P.purple, "Verb"]].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: c }} />
              <span style={{ color: P.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-[12px]"
        style={{ border: `1.5px solid ${P.border}` }}>
        <Search size={15} style={{ color: P.muted }} />
        <input className="flex-1 bg-transparent outline-none text-sm" placeholder="Nutzer suchen..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ color: P.text }} />
      </div>

      {/* User Cards */}
      <div className="space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className="bg-white rounded-[16px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.blue})` }}>
                {u.av}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate" style={{ color: P.text }}>{u.name}</p>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    style={{ background: P.navyLt, color: P.navy }}>{u.level}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px]" style={{ color: P.muted }}>{u.id}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: u.active ? P.green : P.red }}>
                    {u.active ? "● Aktiv" : "○ Inaktiv"}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px]" style={{ color: P.orange }}>
                    <Flame size={10} />{u.streak}d
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "AI-Tks", val: `${u.ai}`, color: P.purple },
                { label: "Tokens", val: `${u.tokens.toLocaleString()}`, color: u.tokens > 5000 ? P.green : P.red },
                { label: "Vokabeln", val: `${u.vocab}/1k`, color: P.blue },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-[10px] p-2 text-center" style={{ background: P.bg }}>
                  <p className="font-black text-sm" style={{ color }}>{val}</p>
                  <p className="text-[9px]" style={{ color: P.muted }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Vocab progress */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1 text-[10px]">
                <span style={{ color: P.muted }}>Vokabelfortschritt</span>
                <span className="font-bold" style={{ color: P.green }}>{u.vocab}/1000</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: P.border }}>
                <div className="h-full rounded-full" style={{ width: `${(u.vocab / 1000) * 100}%`, background: P.green }} />
              </div>
            </div>

            {/* Error pills */}
            <div className="flex flex-wrap gap-1.5">
              {u.errors.map((e, ei) => (
                <span key={e} className="text-[10px] px-2 py-0.5 rounded-[6px] font-semibold"
                  style={{ background: `${ei === 0 ? P.blue : P.red}15`, color: ei === 0 ? P.blue : P.red, border: `1px solid ${ei === 0 ? P.blue : P.red}30` }}>
                  {e}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Config Tab ─────────────────────────────────────────────────────────────
function AITab() {
  const [model, setModel] = useState<"llama4" | "llama33">("llama4");
  const [hybrid, setHybrid] = useState(true);
  const [prompt, setPrompt] = useState(PROMPT_DEFAULT);
  const [temp, setTemp] = useState(0.7);
  const [maxTok, setMaxTok] = useState(1024);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="space-y-4">
      {/* Model Selector */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <CircuitBoard size={16} style={{ color: P.purple }} />
          <p className="font-bold" style={{ color: P.text }}>Modell-Auswahl</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { id: "llama4", name: "Llama-4 Maverick", params: "17B Param.", speed: "Schnell", cost: "$0.12/1M", badge: "Empfohlen", color: P.green },
            { id: "llama33", name: "Llama-3.3-70B", params: "70B Param.", speed: "Langsam", cost: "$0.80/1M", badge: "Präzise", color: P.blue },
          ].map((m) => (
            <button key={m.id} onClick={() => setModel(m.id as any)}
              className="rounded-[14px] p-3 text-left transition-all"
              style={{ border: `2px solid ${model === m.id ? m.color : P.border}`, background: model === m.id ? `${m.color}08` : P.white }}>
              <div className="flex items-center justify-between mb-2">
                <Brain size={18} style={{ color: m.color }} />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${m.color}20`, color: m.color }}>{m.badge}</span>
              </div>
              <p className="font-bold text-xs mb-0.5" style={{ color: P.text }}>{m.name}</p>
              <p className="text-[10px]" style={{ color: P.muted }}>{m.params} · {m.speed}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color: m.color }}>{m.cost}</p>
              {model === m.id && (
                <div className="mt-2 pt-2 flex items-center gap-1" style={{ borderTop: `1px solid ${m.color}30` }}>
                  <Check size={11} style={{ color: m.color }} />
                  <span className="text-[10px] font-bold" style={{ color: m.color }}>Aktiv</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Hybrid Toggle */}
        <div className="flex items-center justify-between p-3 rounded-[12px]"
          style={{ background: hybrid ? `${P.purple}08` : P.bg, border: `1.5px solid ${hybrid ? P.purple + "40" : P.border}` }}>
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles size={13} style={{ color: P.purple }} />
              <p className="text-sm font-bold" style={{ color: P.text }}>Hybrid-Modus</p>
            </div>
            <p className="text-[10px]" style={{ color: P.muted }}>17B für Chat · 70B für Grammatik</p>
          </div>
          <button onClick={() => setHybrid(v => !v)}>
            {hybrid ? <ToggleRight size={28} style={{ color: P.purple }} /> : <ToggleLeft size={28} style={{ color: P.muted }} />}
          </button>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={15} style={{ color: P.blue }} />
            <p className="font-bold" style={{ color: P.text }}>System-Prompt</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard?.writeText(prompt)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[10px] font-semibold"
              style={{ background: P.bg, color: P.muted, border: `1px solid ${P.border}` }}>
              <Copy size={11} /> Kopieren
            </button>
            <button onClick={save}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[10px] font-bold"
              style={{ background: saved ? P.green : P.navy, color: P.white }}>
              {saved ? <><Check size={11} /> OK!</> : <><Save size={11} /> Speichern</>}
            </button>
          </div>
        </div>
        <div className="relative rounded-[12px] overflow-hidden">
          <div className="absolute top-2.5 left-3 flex items-center gap-1 z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={10}
            className="w-full p-4 pt-9 text-xs font-mono resize-none outline-none"
            style={{ background: "#0F172A", color: "#E2E8F0", lineHeight: 1.7 }} />
        </div>
        <p className="text-[10px] mt-1.5 text-right" style={{ color: P.orange }}>
          ⚠ Betrifft alle zukünftigen Sitzungen
        </p>
      </div>

      {/* Parameters */}
      <div className="bg-white rounded-[20px] p-4" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={15} style={{ color: P.orange }} />
          <p className="font-bold" style={{ color: P.text }}>Modell-Parameter</p>
        </div>
        <div className="space-y-4">
          {[
            { label: "Temperatur", val: temp, min: 0, max: 2, step: 0.05, set: setTemp, color: P.orange, hint: "Kreativität" },
            { label: "Max. Tokens", val: maxTok, min: 256, max: 4096, step: 128, set: setMaxTok, color: P.blue, hint: "Antwortlänge" },
          ].map(({ label, val, min, max, step, set, color, hint }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold" style={{ color: P.text }}>{label}</span>
                  <span className="text-[10px] ml-1.5" style={{ color: P.muted }}>{hint}</span>
                </div>
                <span className="text-sm font-black px-2 py-0.5 rounded-[8px]"
                  style={{ background: `${color}15`, color }}>{val}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => set(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Cost Estimator */}
      <div className="bg-white rounded-[20px] p-4 mb-2" style={{ border: `1.5px solid ${P.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={15} style={{ color: P.green }} />
          <p className="font-bold" style={{ color: P.text }}>Kosten-Schätzer</p>
        </div>
        <div className="space-y-2">
          {[
            ["Modell", model === "llama4" ? "Llama-4 Maverick" : "Llama-3.3-70B"],
            ["Rate / 1M Tokens", model === "llama4" ? "$0.12" : "$0.80"],
            ["Max Tokens / Gespräch", `${maxTok.toLocaleString()}`],
            ["Ø Kosten / Gespräch", `$${((maxTok * (model === "llama4" ? 0.12 : 0.80)) / 1_000_000).toFixed(5)}`],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between py-2 px-3 rounded-[10px]" style={{ background: P.bg }}>
              <span className="text-xs" style={{ color: P.muted }}>{l}</span>
              <span className="text-sm font-bold" style={{ color: P.text }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin ────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const tabContent: Record<string, React.ReactNode> = {
    overview: <OverviewTab />,
    revenue: <RevenueTab />,
    tokens: <TokensTab />,
    users: <UsersTab />,
    ai: <AITab />,
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: P.bg }}>
      <div className="max-w-[430px] mx-auto">

        {/* Header */}
        <header className="bg-white px-5 pt-12 pb-4 flex items-center justify-between"
          style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.06)" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")}
              className="w-9 h-9 flex items-center justify-center rounded-[10px]"
              style={{ background: P.navyLt }}>
              <ChevronLeft size={18} style={{ color: P.navy }} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-[6px] flex items-center justify-center font-black text-sm"
                  style={{ background: P.yellow, color: P.navy }}>D</div>
                <p className="font-extrabold" style={{ color: P.navy }}>Admin Panel</p>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: P.green }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <p className="text-[10px] font-semibold" style={{ color: P.green }}>System Nominal</p>
              </div>
            </div>
          </div>
          <button className="relative w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: P.bg }}>
            <Bell size={18} style={{ color: P.muted }} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full"
              style={{ background: P.red, border: "2px solid white" }} />
          </button>
        </header>

        {/* Page Content */}
        <div className="px-4 pt-4">
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}>
              {tabContent[tab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Admin Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white flex items-end justify-around px-1"
        style={{ height: 64, borderTop: `1px solid ${P.border}`, boxShadow: "0 -4px 24px rgba(0,48,94,0.09)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className="relative flex flex-col items-center justify-center gap-1 h-full flex-1">
              <motion.div className="relative flex items-center justify-center rounded-[12px]"
                style={{ width: 40, height: 32 }}
                animate={{ background: active ? P.navy : "rgba(0,0,0,0)" }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}>
                <Icon size={17} className="relative z-10" style={{ color: active ? P.yellow : P.muted }} strokeWidth={active ? 2.5 : 2} />
              </motion.div>
              <span className="text-[9px] font-bold" style={{ color: active ? P.navy : P.muted }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}