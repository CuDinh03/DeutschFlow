"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Loader2, XCircle } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";
import { useTracking } from "@/hooks/useTracking";
import GrammarHeader from "./components/GrammarHeader";
import TopicCard from "./components/TopicCard";

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
  return <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden w-full"><div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} /></div>;
}

export type { GrammarTopic, Exercise, ParsedQuestion };

function GrammarTopicList({
  cefr,
  loading,
  topics,
  onChangeCefr,
  onOpenTopic,
}: {
  cefr: string;
  loading: boolean;
  topics: GrammarTopic[];
  onChangeCefr: (level: string) => void;
  onOpenTopic: (topic: GrammarTopic) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-900 text-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Grammar reinforcement</p>
        <h1 className="text-xl font-extrabold mt-1">Chọn chủ đề cần ôn nhanh</h1>
        <p className="text-sm text-slate-300 mt-2">
          Danh sách dưới đây được ưu tiên theo mức độ chưa vững để tránh overload.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CEFR_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onChangeCefr(level)}
            className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap"
            style={{ background: level === cefr ? "#6366F1" : "#EEF2FF", color: level === cefr ? "white" : "#6366F1" }}
          >
            {level}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#6366F1]" />
        </div>
      )}
    </div>
  );
}

function GrammarExerciseView({
  topic,
  currentIdx,
  total,
  score,
  loading,
  prompt,
  answer,
  setAnswer,
  submitting,
  result,
  onBack,
  onSubmit,
  onNext,
}: {
  topic: GrammarTopic;
  currentIdx: number;
  total: number;
  score: { correct: number; total: number };
  loading: boolean;
  prompt: ParsedQuestion | null;
  answer: string;
  setAnswer: (v: string) => void;
  submitting: boolean;
  result: { correct: boolean; correctAnswer: string; explanation: string } | null;
  onBack: () => void;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const currentExerciseNumber = currentIdx + 1;
  const progress = total > 0 ? (currentIdx / total) * 100 : 0;

  return (
    <motion.div key="exercise" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <p className="font-bold text-[#0F172A]">{topic.title_de}</p>
          <p className="text-xs text-[#64748B]">{topic.title_vi}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-[#0F172A]">
            {currentExerciseNumber}/{total}
          </p>
          <p className="text-xs text-[#94A3B8]">
            {score.correct}/{score.total} đúng
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#6366F1]" />
        </div>
      )}

      {!loading && prompt && (
        <div className="space-y-4">
          <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6366F1] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#6366F1]">
                {prompt.options ? "Trắc nghiệm" : "Tự luận"}
              </span>
              <span className="text-xs text-[#94A3B8]">Khó: {"★".repeat(3)}</span>
            </div>
            <p className="text-lg font-semibold text-[#0F172A] mb-4">{prompt.prompt}</p>
            {prompt.options?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {prompt.options.map((option) => {
                  const isSelected = answer === option;
                  const isCorrect = result && option === result.correctAnswer;
                  const isWrong = result && isSelected && !result.correct;
                  return (
                    <button
                      key={option}
                      onClick={() => !result && setAnswer(option)}
                      disabled={!!result}
                      className="text-left px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all"
                      style={{
                        borderColor: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : isSelected ? "#6366F1" : "#E2E8F0",
                        background: isCorrect ? "#f0fdf4" : isWrong ? "#fef2f2" : isSelected ? "#EEF2FF" : "white",
                        color: isCorrect ? "#16a34a" : isWrong ? "#dc2626" : isSelected ? "#6366F1" : "#0F172A",
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                value={answer}
                onChange={(e) => !result && setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !result && onSubmit()}
                placeholder="Nhập câu trả lời..."
                disabled={!!result}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#E2E8F0] focus:border-[#6366F1] outline-none text-sm font-medium"
              />
            )}

            {!result && (
              <button
                onClick={onSubmit}
                disabled={!answer.trim() || submitting}
                className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                style={{ background: "#6366F1" }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kiểm tra"}
              </button>
            )}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-5 border-2 ${result.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {result.correct ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <XCircle size={20} className="text-red-500" />
                  )}
                  <p className="font-bold" style={{ color: result.correct ? "#16a34a" : "#dc2626" }}>
                    {result.correct ? "Chính xác! 🎉" : "Chưa đúng"}
                  </p>
                </div>
                {!result.correct && (
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">
                    Đáp án: <span className="text-green-600">{result.correctAnswer}</span>
                  </p>
                )}
                {result.explanation && <p className="text-sm text-[#475569]">{String(result.explanation)}</p>}
                <button
                  onClick={onNext}
                  className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                  style={{ background: result.correct ? "#16a34a" : "#6366F1" }}
                >
                  Tiếp theo <ChevronRight size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

export default function GrammarSyllabusPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const { trackFeatureAction } = useTracking();

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
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [cefr]);

  useEffect(() => {
    if (me) fetchTopics();
  }, [me, fetchTopics]);

  const recommendedTopics = useMemo(
    () => topics.filter((topic) => topic.mastery_percent < 80).sort((a, b) => a.mastery_percent - b.mastery_percent).slice(0, 6),
    [topics]
  );

  const openTopic = async (topic: GrammarTopic) => {
    setActiveTopic(topic);
    setCurrentIdx(0);
    setAnswer("");
    setResult(null);
    setSessionScore({ correct: 0, total: 0 });
    setExLoading(true);
    trackFeatureAction("grammar", "started", { topicId: topic.id, title: topic.title_de });
    try {
      const { data } = await api.get<Exercise[]>(`/grammar/syllabus/topics/${topic.id}/exercises?limit=10`);
      setExercises(data ?? []);
    } catch {
      setExercises([]);
    } finally {
      setExLoading(false);
    }
  };

  const resetTopic = useCallback(() => {
    setActiveTopic(null);
    setExercises([]);
    setCurrentIdx(0);
    setAnswer("");
    setResult(null);
    setSessionScore({ correct: 0, total: 0 });
  }, []);

  const submit = async () => {
    if (!answer.trim() || !exercises[currentIdx]) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{ correct: boolean; correctAnswer: string; explanation: string }>(
        `/grammar/syllabus/exercises/${exercises[currentIdx].id}/submit`,
        { answer }
      );
      setResult(data);
      setSessionScore((s) => ({ correct: s.correct + (data.correct ? 1 : 0), total: s.total + 1 }));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx((i) => i + 1);
      setAnswer("");
      setResult(null);
      return;
    }

    if (activeTopic) {
      trackFeatureAction("grammar", "completed", { topicId: activeTopic.id, score: sessionScore.correct, total: sessionScore.total });
    }
    resetTopic();
    fetchTopics();
  };

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const currentEx = exercises[currentIdx];
  const parsed: ParsedQuestion | null = currentEx
    ? (() => {
        try {
          return JSON.parse(currentEx.question_json);
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <StudentShell
      activeSection="grammar-syllabus"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="📚 Grammar Syllabus"
      headerSubtitle="Ngữ pháp bài bản theo chuẩn Goethe"
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!activeTopic ? (
          <div className="space-y-6">
            <GrammarHeader />
            <GrammarTopicList cefr={cefr} loading={loading} topics={recommendedTopics} onChangeCefr={setCefr} onOpenTopic={openTopic} />
            {!loading && recommendedTopics.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-[#E2E8F0]">
                <BookOpen size={40} className="text-[#C7D2FE] mx-auto mb-3" />
                <p className="font-semibold text-[#0F172A]">Chưa có chủ đề nổi bật ở cấp {cefr}</p>
              </div>
            )}
            {!loading && recommendedTopics.length > 0 && (
              <div className="space-y-3">
                {recommendedTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} onOpen={openTopic} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <GrammarExerciseView
            topic={activeTopic}
            currentIdx={currentIdx}
            total={exercises.length}
            score={sessionScore}
            loading={exLoading}
            prompt={parsed}
            answer={answer}
            setAnswer={setAnswer}
            submitting={submitting}
            result={result}
            onBack={() => {
              trackFeatureAction("grammar", "quit", { topicId: activeTopic.id, progress: currentIdx });
              resetTopic();
            }}
            onSubmit={submit}
            onNext={next}
          />
        )}
      </div>
    </StudentShell>
  );
}
