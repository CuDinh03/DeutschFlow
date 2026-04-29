"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Mic2,
  BookMarked,
  Settings,
  Flame,
  Bell,
  ChevronRight,
  Play,
  Clock,
  Star,
  TrendingUp,
  Trophy,
  Target,
  Zap,
  Menu,
  X,
  ShieldCheck,
  Gamepad2,
  Map,
  Library,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const weeklyData = [
  { day: "Mo", minutes: 25 },
  { day: "Di", minutes: 40 },
  { day: "Mi", minutes: 15 },
  { day: "Do", minutes: 55 },
  { day: "Fr", minutes: 35 },
  { day: "Sa", minutes: 60 },
  { day: "So", minutes: 20 },
];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "courses", label: "My Courses", icon: BookOpen },
  { id: "speaking", label: "AI Speaking", icon: Mic2 },
  { id: "vocabulary", label: "Vocabulary", icon: BookMarked },
  { id: "settings", label: "Settings", icon: Settings },
];

const recommendedLessons = [
  {
    id: 1,
    title: "German Greetings & Small Talk",
    level: "A1",
    duration: "12 min",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1761139844010-442a8b0f5c4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxHZXJtYW4lMjBjaXR5JTIwYXJjaGl0ZWN0dXJlJTIwdHJhdmVsfGVufDF8fHx8MTc3NTk3MTgzMHww&ixlib=rb-4.1.0&q=80&w=400",
    tag: "Beliebt",
    tagColor: "bg-[#FFCE00] text-[#00305E]",
  },
  {
    id: 2,
    title: "Everyday Conversations",
    level: "A2",
    duration: "18 min",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1758270704787-615782711641?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYW5ndWFnZSUyMGxlYXJuaW5nJTIwY29udmVyc2F0aW9uJTIwY2xhc3Nyb29tfGVufDF8fHx8MTc3NjA3NjE1OHww&ixlib=rb-4.1.0&q=80&w=400",
    tag: "Neu",
    tagColor: "bg-[#10B981] text-white",
  },
  {
    id: 3,
    title: "Café & Restaurant German",
    level: "A2",
    duration: "15 min",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1750809411153-eb949a8fd9b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wJTIwcmVhZGluZyUyMGJvb2slMjBzdHVkeXxlbnwxfHx8fDE3NzYwNzYxNTh8MA&ixlib=rb-4.1.0&q=80&w=400",
    tag: "Empfohlen",
    tagColor: "bg-[#3B82F6] text-white",
  },
  {
    id: 4,
    title: "Pronunciation Mastery",
    level: "B1",
    duration: "22 min",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1627667049482-dd134b1f6366?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaWNyb3Bob25lJTIwcG9kY2FzdCUyMHNwZWFraW5nJTIwcmVjb3JkaW5nfGVufDF8fHx8MTc3NjA3NjE1OXww&ixlib=rb-4.1.0&q=80&w=400",
    tag: "Fortgeschritten",
    tagColor: "bg-[#8B5CF6] text-white",
  },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-[12px] shadow-lg px-3 py-2 border border-[#E2E8F0]">
        <p className="text-[#64748B] text-xs mb-1">{label}</p>
        <p className="text-[#00305E] font-semibold text-sm">
          {payload[0].value} Min.
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const totalMinutes = weeklyData.reduce((sum, d) => sum + d.minutes, 0);
  const avgMinutes = Math.round(totalMinutes / weeklyData.length);

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-30 flex flex-col h-full w-64 bg-[#00305E] text-white transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-9 h-9 rounded-[10px] bg-[#FFCE00] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00305E] font-extrabold text-lg leading-none">
              D
            </span>
          </div>
          <span className="font-bold text-xl tracking-tight">DeutschFlow</span>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveNav(id);
                setSidebarOpen(false);
                if (id === "speaking") router.push("/speaking");
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all duration-200 text-left group
                ${
                  activeNav === id
                    ? "bg-[#FFCE00] text-[#00305E] shadow-md"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              <Icon size={19} className="flex-shrink-0" />
              <span className="font-medium text-sm">{label}</span>
              {activeNav === id && (
                <ChevronRight
                  size={14}
                  className="ml-auto text-[#00305E]/60"
                />
              )}
            </button>
          ))}

          <div className="my-3 border-t border-white/10" />

          <button
            onClick={() => { router.push("/roadmap"); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
          >
            <Map size={19} className="flex-shrink-0" />
            <span className="font-medium text-sm">Lernpfad</span>
            <span className="ml-auto text-[10px] font-bold bg-[#FFCE00] text-[#00305E] px-1.5 py-0.5 rounded-full">Neu</span>
          </button>

          <button
            onClick={() => { router.push("/vocabulary"); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
          >
            <Library size={19} className="flex-shrink-0" />
            <span className="font-medium text-sm">Vokabular</span>
          </button>

          <button
            onClick={() => { router.push("/game"); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-left"
          >
            <Gamepad2 size={19} className="flex-shrink-0" />
            <span className="font-medium text-sm">Lego-Spiel</span>
          </button>
        </nav>

        <div className="px-3 pb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-white/8 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFCE00] to-[#E6B900] flex items-center justify-center flex-shrink-0">
              <span className="text-[#00305E] font-bold text-sm">HC</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white truncate">
                Huy Cự
              </p>
              <p className="text-white/50 text-xs">Niveau A2 · 14 Tage 🔥</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="mt-2 w-full flex items-center gap-2 px-4 py-2 rounded-[10px] text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-xs"
          >
            <ShieldCheck size={13} />
            Admin-Dashboard
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-[0_1px_3px_rgba(0,48,94,0.06)]">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-[10px] hover:bg-[#F5F7FA] text-[#64748B]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-xl text-[#1A1A1A]">
                Hallo, <span className="text-[#00305E]">Huy Cự!</span> 👋
              </h1>
              <p className="text-[#64748B] text-sm mt-0.5">
                Weiter so — du bist auf einem tollen Weg!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFCE00]/40 rounded-[12px] px-3 py-2">
              <Flame size={18} className="text-orange-500" fill="#f97316" />
              <span className="font-bold text-[#00305E] text-sm">14 Tage</span>
              <span className="text-[#64748B] text-xs hidden sm:inline">
                Serie
              </span>
            </div>
            <button className="relative p-2.5 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] transition-colors">
              <Bell size={18} className="text-[#64748B]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FFCE00] rounded-full border border-white" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00305E] to-[#004080] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">HC</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                icon: Flame,
                label: "Tages-Serie",
                value: "14 Tage",
                color: "text-orange-500",
                bg: "bg-orange-50",
                fill: "#f97316",
              },
              {
                icon: Trophy,
                label: "XP diese Woche",
                value: "1.240 XP",
                color: "text-[#FFCE00]",
                bg: "bg-yellow-50",
                fill: "#FFCE00",
              },
              {
                icon: Target,
                label: "Abgeschlossen",
                value: "28 Einh.",
                color: "text-[#10B981]",
                bg: "bg-emerald-50",
                fill: undefined,
              },
              {
                icon: Zap,
                label: "Ø Tägliche Min.",
                value: `${avgMinutes} Min.`,
                color: "text-[#3B82F6]",
                bg: "bg-blue-50",
                fill: undefined,
              },
            ].map(({ icon: Icon, label, value, color, bg, fill }) => (
              <div
                key={label}
                className="bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]"
              >
                <div
                  className={`w-9 h-9 rounded-[10px] ${bg} flex items-center justify-center mb-3`}
                >
                  <Icon size={18} className={color} fill={fill} />
                </div>
                <p className="text-[#64748B] text-xs mb-0.5">{label}</p>
                <p className="font-bold text-[#1A1A1A] text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Continue Learning Card */}
            <div className="xl:col-span-2">
              <div className="bg-gradient-to-br from-[#00305E] to-[#004080] rounded-[16px] p-6 text-white shadow-[0_8px_24px_rgba(0,48,94,0.18)] relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -right-4 w-36 h-36 rounded-full bg-[#FFCE00]/10" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-[#FFCE00] text-[#00305E] text-xs font-semibold px-3 py-1 rounded-full mb-3">
                        <TrendingUp size={12} />
                        Weiter lernen
                      </div>
                      <h2 className="text-xl text-white mb-1">
                        Kapitel 4: Der Weg zur Arbeit
                      </h2>
                      <p className="text-white/70 text-sm">
                        A2 Grammatik · Präteritum & Wegbeschreibungen
                      </p>
                    </div>
                  </div>
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80 text-sm">Fortschritt</span>
                      <span className="text-[#FFCE00] font-semibold text-sm">
                        68%
                      </span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FFCE00] rounded-full transition-all duration-700"
                        style={{ width: "68%" }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> 8 Min. übrig
                      </span>
                      <span>Lektion 4 von 6</span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/lesson")}
                    className="flex items-center gap-2 bg-[#FFCE00] hover:bg-[#E6B900] text-[#00305E] font-semibold px-5 py-2.5 rounded-[12px] transition-colors shadow-md text-sm"
                  >
                    <Play size={16} fill="#00305E" />
                    Lektion fortsetzen
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Goals */}
            <div className="bg-white rounded-[16px] p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]">
              <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Target size={16} className="text-[#00305E]" />
                Tagesziele
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Vokabeln üben",
                    current: 18,
                    total: 20,
                    color: "#FFCE00",
                    bg: "#FFF8E1",
                  },
                  {
                    label: "Lektion absolvieren",
                    current: 1,
                    total: 1,
                    color: "#10B981",
                    bg: "#ECFDF5",
                  },
                  {
                    label: "Aussprache",
                    current: 5,
                    total: 10,
                    color: "#3B82F6",
                    bg: "#EFF6FF",
                  },
                  {
                    label: "Hörübung",
                    current: 2,
                    total: 3,
                    color: "#8B5CF6",
                    bg: "#F5F3FF",
                  },
                ].map(({ label, current, total, color, bg }) => {
                  const pct = Math.round((current / total) * 100);
                  const done = current >= total;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[#1A1A1A] text-sm">{label}</span>
                        <span
                          className={`text-xs font-semibold ${done ? "text-[#10B981]" : "text-[#64748B]"}`}
                        >
                          {done ? "✓ Fertig" : `${current}/${total}`}
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: bg }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] text-xs">Tages-Score</span>
                  <span className="text-[#00305E] font-bold text-sm">
                    3/4 Ziele
                  </span>
                </div>
                <div className="h-2 bg-[#F5F7FA] rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#00305E] rounded-full"
                    style={{ width: "75%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-[#1A1A1A]">
                  Wöchentlicher Fortschritt
                </h3>
                <p className="text-[#64748B] text-sm mt-0.5">
                  Lernminuten diese Woche · {totalMinutes} Min. gesamt
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-[10px] px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#00305E]" />
                <span className="text-[#64748B] text-xs">Min. / Tag</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={weeklyData}
                barSize={36}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#F0F4F8"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#F0F4F8", radius: 8 }}
                />
                <Bar dataKey="minutes" fill="#00305E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recommended for You */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1A1A1A]">
                Empfehlungen für dich
              </h3>
              <button className="text-[#00305E] text-sm font-medium hover:text-[#004080] flex items-center gap-1 transition-colors">
                Alle ansehen <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {recommendedLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => router.push("/lesson")}
                  className="bg-white rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] hover:shadow-[0_6px_18px_rgba(0,48,94,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                >
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={lesson.image}
                      alt={lesson.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
                        <Play
                          size={16}
                          fill="#00305E"
                          className="text-[#00305E] ml-0.5"
                        />
                      </div>
                    </div>
                    <span
                      className={`absolute top-2.5 left-2.5 text-xs font-semibold px-2 py-0.5 rounded-full ${lesson.tagColor}`}
                    >
                      {lesson.tag}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur text-[#00305E] text-xs font-bold px-2 py-0.5 rounded-full">
                      {lesson.level}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <h4 className="font-semibold text-[#1A1A1A] text-sm mb-2 line-clamp-2 leading-snug">
                      {lesson.title}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        <span>{lesson.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star
                          size={11}
                          fill="#FFCE00"
                          className="text-[#FFCE00]"
                        />
                        <span className="font-medium text-[#1A1A1A]">
                          {lesson.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}