import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Euro,
  BarChart3,
  Settings,
  Bell,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Pencil,
  Trash2,
  Plus,
  Filter,
  Download,
  X,
  Check,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Globe,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  RefreshCw,
  Eye,
  BookMarked,
  Mic2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const revenueData = [
  { month: "Sep", revenue: 12400, students: 1820 },
  { month: "Okt", revenue: 13800, students: 2050 },
  { month: "Nov", revenue: 15200, students: 2190 },
  { month: "Dez", revenue: 14100, students: 2310 },
  { month: "Jan", revenue: 16500, students: 2480 },
  { month: "Feb", revenue: 15800, students: 2590 },
  { month: "Mär", revenue: 18490, students: 2847 },
];

const levelData = [
  { name: "A1 Anfänger", value: 38, color: "#10B981" },
  { name: "A2 Grundlagen", value: 29, color: "#3B82F6" },
  { name: "B1 Mittelstufe", value: 21, color: "#FFCE00" },
  { name: "B2 Fortgeschritten", value: 12, color: "#8B5CF6" },
];

type Level = "A1" | "A2" | "B1" | "B2";
type Status = "Aktiv" | "Entwurf" | "Archiviert";
type Category = "Grammatik" | "Vokabular" | "Aussprache" | "Konversation" | "Schreiben" | "Hören";

interface Lesson {
  id: string;
  title: string;
  level: Level;
  category: Category;
  createdDate: string;
  status: Status;
  students: number;
  duration: string;
}

const allLessons: Lesson[] = [
  { id: "L-001", title: "Grundlegende Begrüßungen & Vorstellungen", level: "A1", category: "Konversation", createdDate: "15.01.2025", status: "Aktiv", students: 842, duration: "12 Min" },
  { id: "L-002", title: "Zahlen, Datum und Uhrzeit", level: "A1", category: "Vokabular", createdDate: "18.01.2025", status: "Aktiv", students: 731, duration: "15 Min" },
  { id: "L-003", title: "Artikel und Nominativ", level: "A1", category: "Grammatik", createdDate: "22.01.2025", status: "Aktiv", students: 694, duration: "20 Min" },
  { id: "L-004", title: "Im Café bestellen", level: "A2", category: "Konversation", createdDate: "01.02.2025", status: "Aktiv", students: 612, duration: "18 Min" },
  { id: "L-005", title: "Perfekt mit haben und sein", level: "A2", category: "Grammatik", createdDate: "05.02.2025", status: "Aktiv", students: 589, duration: "25 Min" },
  { id: "L-006", title: "Wegbeschreibungen geben", level: "A2", category: "Konversation", createdDate: "12.02.2025", status: "Entwurf", students: 0, duration: "22 Min" },
  { id: "L-007", title: "Adjektivdeklination im Dativ", level: "B1", category: "Grammatik", createdDate: "20.02.2025", status: "Aktiv", students: 478, duration: "28 Min" },
  { id: "L-008", title: "Präpositionen mit Akkusativ", level: "B1", category: "Grammatik", createdDate: "28.02.2025", status: "Aktiv", students: 451, duration: "24 Min" },
  { id: "L-009", title: "Aussprache: Umlaute meistern", level: "A1", category: "Aussprache", createdDate: "03.03.2025", status: "Aktiv", students: 523, duration: "16 Min" },
  { id: "L-010", title: "Konjunktiv II: Wünsche & Hypothesen", level: "B2", category: "Grammatik", createdDate: "08.03.2025", status: "Aktiv", students: 312, duration: "32 Min" },
  { id: "L-011", title: "Berufliche E-Mails schreiben", level: "B2", category: "Schreiben", createdDate: "12.03.2025", status: "Entwurf", students: 0, duration: "35 Min" },
  { id: "L-012", title: "Hörverständnis: Nachrichten", level: "B1", category: "Hören", createdDate: "15.03.2025", status: "Aktiv", students: 398, duration: "20 Min" },
  { id: "L-013", title: "Familienbeziehungen & Possessivpronomen", level: "A1", category: "Vokabular", createdDate: "18.03.2025", status: "Archiviert", students: 265, duration: "14 Min" },
  { id: "L-014", title: "Das Passiv im Deutschen", level: "B2", category: "Grammatik", createdDate: "22.03.2025", status: "Aktiv", students: 287, duration: "30 Min" },
  { id: "L-015", title: "Einkaufen: Kleidung und Preise", level: "A2", category: "Vokabular", createdDate: "25.03.2025", status: "Aktiv", students: 445, duration: "18 Min" },
];

