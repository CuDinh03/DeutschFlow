"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Headphones, PenLine, Mic, Brain,
  Flame, Target, Zap, TrendingUp, Loader2, BarChart2,
  CheckCircle2, Clock, Star
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface SkillProgress {
  score: number; label: string; icon: any; color: string;
  description: string;
}

interface ProgressOverview {
  cefrLevel: string;
  roadmapCompleted: number;
  roadmapTotal: number;
  grammarMastery: number;
  grammarTopicsDone: number;
  grammarTopicsTotal: number;
  speakingSessionsDone: number;
  speakingAvgScore: number;
  vocabCoverage: number;
  vocabMastered: number;
  mockExamBest?: number;
  mockExamPassed: boolean;
  examReady: boolean;
  streakDays: number;
  totalXp: number;
  level: number;
}

const SKILLS = [
  { key: "lesen",     label: "Lesen",     icon: BookOpen,    color: "#6366F1", description: "Đọc hiểu" },
  { key: "hoeren",    label: "Hören",     icon: Headphones,  color: "#FFCD00", description: "Nghe hiểu" },
  { key: "schreiben", label: "Schreiben", icon: PenLine,     color: "#10b981", description: "Viết" },
  { key: "sprechen",  label: "Sprechen",  icon: Mic,         color: "#f97316", description: "Nói" },
];

