"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, CheckCircle, XCircle, ChevronRight, RefreshCw,
  Loader2, BookOpen, Target, BarChart2, ArrowLeft
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface GrammarTopic {
  id: number;
  cefr_level: string;
  topic_code: string;
  title_de: string;
  title_vi: string;
  description_vi?: string;
  sort_order: number;
  exercises_done: number;
  exercises_correct: number;
  mastery_percent: number;
  total_exercises: number;
  last_practiced_at?: string;
}

interface Exercise {
  id: number;
  exercise_type: string;
  difficulty: number;
  question_json: string;
}

interface QuestionData {
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation_vi?: string;
  explanation_de?: string;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];

const masteryColor = (pct: number) => {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#FFCD00";
  return "#94A3B8";
};

export default function GrammarSyllabusPage() {
  const router = useRouter();
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [cefr, setCefr] = useState("A1");
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Practice state
  const [activeTopic, setActiveTopic] = useState<GrammarTopic | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exIdx, setExIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; correctAnswer: string; explanation: string } | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState({ done: 0, correct: 0 });

  const loadTopics = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${cefr}`);
      setTopics(data ?? []);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [me, cefr]);

  useEffect(() => { void loadTopics(); }, [loadTopics]);

  const startPractice = async (topic: GrammarTopic) => {
    setPracticeLoading(true);
    try {
      const { data } = await api.get<Exercise[]>(`/grammar/syllabus/topics/${topic.id}/exercises?limit=10`);
      if (!data?.length) { alert("Chủ đề này chưa có bài tập. Giáo viên đang soạn!"); return; }
      setExercises(data);
      setActiveTopic(topic);
      setExIdx(0);
      setSelectedAnswer(null);
      setResult(null);
      setSessionStats({ done: 0, correct: 0 });
    } catch {
      alert("Không thể tải bài tập. Vui lòng thử lại.");
    } finally {
      setPracticeLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!activeTopic || result) return;
    setSelectedAnswer(answer);
    const exercise = exercises[exIdx];
    try {
      const { data } = await api.post<{ correct: boolean; correctAnswer: string; explanation: string }>(
        `/grammar/syllabus/exercises/${exercise.id}/submit`, { answer }
      );
      setResult(data);
      setSessionStats(s => ({ done: s.done + 1, correct: s.correct + (data.correct ? 1 : 0) }));
    } catch {
      setResult({ correct: false, correctAnswer: answer, explanation: "" });
    }
  };

  const nextExercise = () => {
    if (exIdx + 1 >= exercises.length) {
      // Session done
      setActiveTopic(null);
      void loadTopics();
      return;
    }
    setExIdx(i => i + 1);
    setSelectedAnswer(null);
    setResult(null);
  };

  if (meLoading || !me) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]">
      <Loader2 className="animate-spin text-[#121212]" size={28} />
    </div>
  );

  // ── Practice screen ──
  if (activeTopic) {
    const exercise = exercises[exIdx];
    let q: QuestionData = { prompt: "", options: [], correct_answer: "" };
    try { q = JSON.parse(exercise.question_json); } catch { /* */ }
    const isMultiChoice = (q.options?.length ?? 0) > 0;
    const progress = ((exIdx) / exercises.length) * 100;

    return (
      <StudentShell activeSection="grammar-practice" user={me} targetLevel={targetLevel}
        streakDays={streakDays} initials={initials} onLogout={() => { logout(); }}
        headerTitle={activeTopic.title_de} headerSubtitle={activeTopic.title_vi}>
        <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

          {/* Progress bar */}
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-[#64748B]">{exIdx}/{exercises.length} câu</span>
              <span className="font-bold text-emerald-600">{sessionStats.correct}/{sessionStats.done} đúng</span>
            </div>
            <div className="h-2 bg-[#F1F4F9] rounded-full overflow-hidden">
              <motion.div className="h-full bg-[#121212] rounded-full"
                animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>
          </div>

          {/* Question */}
          <motion.div key={exIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm space-y-4">

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#121212] text-white uppercase">
                {exercise.exercise_type.replace("_", " ")}
              </span>
              <span className="text-[10px] text-[#94A3B8]">{"⭐".repeat(exercise.difficulty)}</span>
            </div>

            <p className="font-semibold text-[#0F172A] text-base leading-relaxed">{q.prompt}</p>

            {isMultiChoice ? (
              <div className="space-y-2">
                {q.options!.map((opt, i) => {
                  let bg = "bg-[#F8FAFC] border-[#E2E8F0]";
                  if (result) {
                    if (opt === q.correct_answer) bg = "bg-emerald-50 border-emerald-300";
                    else if (opt === selectedAnswer && !result.correct) bg = "bg-red-50 border-red-300";
                  } else if (opt === selectedAnswer) {
                    bg = "bg-[#EEF4FF] border-[#6366F1]";
                  }
                  return (
                    <button key={i} onClick={() => void submitAnswer(opt)}
                      disabled={!!result}
                      className={`w-full text-left px-4 py-3 rounded-xl border font-medium text-sm transition-all ${bg}`}>
                      <span className="text-[#94A3B8] mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <FillBlankInput onSubmit={submitAnswer} disabled={!!result} />
            )}
          </motion.div>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`rounded-2xl p-4 border ${result.correct ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.correct
                    ? <CheckCircle size={18} className="text-emerald-600" />
                    : <XCircle size={18} className="text-red-500" />}
                  <span className="font-bold text-sm">{result.correct ? "Chính xác! 🎉" : `Đáp án: ${result.correctAnswer}`}</span>
                </div>
                {result.explanation && <p className="text-xs text-[#475569] mt-1">{result.explanation}</p>}
                <button onClick={nextExercise}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-[#121212] text-white rounded-xl text-sm font-bold">
                  {exIdx + 1 >= exercises.length ? "Hoàn thành" : "Câu tiếp"} <ChevronRight size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => { setActiveTopic(null); void loadTopics(); }}
            className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#121212]">
            <ArrowLeft size={14} /> Thoát luyện tập
          </button>
        </div>
      </StudentShell>
    );
  }

  // ── Topic list screen ──
  return (
    <StudentShell activeSection="grammar-practice" user={me} targetLevel={targetLevel}
      streakDays={streakDays} initials={initials} onLogout={() => { logout(); }}
      headerTitle="Ngữ pháp" headerSubtitle="Học ngữ pháp theo chủ đề · Goethe Standard">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* CEFR selector */}
        <div className="flex gap-2 flex-wrap">
          {CEFR_LEVELS.map(l => (
            <button key={l} onClick={() => setCefr(l)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: l === cefr ? "#121212" : "#EEF4FF", color: l === cefr ? "white" : "#121212" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {topics.length > 0 && (() => {
          const totalDone = topics.reduce((a, t) => a + t.exercises_done, 0);
          const avgMastery = Math.round(topics.reduce((a, t) => a + t.mastery_percent, 0) / topics.length);
          return (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Chủ đề", value: `${topics.length}` },
                { label: "Bài đã làm", value: totalDone },
                { label: "Mastery TB", value: `${avgMastery}%` },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
                  <p className="text-xl font-extrabold text-[#0F172A]">{s.value}</p>
                  <p className="text-[10px] text-[#94A3B8]">{s.label}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Topic list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#121212]" />
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-[#64748B] text-sm">Chưa có chủ đề ngữ pháp cho cấp {cefr}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic, i) => {
              const mastery = Math.round(topic.mastery_percent);
              const hasExercises = (topic.total_exercises ?? 0) > 0;
              return (
                <motion.div key={topic.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-[#121212]/20 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#121212]/10 text-[#121212]">
                          {topic.topic_code}
                        </span>
                        {mastery >= 80 && <span className="text-[10px] text-emerald-600 font-bold">✓ Mastered</span>}
                      </div>
                      <p className="font-semibold text-[#0F172A] text-sm">{topic.title_de}</p>
                      <p className="text-xs text-[#64748B]">{topic.title_vi}</p>
                      {topic.description_vi && (
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{topic.description_vi}</p>
                      )}
                      {topic.exercises_done > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-[#94A3B8]">{topic.exercises_done} bài đã làm</span>
                            <span className="text-[10px] font-bold" style={{ color: masteryColor(mastery) }}>
                              {mastery}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#F1F4F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${mastery}%`, background: masteryColor(mastery) }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { if (hasExercises) void startPractice(topic); }}
                      disabled={practiceLoading || !hasExercises}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                      style={{ background: hasExercises ? "#121212" : "#F1F4F9", color: hasExercises ? "white" : "#94A3B8" }}>
                      {practiceLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                      {hasExercises ? "Luyện" : "Sắp có"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}

// Simple fill-in-blank input component
function FillBlankInput({ onSubmit, disabled }: { onSubmit: (a: string) => void; disabled: boolean }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onSubmit(val); setVal(""); } }}
        disabled={disabled}
        placeholder="Nhập đáp án..."
        className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#121212]/40" />
      <button onClick={() => { if (val.trim()) { onSubmit(val); setVal(""); } }}
        disabled={disabled || !val.trim()}
        className="px-4 py-2 bg-[#121212] text-white rounded-xl text-sm font-bold disabled:opacity-40">
        OK
      </button>
    </div>
  );
}
