"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, BookOpen, Headphones, PenTool, Mic2, TrendingUp, Calendar, Flame, Target, BarChart2 } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface ProgressOverview {
  cefrLevel: string;
  skills: {
    lesen: SkillData;
    hoeren: SkillData;
    schreiben: SkillData;
    sprechen: SkillData;
  };
  grammarMastery: number;
  vocabCoverage: number;
  mockExamBestScore: number;
  examReady: boolean;
  weeklyProgress: WeeklyPoint[];
}

interface SkillData {
  score: number;
  exercisesDone: number;
  lastPracticed?: string;
}

interface WeeklyPoint {
  week: string;
  minutesStudied: number;
  xpEarned: number;
}

const SKILL_CONFIG = [
  { key: "lesen", label: "Lesen", labelVi: "Đọc hiểu", icon: BookOpen, color: "#6366F1" },
  { key: "hoeren", label: "Hören", labelVi: "Nghe hiểu", icon: Headphones, color: "#0EA5E9" },
  { key: "schreiben", label: "Schreiben", labelVi: "Viết", icon: PenTool, color: "#10B981" },
  { key: "sprechen", label: "Sprechen", labelVi: "Nói", icon: Mic2, color: "#F59E0B" },
];

function RadarChart({ skills }: { skills: Record<string, SkillData> }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const keys = ["lesen", "hoeren", "schreiben", "sprechen"];
  const angles = keys.map((_, i) => (i / keys.length) * 2 * Math.PI - Math.PI / 2);

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const toPoint = (angle: number, ratio: number) => ({
    x: cx + r * ratio * Math.cos(angle),
    y: cy + r * ratio * Math.sin(angle),
  });

  const dataPoints = keys.map((k, i) => {
    const val = (skills[k]?.score ?? 0) / 100;
    return toPoint(angles[i], val);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid */}
      {gridLevels.map(level => {
        const pts = angles.map(a => toPoint(a, level));
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
        return <path key={level} d={path} fill="none" stroke="#E2E8F0" strokeWidth={1} />;
      })}
      {/* Axes */}
      {angles.map((a, i) => {
        const end = toPoint(a, 1);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E2E8F0" strokeWidth={1} />;
      })}
      {/* Data */}
      <path d={dataPath} fill="#6366F1" fillOpacity={0.2} stroke="#6366F1" strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366F1" />
      ))}
      {/* Labels */}
      {angles.map((a, i) => {
        const lp = toPoint(a, 1.28);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontWeight={700} fill="#64748B">
            {keys[i].charAt(0).toUpperCase() + keys[i].slice(1)}
          </text>
        );
      })}
    </svg>
  );
}

function SkillBar({ skill, value, color }: { skill: typeof SKILL_CONFIG[0]; value: number; color: string }) {
  const Icon = skill.icon;
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "20", color }}>
        <Icon size={16} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-[#0F172A]">{skill.label} <span className="text-[#94A3B8] font-normal">· {skill.labelVi}</span></p>
          <p className="text-xs font-bold" style={{ color }}>{value}%</p>
        </div>
        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: color }}
            initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ProgressOverview>("/progress/me/overview");
      setOverview(data);
    } catch {
      // Fallback mock for UI preview
      setOverview({
        cefrLevel: targetLevel || "A1",
        skills: {
          lesen: { score: 0, exercisesDone: 0 },
          hoeren: { score: 0, exercisesDone: 0 },
          schreiben: { score: 0, exercisesDone: 0 },
          sprechen: { score: 0, exercisesDone: 0 },
        },
        grammarMastery: 0,
        vocabCoverage: 0,
        mockExamBestScore: 0,
        examReady: false,
        weeklyProgress: [],
      });
    } finally { setLoading(false); }
  }, [targetLevel]);

  useEffect(() => { if (me) load(); }, [me, load]);

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={28} /></div>;

  return (
    <StudentShell activeSection="progress" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="📊 Tiến độ của tôi" headerSubtitle="Tổng quan 4 kỹ năng · Ngữ pháp · Từ vựng">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {loading && <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>}

        {!loading && overview && (
          <>
            {/* Exam ready banner */}
            <div className={`rounded-2xl p-5 text-white ${overview.examReady ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-slate-700 to-slate-800"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-lg">{overview.examReady ? "🎯 Sẵn sàng thi Goethe!" : "Tiếp tục luyện tập"}</p>
                  <p className="text-white/70 text-sm mt-1">
                    {overview.examReady
                      ? "Năng lực của bạn đủ điều kiện đăng ký thi thật"
                      : `Cấp độ hiện tại: ${overview.cefrLevel} · Luyện thêm để sẵn sàng thi`}
                  </p>
                </div>
                <Target size={40} className="text-white/30 flex-shrink-0" />
              </div>
              {overview.mockExamBestScore > 0 && (
                <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 inline-flex items-center gap-2">
                  <BarChart2 size={14} />
                  <span className="text-sm font-semibold">Điểm mock cao nhất: {overview.mockExamBestScore}/100</span>
                </div>
              )}
            </div>

            {/* Radar + Skills */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <p className="font-bold text-[#0F172A] mb-4 text-sm">Biểu đồ năng lực</p>
                <RadarChart skills={overview.skills} />
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
                <p className="font-bold text-[#0F172A] text-sm">Chi tiết 4 kỹ năng</p>
                {SKILL_CONFIG.map(skill => (
                  <SkillBar key={skill.key} skill={skill}
                    value={overview.skills[skill.key as keyof typeof overview.skills]?.score ?? 0}
                    color={skill.color} />
                ))}
              </div>
            </div>

            {/* Grammar + Vocab */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
                    <TrendingUp size={16} className="text-[#6366F1]" />
                  </div>
                  <p className="font-bold text-sm text-[#0F172A]">Ngữ pháp</p>
                </div>
                <p className="text-3xl font-extrabold text-[#6366F1]">{Math.round(overview.grammarMastery)}%</p>
                <div className="mt-2 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full bg-[#6366F1]"
                    initial={{ width: 0 }} animate={{ width: `${overview.grammarMastery}%` }}
                    transition={{ duration: 0.8 }} />
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">Mức độ thành thạo trung bình</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                    <BookOpen size={16} className="text-[#10B981]" />
                  </div>
                  <p className="font-bold text-sm text-[#0F172A]">Từ vựng Goethe</p>
                </div>
                <p className="text-3xl font-extrabold text-[#10B981]">{Math.round(overview.vocabCoverage)}%</p>
                <div className="mt-2 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full bg-[#10B981]"
                    initial={{ width: 0 }} animate={{ width: `${overview.vocabCoverage}%` }}
                    transition={{ duration: 0.8 }} />
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">Từ vựng A1 Goethe đã học</p>
              </div>
            </div>

            {/* Weekly progress */}
            {overview.weeklyProgress.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <p className="font-bold text-[#0F172A] text-sm mb-4">Tiến độ theo tuần</p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {overview.weeklyProgress.slice(-7).map((w, i) => {
                    const h = Math.max(8, (w.minutesStudied / 60) * 80);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-full bg-[#EEF2FF] rounded-lg flex items-end justify-center" style={{ height: 80 }}>
                          <div className="w-full rounded-lg bg-[#6366F1] transition-all" style={{ height: h }} />
                        </div>
                        <p className="text-[10px] text-[#94A3B8]">{w.minutesStudied}m</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StudentShell>
  );
}
