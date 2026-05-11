"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle2, XCircle, ChevronRight, RotateCcw, Loader2, Trophy, ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";
import { useTranslations } from "next-intl";

interface GrammarTopic {
  id: number;
  cefr_level: string;
  topic_code: string;
  title_de: string;
  title_vi: string;
  description_vi: string;
  exercises_done: number;
  exercises_correct: number;
  mastery_percent: number;
  total_exercises: number;
}

interface Exercise {
  id: number;
  exercise_type: "FILL_BLANK" | "MULTIPLE_CHOICE" | "TRANSLATE";
  difficulty: number;
  question_json: string;
}

interface ParsedQuestion {
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation_vi: string;
  explanation_de?: string;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

function MasteryBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? "#22c55e" : percent >= 50 ? "#f59e0b" : "#6366f1";
  return (
    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden w-full">
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6 }} />
    </div>
  );
}

export default function GrammarSyllabusPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const t = useTranslations("student");

  const [cefr, setCefr] = useState("A1");
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState<GrammarTopic | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ correct: boolean; correctAnswer: string; explanation: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${cefr}`);
      setTopics(data ?? []);
    } catch { setTopics([]); }
    finally { setLoading(false); }
  }, [cefr]);

  useEffect(() => { if (me) fetchTopics(); }, [me, fetchTopics]);

  const openTopic = async (topic: GrammarTopic) => {
    setActiveTopic(topic);
    setCurrentIdx(0);
    setAnswer("");
    setResult(null);
    setSessionScore({ correct: 0, total: 0 });
    setExLoading(true);
    try {
      const { data } = await api.get<Exercise[]>(`/grammar/syllabus/topics/${topic.id}/exercises?limit=10`);
      setExercises(data ?? []);
    } catch { setExercises([]); }
    finally { setExLoading(false); }
  };

  const submit = async () => {
    if (!answer.trim() || !exercises[currentIdx]) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{ correct: boolean; correctAnswer: string; explanation: string }>(
        `/grammar/syllabus/exercises/${exercises[currentIdx].id}/submit`, { answer }
      );
      setResult(data);
      setSessionScore(s => ({ correct: s.correct + (data.correct ? 1 : 0), total: s.total + 1 }));
    } catch { }
    finally { setSubmitting(false); }
  };

  const next = () => {
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx(i => i + 1);
      setAnswer("");
      setResult(null);
    } else {
      setActiveTopic(null);
      fetchTopics();
    }
  };

  if (meLoading || !me) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" size={28} /></div>;

  const currentEx = exercises[currentIdx];
  const parsed: ParsedQuestion | null = currentEx ? (() => { try { return JSON.parse(currentEx.question_json); } catch { return null; } })() : null;
  const isLast = currentIdx === exercises.length - 1;

  return (
    <StudentShell activeSection="grammar-syllabus" user={me} targetLevel={targetLevel} streakDays={streakDays}
      initials={initials} onLogout={() => logout()}
      headerTitle="📚 Grammar Syllabus" headerSubtitle="Ngữ pháp bài bản theo chuẩn Goethe">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Active exercise screen */}
        <AnimatePresence mode="wait">
          {activeTopic && (
            <motion.div key="exercise" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setActiveTopic(null)} className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                  <p className="font-bold text-[#0F172A]">{activeTopic.title_de}</p>
                  <p className="text-xs text-[#64748B]">{activeTopic.title_vi}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0F172A]">{currentIdx + 1}/{exercises.length}</p>
                  <p className="text-xs text-[#94A3B8]">{sessionScore.correct}/{sessionScore.total} đúng</p>
                </div>
              </div>

              {exLoading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>}

              {!exLoading && exercises.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                  <Sparkles size={40} className="text-[#C7D2FE] mx-auto mb-3" />
                  <p className="font-semibold text-[#0F172A]">Chưa có bài tập được duyệt</p>
                  <p className="text-sm text-[#94A3B8] mt-1">Giáo viên đang tạo bài tập cho chủ đề này</p>
                </div>
              )}

              {!exLoading && parsed && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#6366F1] rounded-full transition-all" style={{ width: `${((currentIdx) / exercises.length) * 100}%` }} />
                  </div>

                  {/* Question card */}
                  <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#EEF2FF", color: "#6366F1" }}>
                        {currentEx.exercise_type === "FILL_BLANK" ? "Điền vào chỗ trống" : currentEx.exercise_type === "MULTIPLE_CHOICE" ? "Trắc nghiệm" : "Dịch câu"}
                      </span>
                      <span className="text-xs text-[#94A3B8]">Khó: {"★".repeat(currentEx.difficulty)}</span>
                    </div>
                    <p className="text-lg font-semibold text-[#0F172A] mb-4">{parsed.prompt}</p>

                    {/* Multiple choice */}
                    {currentEx.exercise_type === "MULTIPLE_CHOICE" && parsed.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {parsed.options.map((opt, i) => {
                          const isSelected = answer === opt;
                          const isCorrect = result && opt === result.correctAnswer;
                          const isWrong = result && isSelected && !result.correct;
                          return (
                            <button key={i} onClick={() => !result && setAnswer(opt)} disabled={!!result}
                              className="text-left px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all"
                              style={{
                                borderColor: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : isSelected ? "#6366F1" : "#E2E8F0",
                                background: isCorrect ? "#f0fdf4" : isWrong ? "#fef2f2" : isSelected ? "#EEF2FF" : "white",
                                color: isCorrect ? "#16a34a" : isWrong ? "#dc2626" : isSelected ? "#6366F1" : "#0F172A",
                              }}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Text input */}
                    {(currentEx.exercise_type === "FILL_BLANK" || currentEx.exercise_type === "TRANSLATE") && (
                      <input value={answer} onChange={e => !result && setAnswer(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !result && submit()}
                        placeholder="Nhập câu trả lời..."
                        disabled={!!result}
                        className="w-full px-4 py-3 rounded-xl border-2 border-[#E2E8F0] focus:border-[#6366F1] outline-none text-sm font-medium" />
                    )}

                    {/* Submit button */}
                    {!result && (
                      <button onClick={submit} disabled={!answer.trim() || submitting}
                        className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                        style={{ background: "#6366F1" }}>
                        {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kiểm tra"}
                      </button>
                    )}
                  </div>

                  {/* Result feedback */}
                  <AnimatePresence>
                    {result && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl p-5 border-2 ${result.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {result.correct ? <CheckCircle2 size={20} className="text-green-500" /> : <XCircle size={20} className="text-red-500" />}
                          <p className="font-bold" style={{ color: result.correct ? "#16a34a" : "#dc2626" }}>
                            {result.correct ? "Chính xác! 🎉" : "Chưa đúng"}
                          </p>
                        </div>
                        {!result.correct && (
                          <p className="text-sm font-semibold text-[#0F172A] mb-2">Đáp án: <span className="text-green-600">{result.correctAnswer}</span></p>
                        )}
                        {result.explanation && <p className="text-sm text-[#475569]">{String(result.explanation)}</p>}
                        <button onClick={next}
                          className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                          style={{ background: result.correct ? "#16a34a" : "#6366F1" }}>
                          {isLast ? "Hoàn thành 🏆" : "Tiếp theo"} <ChevronRight size={16} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* Topic list screen */}
          {!activeTopic && (
            <motion.div key="topics" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* CEFR selector */}
              <div className="flex gap-2 mb-6">
                {CEFR_LEVELS.map(l => (
                  <button key={l} onClick={() => setCefr(l)} className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{ background: l === cefr ? "#6366F1" : "#EEF2FF", color: l === cefr ? "white" : "#6366F1" }}>
                    {l}
                  </button>
                ))}
              </div>

              {loading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>}

              {!loading && topics.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                  <BookOpen size={40} className="text-[#C7D2FE] mx-auto mb-3" />
                  <p className="font-semibold text-[#0F172A]">Chưa có chủ đề cho cấp {cefr}</p>
                </div>
              )}

              <div className="grid gap-3">
                {topics.map((topic, i) => (
                  <motion.button key={topic.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openTopic(topic)}
                    className="w-full text-left bg-white rounded-2xl p-5 border border-[#E2E8F0] hover:border-[#6366F1]/40 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-[#0F172A] text-sm group-hover:text-[#6366F1] transition-colors">{topic.title_de}</p>
                          {topic.mastery_percent >= 80 && <Trophy size={14} className="text-yellow-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-[#64748B] mb-3">{topic.title_vi}</p>
                        <MasteryBar percent={topic.mastery_percent} />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-extrabold" style={{ color: topic.mastery_percent >= 80 ? "#22c55e" : "#6366F1" }}>
                          {Math.round(topic.mastery_percent)}%
                        </p>
                        <p className="text-xs text-[#94A3B8]">{topic.exercises_done} bài</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-[#94A3B8]">{topic.total_exercises ?? 0} bài tập có sẵn</span>
                      <ChevronRight size={16} className="text-[#CBD5E1] group-hover:text-[#6366F1] transition-colors" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StudentShell>
  );
}
