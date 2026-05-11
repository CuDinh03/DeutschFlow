"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Check, X, ChevronRight, Loader2, Play, Trophy, BookOpen, Headphones, PenTool, Mic2, BarChart2, ArrowLeft, AlertCircle } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface MockExam {
  id: number;
  cefr_level: string;
  exam_format: string;
  title: string;
  total_points: number;
  pass_points: number;
  time_limit_minutes: number;
}

interface MockAttempt {
  id: number;
  exam_id: number;
  started_at: string;
  finished_at?: string;
  total_score?: number;
  passed?: boolean;
  status: string;
  scores_json?: string;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  LESEN: <BookOpen size={18} />,
  HOEREN: <Headphones size={18} />,
  SCHREIBEN: <PenTool size={18} />,
  SPRECHEN: <Mic2 size={18} />,
};

const SECTION_COLORS: Record<string, string> = {
  LESEN: "#6366F1",
  HOEREN: "#0EA5E9",
  SCHREIBEN: "#10B981",
  SPRECHEN: "#F59E0B",
};

function ScoreCard({ section, score, max }: { section: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = SECTION_COLORS[section] ?? "#6366F1";
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "20", color }}>
          {SECTION_ICONS[section]}
        </div>
        <p className="font-semibold text-sm text-[#0F172A] capitalize">{section.toLowerCase()}</p>
      </div>
      <p className="text-2xl font-extrabold" style={{ color }}>{score}/{max}</p>
      <div className="mt-2 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-[#94A3B8] mt-1">{pct}%</p>
    </div>
  );
}

export default function MockExamPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [exams, setExams] = useState<MockExam[]>([]);
  const [attempts, setAttempts] = useState<MockAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<MockExam | null>(null);
  const [view, setView] = useState<"list" | "result">("list");
  const [selectedAttempt, setSelectedAttempt] = useState<MockAttempt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [examRes, attRes] = await Promise.allSettled([
        api.get<MockExam[]>("/mock-exams?cefrLevel=A1"),
        api.get<MockAttempt[]>("/mock-exams/attempts/me"),
      ]);
      if (examRes.status === "fulfilled") setExams(examRes.value.data ?? []);
      if (attRes.status === "fulfilled") setAttempts(attRes.value.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  const startExam = async (exam: MockExam) => {
    try {
      await api.post(`/mock-exams/${exam.id}/start`);
      setSelectedExam(exam);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Không thể bắt đầu thi");
    }
  };

  const viewResult = (attempt: MockAttempt) => {
    setSelectedAttempt(attempt);
    setView("result");
  };

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={28} /></div>;

  return (
    <StudentShell activeSection="mock-exam" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="🎯 Mock Goethe Exam" headerSubtitle="Thi thử theo format Goethe-Institut chính thức">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Goethe format explanation */}
        <div className="rounded-2xl p-5 text-white space-y-3" style={{ background: "linear-gradient(135deg,#1E293B 0%,#312E81 100%)" }}>
          <h2 className="font-extrabold text-lg">📋 Format Goethe Start Deutsch 1 (A1)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { section: "LESEN", label: "Lesen", time: "20 min", desc: "3 phần đọc" },
              { section: "HOEREN", label: "Hören", time: "20 min", desc: "3 phần nghe" },
              { section: "SCHREIBEN", label: "Schreiben", time: "20 min", desc: "Điền form + email" },
              { section: "SPRECHEN", label: "Sprechen", time: "15 min", desc: "3 phần nói" },
            ].map(s => (
              <div key={s.section} className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1" style={{ color: SECTION_COLORS[s.section] }}>
                  {SECTION_ICONS[s.section]}
                  <span className="font-bold text-sm">{s.label}</span>
                </div>
                <p className="text-white/60 text-xs">{s.time}</p>
                <p className="text-white/80 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-white/60 text-xs">Đạt: ≥ 60% mỗi phần · Tổng thời gian: ~75 phút</p>
        </div>

        <AnimatePresence mode="wait">
          {view === "result" && selectedAttempt ? (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-[#64748B] mb-4 hover:text-[#0F172A]">
                <ArrowLeft size={16} /> Quay lại
              </button>
              <div className={`rounded-2xl p-6 mb-4 text-white ${selectedAttempt.passed ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-slate-600 to-slate-800"}`}>
                <div className="flex items-center gap-3 mb-2">
                  {selectedAttempt.passed ? <Trophy size={28} className="text-yellow-300" /> : <AlertCircle size={28} />}
                  <div>
                    <p className="text-xl font-extrabold">{selectedAttempt.passed ? "Đạt! 🎉" : "Chưa đạt"}</p>
                    <p className="text-white/70 text-sm">Tổng điểm: {selectedAttempt.total_score ?? "—"}</p>
                  </div>
                </div>
              </div>
              {selectedAttempt.scores_json && (() => {
                try {
                  const scores = JSON.parse(selectedAttempt.scores_json);
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(scores).map(([k, v]) => (
                        <ScoreCard key={k} section={k.toUpperCase()} score={Number(v)} max={25} />
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Available exams */}
              <div>
                <h3 className="font-bold text-[#0F172A] text-base mb-3">Đề thi có sẵn</h3>
                {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>}
                {!loading && exams.length === 0 && (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center">
                    <AlertCircle size={32} className="text-[#C7D2FE] mx-auto mb-2" />
                    <p className="font-semibold text-[#0F172A]">Chưa có đề thi</p>
                    <p className="text-sm text-[#94A3B8]">Đề thi Goethe A1 sẽ sớm được cập nhật</p>
                  </div>
                )}
                {exams.map(exam => (
                  <div key={exam.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#6366F1]/40 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#0F172A]">{exam.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B]">
                          <span className="flex items-center gap-1"><Clock size={12} /> {exam.time_limit_minutes} phút</span>
                          <span>Đạt: {exam.pass_points}/{exam.total_points} điểm</span>
                        </div>
                      </div>
                      <button onClick={() => startExam(exam)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white flex-shrink-0"
                        style={{ background: "#6366F1" }}>
                        <Play size={14} /> Bắt đầu thi
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* History */}
              {attempts.length > 0 && (
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base mb-3">Lịch sử thi</h3>
                  <div className="space-y-2">
                    {attempts.map((att, i) => (
                      <motion.div key={att.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-2xl border border-[#E2E8F0] px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {att.passed ? <Check size={18} className="text-emerald-500" /> : att.status === "COMPLETED" ? <X size={18} className="text-red-400" /> : <Clock size={18} className="text-[#94A3B8]" />}
                          <div>
                            <p className="font-semibold text-sm text-[#0F172A]">
                              {att.passed ? "Đạt" : att.status === "COMPLETED" ? "Chưa đạt" : "Đang làm"}
                            </p>
                            <p className="text-xs text-[#94A3B8]">{new Date(att.started_at).toLocaleDateString("vi-VN")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-[#0F172A]">{att.total_score ?? "—"} điểm</p>
                          {att.status === "COMPLETED" && (
                            <button onClick={() => viewResult(att)} className="text-xs font-semibold text-[#6366F1] flex items-center gap-1">
                              Chi tiết <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StudentShell>
  );
}
