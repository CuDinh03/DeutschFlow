"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Clock, CheckCircle2, XCircle, ChevronRight,
  Loader2, BookOpen, Mic, PenLine, Headphones, Star, BarChart2
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface MockExam {
  id: number; title: string; description_vi: string;
  cefr_level: string; total_points: number; pass_points: number;
  time_limit_minutes: number; attempt_count: number;
}
interface ExamAttempt {
  id: number; exam_id: number; title: string; cefr_level: string;
  total_score: number; passed: boolean; status: string;
  total_points: number; pass_points: number;
  started_at: string; finished_at?: string; scores_json?: string;
}

const SECTION_ICONS: Record<string, any> = {
  LESEN: BookOpen, HOEREN: Headphones, SCHREIBEN: PenLine, SPRECHEN: Mic
};
const SECTION_COLORS: Record<string, string> = {
  LESEN: "#6366F1", HOEREN: "#FFCD00", SCHREIBEN: "#10b981", SPRECHEN: "#f97316"
};

export default function MockExamPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [exams, setExams] = useState<MockExam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [cefr, setCefr] = useState("A1");

  // Active exam state
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const loadData = useCallback(async () => {
    if (!me) return;
    try {
      const [examsRes, attemptsRes] = await Promise.all([
        api.get<MockExam[]>(`/mock-exams?cefrLevel=${cefr}`),
        api.get<ExamAttempt[]>("/mock-exams/attempts/me"),
      ]);
      setExams(examsRes.data ?? []);
      setAttempts(attemptsRes.data ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [me, cefr]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Countdown timer
  useEffect(() => {
    if (!activeAttempt || result) return;
    const deadline = new Date(activeAttempt.deadline_at).getTime();
    const tick = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) void finishExam();
    }, 1000);
    return () => clearInterval(tick);
  }, [activeAttempt, result]);

  const startExam = async (exam: MockExam) => {
    setSubmitting(true);
    try {
      const { data } = await api.post<any>(`/mock-exams/${exam.id}/start`);
      let secs: any[] = [];
      try { secs = JSON.parse(data.sections_json); } catch { /* */ }
      setActiveAttempt(data);
      setSections(secs);
      setSectionIdx(0);
      setAnswers({});
      setResult(null);
      const deadline = new Date(data.deadline_at).getTime();
      setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    } catch { alert("Không thể bắt đầu. Vui lòng thử lại."); }
    finally { setSubmitting(false); }
  };

  const finishExam = async () => {
    if (!activeAttempt || submitting) return;
    setSubmitting(true);
    try {
      // Mark schreiben/sprechen as submitted if answered
      const finalAnswers = { ...answers, SCHREIBEN_submitted: "true", SPRECHEN_submitted: "true" };
      const { data } = await api.post<any>(`/mock-exams/attempts/${activeAttempt.attempt_id}/finish`,
        { answers: finalAnswers });
      setResult(data);
      void loadData();
    } catch { alert("Lỗi khi nộp bài."); }
    finally { setSubmitting(false); }
  };

  const setAnswer = (qId: string, value: string) =>
    setAnswers(prev => ({ ...prev, [qId]: value }));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (meLoading || !me) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]">
      <Loader2 className="animate-spin text-[#121212]" size={28} />
    </div>
  );

  // ── Result screen ──
  if (result) {
    const scores = result.scores as Record<string, number> ?? {};
    return (
      <StudentShell activeSection="dashboard" user={me} targetLevel={targetLevel}
        streakDays={streakDays} initials={initials} onLogout={() => logout()}
        headerTitle="Kết quả thi" headerSubtitle="Goethe Start Deutsch 1">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-3xl p-8 text-center text-white ${result.passed
              ? "bg-gradient-to-br from-emerald-600 to-emerald-800"
              : "bg-gradient-to-br from-[#121212] to-[#1E293B]"}`}>
            <div className="text-5xl mb-3">{result.passed ? "🏆" : "📚"}</div>
            <h2 className="text-2xl font-extrabold mb-1">
              {result.total_score} / {activeAttempt?.total_points ?? 60} điểm
            </h2>
            <p className="text-white/80 text-sm">{result.message_vi}</p>
            <div className="mt-4 bg-white/10 rounded-2xl px-4 py-2 text-sm font-bold">
              {result.passed ? "✅ ĐẠT" : "❌ CHƯA ĐẠT"} — Yêu cầu {activeAttempt?.pass_points ?? 36} điểm
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(scores).map(([sec, score]) => {
              const Icon = SECTION_ICONS[sec.toUpperCase()] ?? Star;
              const color = SECTION_COLORS[sec.toUpperCase()] ?? "#121212";
              return (
                <div key={sec} className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} style={{ color }} />
                    <span className="text-xs font-bold capitalize" style={{ color }}>{sec}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">{score}</p>
                  <p className="text-xs text-[#94A3B8]">điểm</p>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setResult(null); setActiveAttempt(null); }}
            className="w-full py-3 bg-[#121212] text-white rounded-2xl font-bold">
            Về trang thi
          </button>
        </div>
      </StudentShell>
    );
  }

  // ── Active exam screen ──
  if (activeAttempt) {
    const section = sections[sectionIdx];
    const isLast = sectionIdx >= sections.length - 1;
    const teile: any[] = section?.teile ?? [];

    return (
      <StudentShell activeSection="dashboard" user={me} targetLevel={targetLevel}
        streakDays={streakDays} initials={initials} onLogout={() => logout()}
        headerTitle={section?.title ?? "Bài thi"} headerSubtitle={section?.title_vi ?? ""}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* Timer + section bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] flex items-center justify-between">
            <div className="flex gap-2">
              {sections.map((s, i) => {
                const Icon = SECTION_ICONS[s.section] ?? Star;
                const color = SECTION_COLORS[s.section] ?? "#121212";
                return (
                  <button key={s.section} onClick={() => setSectionIdx(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: i === sectionIdx ? color : "#F1F4F9",
                      color: i === sectionIdx ? "white" : "#64748B"
                    }}>
                    <Icon size={11} /> {s.title}
                  </button>
                );
              })}
            </div>
            <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft < 300 ? "text-red-500" : "text-[#64748B]"}`}>
              <Clock size={14} /> {formatTime(timeLeft)}
            </div>
          </div>

          {/* Section content */}
          <AnimatePresence mode="wait">
            <motion.div key={sectionIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="space-y-4">

              {section?.section === "SCHREIBEN" ? (
                <SchreibenSection section={section} answers={answers} setAnswer={setAnswer} />
              ) : section?.section === "SPRECHEN" ? (
                <SprechenSection section={section} answers={answers} setAnswer={setAnswer} />
              ) : (
                teile.map((teil: any, ti: number) => (
                  <div key={ti} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
                    <div>
                      <p className="font-bold text-[#0F172A] text-sm">{teil.title}</p>
                      <p className="text-xs text-[#64748B]">{teil.instructions_vi}</p>
                    </div>
                    {(teil.questions ?? []).map((q: any) => (
                      <QuestionCard key={q.id} q={q} answer={answers[q.id] ?? ""}
                        onAnswer={(v) => setAnswer(q.id, v)} section={section.section} />
                    ))}
                  </div>
                ))
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-3">
            {sectionIdx > 0 && (
              <button onClick={() => setSectionIdx(i => i - 1)}
                className="flex-1 py-3 border border-[#E2E8F0] text-[#64748B] rounded-2xl font-bold">
                ← Phần trước
              </button>
            )}
            {!isLast ? (
              <button onClick={() => setSectionIdx(i => i + 1)}
                className="flex-1 py-3 bg-[#121212] text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                Phần tiếp <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={finishExam} disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "🏁 Nộp bài"}
              </button>
            )}
          </div>
        </div>
      </StudentShell>
    );
  }

  // ── Exam list screen ──
  return (
    <StudentShell activeSection="dashboard" user={me} targetLevel={targetLevel}
      streakDays={streakDays} initials={initials} onLogout={() => logout()}
      headerTitle="Thi thử Goethe" headerSubtitle="Mock exam theo chuẩn Goethe-Institut">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div className="flex gap-2">
          {["A1", "A2", "B1"].map(l => (
            <button key={l} onClick={() => setCefr(l)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: l === cefr ? "#121212" : "#EEF4FF", color: l === cefr ? "white" : "#121212" }}>
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#121212]" /></div>
        ) : (
          <>
            {exams.map(exam => (
              <motion.div key={exam.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-[#121212] to-[#1E293B] p-5 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <Trophy size={20} className="text-[#FFCD00]" />
                    <div>
                      <p className="font-extrabold">{exam.title}</p>
                      <p className="text-white/60 text-xs">{exam.description_vi}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>⏱ {exam.time_limit_minutes} phút</span>
                    <span>🎯 Cần {exam.pass_points}/{exam.total_points} điểm</span>
                    <span>📝 {exam.attempt_count} lần thi</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-4 gap-2 mb-4">
                  {["LESEN", "HOEREN", "SCHREIBEN", "SPRECHEN"].map(s => {
                    const Icon = SECTION_ICONS[s];
                    const color = SECTION_COLORS[s];
                    return (
                      <div key={s} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#F8FAFC]">
                        <Icon size={16} style={{ color }} />
                        <span className="text-[10px] font-bold text-[#64748B]">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 pb-4">
                  <button onClick={() => void startExam(exam)} disabled={submitting}
                    className="w-full py-3 bg-[#121212] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                    Bắt đầu thi thử
                  </button>
                </div>
              </motion.div>
            ))}

            {exams.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                <Trophy size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-[#64748B]">Chưa có đề thi cho cấp {cefr}.</p>
              </div>
            )}

            {/* Past attempts */}
            {attempts.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold text-[#0F172A]">📋 Lịch sử thi</h2>
                {attempts.slice(0, 5).map(a => {
                  let scores: Record<string, number> = {};
                  try { scores = JSON.parse(a.scores_json ?? "{}"); } catch { /* */ }
                  return (
                    <div key={a.id} className={`bg-white rounded-2xl p-4 border ${a.passed ? "border-emerald-200" : "border-[#E2E8F0]"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-[#0F172A]">{a.title}</p>
                          <p className="text-xs text-[#94A3B8]">
                            {new Date(a.started_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-lg text-[#0F172A]">{a.total_score ?? 0}/{a.total_points}</p>
                          <span className={`text-xs font-bold ${a.passed ? "text-emerald-600" : "text-red-500"}`}>
                            {a.passed ? "✅ ĐẠT" : "❌ CHƯA ĐẠT"}
                          </span>
                        </div>
                      </div>
                      {Object.keys(scores).length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {Object.entries(scores).map(([sec, score]) => (
                            <div key={sec} className="text-center flex-1 bg-[#F8FAFC] rounded-lg p-1.5">
                              <p className="text-xs font-bold text-[#0F172A]">{score}</p>
                              <p className="text-[9px] text-[#94A3B8] uppercase">{sec}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </StudentShell>
  );
}

// ── Section sub-components ──

function QuestionCard({ q, answer, onAnswer, section }: { q: any; answer: string; onAnswer: (v: string) => void; section: string }) {
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const isRichtig = ["RICHTIG", "FALSCH"];
  const isRF = q.correct && (isRichtig.includes(q.correct));

  if (isRF) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#0F172A]">{q.text_de}</p>
        {q.statement_vi && <p className="text-xs text-[#64748B] italic">{q.statement_vi}</p>}
        <div className="flex gap-2 mt-1">
          {["RICHTIG", "FALSCH"].map(opt => (
            <button key={opt} onClick={() => onAnswer(opt)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
              style={{
                background: answer === opt ? "#121212" : "#F8FAFC",
                color: answer === opt ? "white" : "#64748B",
                borderColor: answer === opt ? "#121212" : "#E2E8F0"
              }}>
              {opt === "RICHTIG" ? "✓ Richtig" : "✗ Falsch"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (hasOptions) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#0F172A]">{q.question_vi ?? q.text_de}</p>
        {q.context_de && <p className="text-xs text-[#94A3B8] bg-[#F8FAFC] px-2 py-1 rounded-lg">📄 {q.context_de}</p>}
        {q.audio_script_de && <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">🔊 {q.audio_script_de}</p>}
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt: string) => (
            <button key={opt} onClick={() => onAnswer(opt)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                background: answer === opt ? "#121212" : "#F8FAFC",
                color: answer === opt ? "white" : "#64748B",
                borderColor: answer === opt ? "#121212" : "#E2E8F0"
              }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Text input
  return (
    <div className="space-y-1">
      {q.audio_script_de && <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">🔊 {q.audio_script_de}</p>}
      <p className="text-sm font-medium text-[#0F172A]">{q.question_vi}</p>
      <input value={answer} onChange={e => onAnswer(e.target.value)}
        placeholder="Đáp án..."
        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#121212]/40" />
    </div>
  );
}

function SchreibenSection({ section, answers, setAnswer }: any) {
  const teile = section.teile ?? [];
  return (
    <div className="space-y-4">
      {teile.map((teil: any, i: number) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
          <div>
            <p className="font-bold text-[#0F172A] text-sm">{teil.title}</p>
            <p className="text-xs text-[#64748B]">{teil.instructions_vi}</p>
          </div>
          {teil.fields ? (
            <div className="space-y-2">
              {teil.fields.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3">
                  <label className="text-xs w-28 text-[#64748B] font-medium">{f.label_de} ({f.label_vi})</label>
                  <input value={answers[f.id] ?? ""} onChange={e => setAnswer(f.id, e.target.value)}
                    className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm outline-none focus:border-[#121212]/40" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl mb-2">📝 {teil.prompt_de}</p>
              <p className="text-[10px] text-[#94A3B8] mb-1">{teil.min_words}–{teil.max_words} từ</p>
              <textarea
                value={answers["SCHREIBEN_T2"] ?? ""}
                onChange={e => setAnswer("SCHREIBEN_T2", e.target.value)}
                rows={5} placeholder="Viết email của bạn ở đây..."
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#121212]/40"
              />
              <p className="text-[10px] text-right text-[#94A3B8]">
                {(answers["SCHREIBEN_T2"] ?? "").trim().split(/\s+/).filter(Boolean).length} từ
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SprechenSection({ section, answers, setAnswer }: any) {
  const teile = section.teile ?? [];
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
        <p className="font-bold mb-1">🎤 Phần Nói — Hướng dẫn</p>
        <p className="text-xs">Trong kỳ thi thực, bạn sẽ nói với giám khảo. Ở đây, hãy ghi chép câu trả lời của bạn.</p>
      </div>
      {teile.map((teil: any, i: number) => (
        <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
          <div>
            <p className="font-bold text-[#0F172A] text-sm">{teil.title}</p>
            <p className="text-xs text-[#64748B]">{teil.instructions_vi}</p>
          </div>
          {(teil.prompts_vi ?? []).map((prompt: string, j: number) => (
            <div key={j}>
              <p className="text-xs text-[#64748B] mb-1">• {prompt}</p>
              <input
                value={answers[`SPRECHEN_${i}_${j}`] ?? ""}
                onChange={e => setAnswer(`SPRECHEN_${i}_${j}`, e.target.value)}
                placeholder="Ghi câu trả lời của bạn..."
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm outline-none focus:border-[#121212]/40"
              />
            </div>
          ))}
          {teil.cards && (
            <div className="flex gap-2 flex-wrap">
              {teil.cards.map((card: string, j: number) => (
                <span key={j} className="px-3 py-1.5 bg-[#F1F4F9] rounded-xl text-xs font-medium text-[#475569]">
                  {card}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      <textarea
        value={answers["SPRECHEN_notes"] ?? ""}
        onChange={e => setAnswer("SPRECHEN_notes", e.target.value)}
        rows={3} placeholder="Ghi chú thêm về phần nói của bạn..."
        className="w-full border border-[#E2E8F0] rounded-2xl px-4 py-3 text-sm outline-none resize-none"
      />
    </div>
  );
}