const navItems = [
  { id: "overview", label: "Übersicht", icon: LayoutDashboard },
  { id: "students", label: "Studierende", icon: Users },
  { id: "lessons", label: "Lektionen", icon: BookOpen },
  { id: "revenue", label: "Einnahmen", icon: Euro },
  { id: "reports", label: "Berichte", icon: BarChart3 },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const levelColors: Record<Level, { bg: string; text: string; border: string }> = {
  A1: { bg: "#F0FDF4", text: "#065F46", border: "#BBF7D0" },
  A2: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  B1: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  B2: { bg: "#F5F3FF", text: "#4C1D95", border: "#DDD6FE" },
};

const statusColors: Record<Status, { bg: string; text: string; dot: string }> = {
  Aktiv: { bg: "#F0FDF4", text: "#065F46", dot: "#10B981" },
  Entwurf: { bg: "#F8FAFC", text: "#475569", dot: "#94A3B8" },
  Archiviert: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
};

type SortKey = keyof Lesson;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 8;

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  trendVal,
  iconBg,
  iconColor,
  delay,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | "neutral";
  trendVal: string;
  iconBg: string;
  iconColor: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-[0_2px_10px_rgba(0,48,94,0.06)] hover:shadow-[0_4px_16px_rgba(0,48,94,0.1)] transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            trend === "up"
              ? "bg-emerald-50 text-emerald-600"
              : trend === "down"
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {trend === "up" ? <TrendingUp size={11} /> : trend === "down" ? <TrendingDown size={11} /> : <Activity size={11} />}
          {trendVal}
        </div>
      </div>
      <p className="text-[#64748B] text-xs mb-1">{label}</p>
      <p className="text-[#0F172A] text-2xl font-extrabold tracking-tight mb-1">{value}</p>
      <p className="text-[#94A3B8] text-xs">{sub}</p>
    </motion.div>
  );
}