export default function ProgressPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [xpData, setXpData] = useState<any>(null);
  const [roadmapData, setRoadmapData] = useState<any[]>([]);
  const [grammarData, setGrammarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const [xpRes, roadmapRes, grammarRes, mockRes] = await Promise.allSettled([
        api.get("/xp/me"),
        api.get("/skill-tree/me"),
        api.get("/grammar/syllabus/topics?cefrLevel=A1"),
        api.get<any[]>("/mock-exams/attempts/me"),
      ]);

      const xp = xpRes.status === "fulfilled" ? xpRes.value.data : null;
      const roadmap = roadmapRes.status === "fulfilled" ? roadmapRes.value.data : [];
      const grammar = grammarRes.status === "fulfilled" ? grammarRes.value.data : [];
      const mockAttempts = mockRes.status === "fulfilled" ? mockRes.value.data : [];

      setXpData(xp);
      setRoadmapData(Array.isArray(roadmap) ? roadmap : []);
      setGrammarData(Array.isArray(grammar) ? grammar : []);

      // Compute overview
      const nodes = Array.isArray(roadmap) ? roadmap : [];
      const completed = nodes.filter((n: any) => n.user_status === "COMPLETED").length;
      const total = nodes.length;

      const grammarTopics = Array.isArray(grammar) ? grammar : [];
      const grammarDone = grammarTopics.filter((t: any) => (t.mastery_percent ?? 0) >= 50).length;
      const grammarMastery = grammarTopics.length > 0
        ? Math.round(grammarTopics.reduce((a: number, t: any) => a + (t.mastery_percent ?? 0), 0) / grammarTopics.length)
        : 0;

      const bestMock = (mockAttempts as any[]).filter(a => a.status === "COMPLETED")
        .reduce((best: number, a: any) => Math.max(best, a.total_score ?? 0), 0);
      const mockPassed = (mockAttempts as any[]).some(a => a.passed);

      const roadmapPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const examReady = roadmapPct >= 70 && grammarMastery >= 60 && (bestMock >= 36 || mockPassed);

      setOverview({
        cefrLevel: targetLevel ?? "A1",
        roadmapCompleted: completed,
        roadmapTotal: total,
        grammarMastery,
        grammarTopicsDone: grammarDone,
        grammarTopicsTotal: grammarTopics.length,
        speakingSessionsDone: 0,
        speakingAvgScore: 0,
        vocabCoverage: 0,
        vocabMastered: 0,
        mockExamBest: bestMock > 0 ? bestMock : undefined,
        mockExamPassed: mockPassed,
        examReady,
        streakDays: streakDays ?? 0,
        totalXp: xp?.totalXp ?? 0,
        level: xp?.level ?? 1,
      });
    } catch { /* */ }
    finally { setLoading(false); }
  }, [me, targetLevel]);

  useEffect(() => { void load(); }, [load]);

  if (meLoading || !me) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]">
      <Loader2 className="animate-spin text-[#121212]" size={28} />
    </div>
  );

  // Derive skill scores from available data
  const roadmapPct = overview && overview.roadmapTotal > 0
    ? Math.round((overview.roadmapCompleted / overview.roadmapTotal) * 100)
    : 0;
  const skillScores: Record<string, number> = {
    lesen:     roadmapPct,
    hoeren:    Math.min(100, Math.round(roadmapPct * 0.85)),
    schreiben: overview?.grammarMastery ?? 0,
    sprechen:  Math.min(100, (overview?.speakingSessionsDone ?? 0) * 5 + 10),
  };

  const grammarTopics = grammarData as any[];

  return (
    <StudentShell activeSection="dashboard" user={me} targetLevel={targetLevel}
      streakDays={streakDays} initials={initials} onLogout={() => logout()}
      headerTitle="Tiến độ học tập" headerSubtitle="Phân tích toàn diện kỹ năng tiếng Đức của bạn">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-[#121212]" /></div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#121212] to-[#1E293B] rounded-2xl p-4 text-white">
                <Zap size={18} className="text-[#FFCD00] mb-1" />
                <p className="text-2xl font-extrabold">{overview?.totalXp?.toLocaleString() ?? 0}</p>
                <p className="text-white/60 text-xs">Tổng XP · Lv.{overview?.level ?? 1}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
                <Flame size={18} className="text-orange-500 mb-1" />
                <p className="text-2xl font-extrabold text-[#0F172A]">{overview?.streakDays ?? 0}</p>
                <p className="text-[#94A3B8] text-xs">Ngày streak</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className={`rounded-2xl p-4 border ${overview?.examReady
                  ? "bg-emerald-50 border-emerald-200" : "bg-white border-[#E2E8F0]"}`}>
                <Target size={18} className={`mb-1 ${overview?.examReady ? "text-emerald-600" : "text-[#94A3B8]"}`} />
                <p className={`text-sm font-extrabold ${overview?.examReady ? "text-emerald-700" : "text-[#94A3B8]"}`}>
                  {overview?.examReady ? "✅ Sẵn sàng thi!" : "Chưa sẵn sàng"}
                </p>
                <p className="text-[10px] text-[#94A3B8]">Goethe {overview?.cefrLevel}</p>
              </motion.div>
            </div>

            {/* 4 Skills Radar (CSS-based) */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
              <h2 className="font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <BarChart2 size={18} /> Kỹ năng theo CEFR
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {SKILLS.map(skill => {
                  const score = skillScores[skill.key] ?? 0;
                  const Icon = skill.icon;
                  return (
                    <motion.div key={skill.key}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="relative overflow-hidden rounded-xl p-4 border border-[#E2E8F0]"
                      style={{ background: skill.color + "08" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: skill.color + "20" }}>
                          <Icon size={16} style={{ color: skill.color }} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#0F172A]">{skill.label}</p>
                          <p className="text-[10px] text-[#94A3B8]">{skill.description}</p>
                        </div>
                        <span className="ml-auto font-extrabold text-lg" style={{ color: skill.color }}>
                          {score}%
                        </span>
                      </div>
                      <div className="h-2 bg-[#F1F4F9] rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ background: skill.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 1, ease: "easeOut" }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Roadmap progress */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[#0F172A] flex items-center gap-2">
                  <TrendingUp size={18} /> Lộ trình học tập
                </h2>
                <span className="text-sm font-bold text-[#0F172A]">
                  {overview?.roadmapCompleted ?? 0}/{overview?.roadmapTotal ?? 0} bài
                </span>
              </div>
              <div className="h-3 bg-[#F1F4F9] rounded-full overflow-hidden mb-2">
                <motion.div className="h-full rounded-full bg-[#121212]"
                  initial={{ width: 0 }} animate={{ width: `${roadmapPct}%` }}
                  transition={{ duration: 1 }} />
              </div>
              <p className="text-xs text-[#94A3B8]">
                {roadmapPct}% hoàn thành · Cấp độ {overview?.cefrLevel}
              </p>
            </div>

            {/* Grammar mastery */}
            {grammarTopics.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-[#0F172A] flex items-center gap-2">
                    <Brain size={18} /> Ngữ pháp — Mastery
                  </h2>
                  <span className="text-sm font-bold text-[#0F172A]">
                    TB {overview?.grammarMastery ?? 0}%
                  </span>
                </div>
                <div className="space-y-2">
                  {grammarTopics.slice(0, 8).map((topic: any) => {
                    const pct = Math.round(topic.mastery_percent ?? 0);
                    return (
                      <div key={topic.id} className="flex items-center gap-3">
                        <span className="text-xs text-[#64748B] w-36 truncate">{topic.title_de}</span>
                        <div className="flex-1 h-2 bg-[#F1F4F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 80 ? "#10b981" : pct >= 50 ? "#FFCD00" : "#E2E8F0"
                            }} />
                        </div>
                        <span className="text-xs font-bold w-10 text-right"
                          style={{ color: pct >= 80 ? "#10b981" : pct >= 50 ? "#ca8a04" : "#94A3B8" }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mock exam */}
            <div className={`rounded-2xl p-5 border ${overview?.mockExamPassed
              ? "bg-emerald-50 border-emerald-200" : "bg-white border-[#E2E8F0]"}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: overview?.mockExamPassed ? "#10b98120" : "#F1F4F9" }}>
                  <Star size={22} style={{ color: overview?.mockExamPassed ? "#10b981" : "#94A3B8" }} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#0F172A]">Mock Goethe {overview?.cefrLevel}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {overview?.mockExamBest != null
                      ? `Điểm cao nhất: ${overview.mockExamBest}/60`
                      : "Chưa thi thử"}
                  </p>
                </div>
                {overview?.mockExamPassed ? (
                  <CheckCircle2 size={20} className="text-emerald-600" />
                ) : (
                  <a href="/student/mock-exam"
                    className="px-3 py-1.5 bg-[#121212] text-white rounded-xl text-xs font-bold">
                    Thi thử
                  </a>
                )}
              </div>
            </div>

            {/* Readiness checklist */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
              <h2 className="font-bold text-[#0F172A] mb-3">📋 Checklist sẵn sàng thi Goethe A1</h2>
              {[
                { label: "Hoàn thành ≥70% lộ trình A1", done: roadmapPct >= 70, value: `${roadmapPct}%` },
                { label: "Ngữ pháp mastery ≥60%", done: (overview?.grammarMastery ?? 0) >= 60, value: `${overview?.grammarMastery ?? 0}%` },
                { label: "Đã thi thử mock exam", done: overview?.mockExamBest != null, value: overview?.mockExamBest != null ? "✓" : "Chưa" },
                { label: "Đạt điểm pass (36/60)", done: overview?.mockExamPassed ?? false, value: overview?.mockExamPassed ? "✓" : "Chưa" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[#F1F4F9] last:border-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${item.done ? "bg-emerald-500 text-white" : "bg-[#F1F4F9] text-[#94A3B8]"}`}>
                    {item.done ? "✓" : "○"}
                  </div>
                  <span className="flex-1 text-sm text-[#0F172A]">{item.label}</span>
                  <span className={`text-xs font-bold ${item.done ? "text-emerald-600" : "text-[#94A3B8]"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

          </>
        )}
      </div>
    </StudentShell>
  );
}