function DeleteModal({
  lesson,
  onConfirm,
  onCancel,
}: {
  lesson: Lesson;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-[20px] p-7 max-w-md w-full shadow-2xl"
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-[#0F172A] text-lg mb-1">Lektion löschen?</h3>
            <p className="text-[#64748B] text-sm leading-relaxed">
              Möchtest du die Lektion{" "}
              <span className="font-semibold text-[#0F172A]">
                „{lesson.title}"
              </span>{" "}
              wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>
        <div className="bg-[#FEF2F2] border border-red-100 rounded-[12px] px-4 py-3 mb-6 text-sm text-red-700">
          <strong>{lesson.students} Studierende</strong> sind für diese Lektion eingeschrieben.
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold text-sm transition-colors border border-[#E2E8F0]"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-[12px] bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
          >
            Endgültig löschen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditModal({
  lesson,
  onSave,
  onCancel,
}: {
  lesson: Lesson;
  onSave: (updated: Lesson) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...lesson });

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-[20px] w-full max-w-lg shadow-2xl overflow-hidden"
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F4F8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#EEF4FF] flex items-center justify-center">
              <Pencil size={16} className="text-[#00305E]" />
            </div>
            <div>
              <h3 className="text-[#0F172A] font-semibold">Lektion bearbeiten</h3>
              <p className="text-[#94A3B8] text-xs">{lesson.id}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#94A3B8] hover:text-[#64748B] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[#0F172A] text-sm mb-1.5">Titel</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#0F172A] text-sm mb-1.5">Niveau</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as Level })}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] transition-colors appearance-none"
              >
                {(["A1","A2","B1","B2"] as Level[]).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#0F172A] text-sm mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] transition-colors appearance-none"
              >
                {(["Aktiv","Entwurf","Archiviert"] as Status[]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#0F172A] text-sm mb-1.5">Kategorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] transition-colors appearance-none"
              >
                {(["Grammatik","Vokabular","Aussprache","Konversation","Schreiben","Hören"] as Category[]).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#0F172A] text-sm mb-1.5">Dauer</label>
              <input
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#F0F4F8] bg-[#FAFBFC]">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[10px] text-[#64748B] hover:bg-[#E2E8F0] font-medium text-sm transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#00305E] hover:bg-[#002447] text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Check size={15} />
            Änderungen speichern
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] px-4 py-3 shadow-lg text-sm">
        <p className="text-[#64748B] text-xs mb-2 font-medium">{label} 2025</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="font-semibold" style={{ color: entry.color }}>
            {entry.name === "revenue" ? `€${entry.value.toLocaleString()}` : `${entry.value.toLocaleString()} Studierende`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] px-3 py-2 shadow-lg text-sm">
        <p className="font-semibold text-[#0F172A]">{payload[0].name}</p>
        <p className="text-[#64748B]">{payload[0].value}% der Studierenden</p>
      </div>
    );
  }
  return null;
};

// ─── Main Admin Component ──────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("lessons");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>(allLessons);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<Level | "Alle">("Alle");
  const [statusFilter, setStatusFilter] = useState<Status | "Alle">("Alle");
  const [sortKey, setSortKey] = useState<SortKey>("createdDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [editTarget, setEditTarget] = useState<Lesson | null>(null);
  const [chartMode, setChartMode] = useState<"revenue" | "students">("revenue");
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = lessons.filter((l) => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.title.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
      const matchLevel = levelFilter === "Alle" || l.level === levelFilter;
      const matchStatus = statusFilter === "Alle" || l.status === statusFilter;
      return matchSearch && matchLevel && matchStatus;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [lessons, search, levelFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp size={13} className="text-[#00305E]" /> : <ChevronDown size={13} className="text-[#00305E]" />
    ) : <ChevronsUpDown size={13} className="text-[#CBD5E1]" />;

  const handleDelete = () => {
    if (!deleteTarget) return;
    setLessons((l) => l.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
    triggerSuccess("Lektion erfolgreich gelöscht.");
  };

  const handleSave = (updated: Lesson) => {
    setLessons((l) => l.map((x) => (x.id === updated.id ? updated : x)));
    setEditTarget(null);
    triggerSuccess("Änderungen gespeichert.");
  };

  const triggerSuccess = (msg: string) => {
    setShowSuccess(msg);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  return (
    <div className="flex h-screen bg-[#F1F4F9] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:relative z-30 flex flex-col h-full w-60 bg-[#00305E] transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-[8px] bg-[#FFCE00] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00305E] font-extrabold text-base leading-none">D</span>
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">DeutschFlow</span>
            <div className="text-white/40 text-[10px] leading-tight font-medium tracking-widest uppercase">Admin</div>
          </div>
          <button className="ml-auto lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Hauptmenü</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveNav(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 text-left
                ${activeNav === id ? "bg-[#FFCE00] text-[#00305E]" : "text-white/60 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="font-medium text-sm">{label}</span>
              {id === "lessons" && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeNav === id ? "bg-[#00305E]/20 text-[#00305E]" : "bg-white/15 text-white"}`}>
                  {lessons.length}
                </span>
              )}
            </button>
          ))}

          <div className="my-4 border-t border-white/10" />
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-3 mb-3">Mehr</p>
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-white/60 hover:bg-white/8 hover:text-white transition-colors text-left"
          >
            <Globe size={17} />
            <span className="font-medium text-sm">Schüler-Ansicht</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-white/60 hover:bg-white/8 hover:text-white transition-colors text-left">
            <LogOut size={17} />
            <span className="font-medium text-sm">Abmelden</span>
          </button>
        </nav>

        {/* Admin profile */}
        <div className="px-3 pb-5">
          <div className="flex items-center gap-2.5 px-3 py-3 rounded-[12px] bg-white/8 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFCE00] to-[#E6B900] flex items-center justify-center flex-shrink-0">
              <span className="text-[#00305E] font-bold text-xs">SA</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-xs truncate">Stefan Adler</p>
              <p className="text-white/40 text-[10px]">Super Admin</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#10B981] flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="bg-white border-b border-[#E2E8F0] px-5 py-3.5 flex items-center gap-4 flex-shrink-0 shadow-[0_1px_3px_rgba(0,48,94,0.05)]">
          <button className="lg:hidden p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#64748B]" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>

          {/* Page title */}
          <div className="hidden sm:block">
            <h1 className="text-[#0F172A] text-base font-bold">Admin-Dashboard</h1>
            <p className="text-[#94A3B8] text-xs">Montag, 13. April 2026</p>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm mx-auto sm:mx-0 sm:ml-6">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Suchen…"
                className="w-full pl-8 pr-3 py-2 rounded-[10px] bg-[#F5F7FA] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 focus:border-[#00305E]/40 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Refresh */}
            <button className="p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#94A3B8] hover:text-[#64748B] transition-colors">
              <RefreshCw size={16} />
            </button>
            {/* Notifications */}
            <button className="relative p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#94A3B8] hover:text-[#64748B] transition-colors">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">5</span>
            </button>

            {/* Admin profile pill */}
            <div className="flex items-center gap-2.5 pl-3 pr-1 py-1 rounded-[10px] border border-[#E2E8F0] bg-[#FAFBFC] hover:bg-[#F5F7FA] transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00305E] to-[#004080] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">SA</span>
              </div>
              <div className="hidden md:block">
                <p className="text-[#0F172A] text-xs font-semibold leading-tight">Stefan Adler</p>
                <p className="text-[#94A3B8] text-[10px] leading-tight">Super Admin</p>
              </div>
              <ChevronDown size={13} className="text-[#94A3B8] ml-1" />
            </div>
          </div>
        </header>

        {/* ── Scrollable Content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={Users} label="Gesamt Studierende" value="2.847" sub="+312 diesen Monat" trend="up" trendVal="+12.3%" iconBg="#EEF4FF" iconColor="#00305E" delay={0} />
            <MetricCard icon={Activity} label="Aktive Sitzungen" value="143" sub="Gerade online" trend="up" trendVal="+8 heute" iconBg="#ECFDF5" iconColor="#10B981" delay={0.06} />
            <MetricCard icon={Euro} label="Monatseinnahmen" value="€18.490" sub="vs. €17.050 letzten Monat" trend="up" trendVal="+8.4%" iconBg="#FFFBEB" iconColor="#D97706" delay={0.12} />
            <MetricCard icon={BookOpen} label="Aktive Lektionen" value={String(lessons.filter(l => l.status === "Aktiv").length)} sub={`von ${lessons.length} gesamt`} trend="neutral" trendVal="Aktuell" iconBg="#F5F3FF" iconColor="#7C3AED" delay={0.18} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Revenue / Students Chart */}
            <div className="lg:col-span-2 bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,48,94,0.05)] p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-[#0F172A] text-sm">Verlauf der letzten 7 Monate</h3>
                  <p className="text-[#94A3B8] text-xs mt-0.5">Sep 2024 – Mär 2025</p>
                </div>
                <div className="flex bg-[#F5F7FA] rounded-[10px] p-0.5 border border-[#E2E8F0]">
                  {(["revenue","students"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-all ${chartMode === m ? "bg-white text-[#00305E] shadow-sm" : "text-[#94A3B8] hover:text-[#64748B]"}`}
                    >
                      {m === "revenue" ? "Einnahmen" : "Studierende"}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00305E" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#00305E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11 }}
                    tickFormatter={(v) => chartMode === "revenue" ? `€${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={chartMode}
                    stroke={chartMode === "revenue" ? "#00305E" : "#10B981"}
                    strokeWidth={2.5}
                    fill={chartMode === "revenue" ? "url(#colorRevenue)" : "url(#colorStudents)"}
                    dot={{ fill: chartMode === "revenue" ? "#00305E" : "#10B981", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Level Distribution */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,48,94,0.05)] p-5">
              <h3 className="font-semibold text-[#0F172A] text-sm mb-1">Niveauverteilung</h3>
              <p className="text-[#94A3B8] text-xs mb-4">Studierende nach Niveau</p>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={levelData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                    {levelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {levelData.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[#64748B]">{name}</span>
                    </div>
                    <span className="font-semibold text-[#0F172A]">{value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Lesson Table ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,48,94,0.05)] overflow-hidden">

            {/* Table Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-[#F0F4F8]">
              <div>
                <h3 className="font-semibold text-[#0F172A] text-sm">Lektionen verwalten</h3>
                <p className="text-[#94A3B8] text-xs mt-0.5">{filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}</p>
              </div>

              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Lektion suchen…"
                    className="pl-7 pr-3 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 focus:border-[#00305E]/40 w-44 transition-colors"
                  />
                </div>

                {/* Level filter */}
                <div className="relative">
                  <select
                    value={levelFilter}
                    onChange={(e) => { setLevelFilter(e.target.value as any); setPage(1); }}
                    className="appearance-none pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 focus:border-[#00305E]/40 transition-colors cursor-pointer"
                  >
                    <option value="Alle">Alle Niveaus</option>
                    {(["A1","A2","B1","B2"] as Level[]).map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                </div>

                {/* Status filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                    className="appearance-none pl-3 pr-7 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 focus:border-[#00305E]/40 transition-colors cursor-pointer"
                  >
                    <option value="Alle">Alle Status</option>
                    {(["Aktiv","Entwurf","Archiviert"] as Status[]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                </div>

                {/* Export */}
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] hover:bg-[#F5F7FA] text-[#64748B] text-xs font-medium transition-colors">
                  <Download size={13} />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {/* Add new */}
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#00305E] hover:bg-[#002447] text-white text-xs font-semibold transition-colors shadow-sm">
                  <Plus size={13} />
                  Neu
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F4F8] bg-[#FAFBFC]">
                    {[
                      { key: "id" as SortKey, label: "ID", w: "w-20" },
                      { key: "title" as SortKey, label: "Titel", w: "min-w-[220px]" },
                      { key: "level" as SortKey, label: "Niveau", w: "w-24" },
                      { key: "category" as SortKey, label: "Kategorie", w: "w-32" },
                      { key: "students" as SortKey, label: "Stud.", w: "w-20" },
                      { key: "status" as SortKey, label: "Status", w: "w-28" },
                      { key: "createdDate" as SortKey, label: "Erstellt", w: "w-28" },
                    ].map(({ key, label, w }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className={`${w} px-4 py-3 text-left text-[#64748B] text-xs font-semibold tracking-wide cursor-pointer hover:text-[#00305E] select-none whitespace-nowrap`}
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          <SortIcon col={key} />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-[#64748B] text-xs font-semibold tracking-wide w-28">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-[#94A3B8] text-sm">
                          Keine Lektionen gefunden.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((lesson, i) => {
                        const lvl = levelColors[lesson.level];
                        const st = statusColors[lesson.status];
                        return (
                          <motion.tr
                            key={lesson.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-[#F8FAFC] hover:bg-[#FAFBFF] transition-colors group"
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-[#94A3B8] bg-[#F5F7FA] px-2 py-0.5 rounded-[6px]">
                                {lesson.id}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-[8px] bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                                  {lesson.category === "Aussprache" ? <Mic2 size={13} className="text-[#00305E]" /> :
                                   lesson.category === "Vokabular" ? <BookMarked size={13} className="text-[#00305E]" /> :
                                   <BookOpen size={13} className="text-[#00305E]" />}
                                </div>
                                <span className="font-medium text-[#0F172A] text-xs leading-snug line-clamp-1">
                                  {lesson.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-xs font-bold border"
                                style={{ backgroundColor: lvl.bg, color: lvl.text, borderColor: lvl.border }}
                              >
                                {lesson.level}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[#64748B] text-xs">{lesson.category}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 text-[#64748B] text-xs">
                                <Users size={11} />
                                <span>{lesson.students.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: st.dot }}
                                />
                                <span
                                  className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-xs font-medium"
                                  style={{ backgroundColor: st.bg, color: st.text }}
                                >
                                  {lesson.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[#64748B] text-xs">{lesson.createdDate}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Vorschau"
                                  className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#00305E] transition-colors"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => setEditTarget(lesson)}
                                  title="Bearbeiten"
                                  className="p-1.5 rounded-[6px] hover:bg-[#EEF4FF] text-[#94A3B8] hover:text-[#00305E] transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(lesson)}
                                  title="Löschen"
                                  className="p-1.5 rounded-[6px] hover:bg-[#FEF2F2] text-[#94A3B8] hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-[#F0F4F8] bg-[#FAFBFC]">
              <p className="text-[#94A3B8] text-xs">
                Zeige{" "}
                <span className="font-semibold text-[#64748B]">
                  {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}
                </span>{" "}
                von <span className="font-semibold text-[#64748B]">{filtered.length}</span> Einträgen
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-[7px] border border-[#E2E8F0] disabled:opacity-40 hover:bg-white disabled:cursor-not-allowed transition-colors text-[#64748B]"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-[7px] text-xs font-semibold transition-colors border ${
                      page === p
                        ? "bg-[#00305E] text-white border-[#00305E]"
                        : "border-[#E2E8F0] text-[#64748B] hover:bg-white hover:text-[#00305E]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-[7px] border border-[#E2E8F0] disabled:opacity-40 hover:bg-white disabled:cursor-not-allowed transition-colors text-[#64748B]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            lesson={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
        {editTarget && (
          <EditModal
            lesson={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-[#0F172A] text-white px-5 py-3.5 rounded-[14px] shadow-2xl text-sm font-medium"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0">
              <Check size={13} className="text-white" />
            </div>
            {showSuccess}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
