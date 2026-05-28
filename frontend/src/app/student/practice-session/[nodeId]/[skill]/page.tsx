"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Trophy,
  Headphones,
  Mic,
  BookOpen,
  PenTool,
  Loader2,
  Volume2,
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exercise {
  type: string;
  instruction_vi: string;
  // LISTEN types
  audio_transcript?: string;
  question_vi?: string;
  sentence_with_blank?: string;
  // SPRECHEN types
  sentence_de?: string;
  sentence_vi?: string;
  question_de?: string;
  expected_answer?: string;
  grading_keywords?: string[];
  focus_sounds?: string[];
  scenario_vi?: string;
  partner_line_de?: string;
  expected_response?: string;
  situation_vi?: string;
  expected_phrases?: string[];
  // LESEN types
  statement_de?: string;
  // SCHREIBEN types
  words?: string[];
  correct_order?: string[];
  translation_vi?: string;
  hint_vi?: string;
  grammar_rule_vi?: string;
  prompt_vi?: string;
  prompt_de?: string;
  min_words?: number;
  example_answer?: string;
  // Common
  options?: string[];
  correct_index?: number;
  correct_answer?: string | boolean;
  accept_also?: string[];
  explanation_vi?: string;
  pairs?: { de: string; vi: string }[];
}

interface SessionDetail {
  sessionId: number;
  skillType: string;
  generation: number;
  status: string;
  scorePercent: number;
  exercises: Exercise[] | { reading_passage?: any; exercises?: Exercise[] };
  sourceNodeTitle: string;
  sourceNodeTitleVi: string;
}

// ─── Skill Config ─────────────────────────────────────────────────────────────

const SKILL_META: Record<string, { icon: any; label: string; gradient: string; text: string }> = {
  hoeren: { icon: Headphones, label: "Nghe · Hören", gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)", text: "#7C3AED" },
  sprechen: { icon: Mic, label: "Nói · Sprechen", gradient: "linear-gradient(135deg, #EC4899, #F472B6)", text: "#EC4899" },
  lesen: { icon: BookOpen, label: "Đọc · Lesen", gradient: "linear-gradient(135deg, #0EA5E9, #38BDF8)", text: "#0EA5E9" },
  schreiben: { icon: PenTool, label: "Viết · Schreiben", gradient: "linear-gradient(135deg, #F59E0B, #FBBF24)", text: "#F59E0B" },
};

// ─── Exercise Renderer ────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  index,
  onAnswer,
  answered,
  userAnswer,
  isCorrect,
}: {
  exercise: Exercise;
  index: number;
  onAnswer: (answer: any) => void;
  answered: boolean;
  userAnswer: any;
  isCorrect: boolean | null;
}) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [speaking, setSpeaking] = useState(false);

  // TTS for audio exercises
  const playAudio = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleOptionClick = (idx: number) => {
    if (answered) return;
    setSelectedOption(idx);
    onAnswer(idx);
  };

  const handleTextSubmit = () => {
    if (answered || !textInput.trim()) return;
    onAnswer(textInput.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl border-2 p-5 bg-white"
      style={{
        borderColor: answered
          ? isCorrect
            ? "#BBF7D0"
            : "#FECACA"
          : "#E2E8F0",
      }}
    >
      {/* Question number + type badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-[#F1F5F9] flex items-center justify-center text-xs font-bold text-[#64748B]">
          {index + 1}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] uppercase">
          {exercise.type.replace(/_/g, " ")}
        </span>
      </div>

      {/* Instruction */}
      <p className="text-sm font-semibold text-[#0F172A] mb-3">{exercise.instruction_vi}</p>

      {/* Audio button for listening exercises */}
      {exercise.audio_transcript && (
        <button
          type="button"
          onClick={() => playAudio(exercise.audio_transcript!)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-sm font-semibold mb-4 hover:bg-[#EDE9FE] transition-all active:scale-95"
        >
          <Volume2 size={16} /> Nghe
        </button>
      )}

      {/* Reading passage */}
      {exercise.type === "READ_AND_CHOOSE" || exercise.type === "READ_TRUE_FALSE" || exercise.type === "READ_AND_FILL" ? (
        exercise.statement_de && (
          <div className="px-4 py-3 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] mb-4">
            <p className="text-sm text-[#0369A1] leading-relaxed italic">&quot;{exercise.statement_de}&quot;</p>
          </div>
        )
      ) : null}

      {/* Sentence with blank */}
      {exercise.sentence_with_blank && (
        <div className="px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-4">
          <p className="text-sm text-[#0F172A] font-medium">{exercise.sentence_with_blank}</p>
        </div>
      )}

      {/* Sentence for speaking */}
      {exercise.sentence_de && (exercise.type === "SPEAKING_REPEAT" || exercise.type === "SPEAKING_RESPONSE") && (
        <div className="px-4 py-3 rounded-xl bg-[#FDF2F8] border border-[#FBCFE8] mb-4">
          <p className="text-base font-bold text-[#0F172A]">{exercise.sentence_de}</p>
          {exercise.sentence_vi && <p className="text-xs text-[#64748B] mt-1">{exercise.sentence_vi}</p>}
          <button
            type="button"
            onClick={() => playAudio(exercise.sentence_de!)}
            className="mt-2 flex items-center gap-1 text-xs text-[#EC4899] font-semibold"
          >
            <Volume2 size={12} /> Nghe mẫu
          </button>
        </div>
      )}

      {/* Question */}
      {exercise.question_vi && !exercise.audio_transcript && (
        <p className="text-sm text-[#475569] mb-3">{exercise.question_vi}</p>
      )}
      {exercise.question_de && (
        <p className="text-sm text-[#0F172A] font-medium mb-3">{exercise.question_de}</p>
      )}

      {/* Words to reorder */}
      {exercise.type === "REORDER_WORDS" && exercise.words && (
        <div className="flex flex-wrap gap-2 mb-4">
          {exercise.words.map((word, i) => (
            <span key={i} className="px-3 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-sm font-medium text-[#92400E]">
              {word}
            </span>
          ))}
        </div>
      )}

      {/* Options (multiple choice) */}
      {exercise.options && exercise.options.length > 0 && (
        <div className="space-y-2 mb-3">
          {exercise.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isAnswer = exercise.correct_index === idx;
            let optStyle: React.CSSProperties = {
              background: "#F8FAFC",
              borderColor: "#E2E8F0",
              color: "#0F172A",
            };
            if (answered) {
              if (isAnswer) {
                optStyle = { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#059669" };
              } else if (isSelected && !isAnswer) {
                optStyle = { background: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" };
              }
            } else if (isSelected) {
              optStyle = { background: "#EEF2FF", borderColor: "#A5B4FC", color: "#4338CA" };
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleOptionClick(idx)}
                disabled={answered}
                className="w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all active:scale-[0.98] disabled:cursor-default"
                style={optStyle}
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ borderColor: optStyle.borderColor }}
                  >
                    {answered && isAnswer ? <Check size={12} /> : answered && isSelected && !isAnswer ? <X size={12} /> : String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Text input (for dictation, translation, fill) */}
      {!exercise.options && (exercise.correct_answer !== undefined && typeof exercise.correct_answer === "string") && exercise.type !== "SPEAKING_REPEAT" && exercise.type !== "SPEAKING_RESPONSE" && exercise.type !== "ROLE_PLAY" && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            disabled={answered}
            placeholder="Nhập câu trả lời..."
            className="flex-1 px-4 py-3 rounded-xl border-2 border-[#E2E8F0] text-sm focus:outline-none focus:border-[#A5B4FC] disabled:bg-[#F8FAFC]"
          />
          {!answered && (
            <button
              type="button"
              onClick={handleTextSubmit}
              className="px-4 py-3 rounded-xl bg-[#121212] text-white text-sm font-bold active:scale-95"
            >
              <Check size={16} />
            </button>
          )}
        </div>
      )}

      {/* Speaking exercises — simplified (mark as done) */}
      {(exercise.type === "SPEAKING_REPEAT" || exercise.type === "SPEAKING_RESPONSE" || exercise.type === "ROLE_PLAY" || exercise.type === "SPEAKING_DESCRIBE") && !answered && (
        <button
          type="button"
          onClick={() => onAnswer("spoken")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#FDF2F8] border border-[#FBCFE8] text-[#EC4899] text-sm font-bold transition-all active:scale-95"
        >
          <Mic size={16} /> Tôi đã đọc xong
        </button>
      )}

      {/* Explanation (shown after answering) */}
      {answered && exercise.explanation_vi && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: isCorrect ? "#F0FDF4" : "#FFF7ED",
            border: `1px solid ${isCorrect ? "#BBF7D0" : "#FED7AA"}`,
          }}
        >
          <p className="font-semibold text-xs mb-1" style={{ color: isCorrect ? "#059669" : "#C2410C" }}>
            {isCorrect ? "✅ Chính xác!" : "❌ Chưa đúng"}
          </p>
          <p className="text-[#475569]">{exercise.explanation_vi}</p>
          {!isCorrect && exercise.correct_answer && typeof exercise.correct_answer === "string" && (
            <p className="mt-1 font-semibold text-[#0F172A]">
              Đáp án: {exercise.correct_answer}
            </p>
          )}
          {exercise.grammar_rule_vi && (
            <p className="mt-1 text-xs text-[#7C3AED] font-medium">📝 {exercise.grammar_rule_vi}</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PracticeSessionPage() {
  usePageTimeTracker('practice_session');
  const params = useParams();
  const router = useRouter();
  const nodeId = Number(params?.nodeId);
  const skill = (params?.skill as string)?.toUpperCase() as string;
  const skillLower = (params?.skill as string)?.toLowerCase() || "";

  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Map<number, { answer: any; correct: boolean }>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [generatingNext, setGeneratingNext] = useState(false);

  const meta = SKILL_META[skillLower] || SKILL_META.lesen;
  const Icon = meta.icon;

  // Fetch or create session
  const fetchSession = useCallback(async () => {
    if (!nodeId || !skill) return;
    setLoading(true);
    try {
      // Try to start/get session
      const { data } = await api.post<any>(`/skill-tree/${nodeId}/practice/${skill}/start`);

      if (data.sessions) {
        // Got overview — find this skill's session
        const s = data.sessions.find((s: any) => s.skill_type === skill);
        if (s) {
          const detail = await api.get<SessionDetail>(`/skill-tree/practice/${s.id}`);
          setSession(detail.data);
          parseExercises(detail.data.exercises);
        }
      } else if (data.sessionId) {
        // Direct session created — fetch detail
        const detail = await api.get<SessionDetail>(`/skill-tree/practice/${data.sessionId}`);
        setSession(detail.data);
        parseExercises(detail.data.exercises);
      }
    } catch (err) {
      console.error("[PracticeSession] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [nodeId, skill]);

  const parseExercises = (data: any) => {
    if (Array.isArray(data)) {
      setExercises(data);
    } else if (data?.exercises && Array.isArray(data.exercises)) {
      setExercises(data.exercises);
    } else {
      setExercises([]);
    }
  };

  useEffect(() => {
    if (me && nodeId && skill) void fetchSession();
  }, [me, nodeId, skill, fetchSession]);

  // Handle answer
  const handleAnswer = (index: number, answer: any) => {
    const exercise = exercises[index];
    let correct = false;

    if (exercise.correct_index !== undefined && typeof answer === "number") {
      correct = answer === exercise.correct_index;
    } else if (exercise.correct_answer !== undefined && typeof answer === "string") {
      const normalizedAnswer = answer.toLowerCase().trim();
      const normalizedCorrect = String(exercise.correct_answer).toLowerCase().trim();
      correct = normalizedAnswer === normalizedCorrect;
      if (!correct && exercise.accept_also) {
        correct = exercise.accept_also.some(
          (alt) => alt.toLowerCase().trim() === normalizedAnswer
        );
      }
    } else if (answer === "spoken") {
      // Speaking exercises — always count as correct for now
      correct = true;
    }

    setAnswers((prev) => new Map(prev).set(index, { answer, correct }));
  };

  // Submit all
  const handleSubmit = async () => {
    if (!session || submitted) return;
    setSubmitted(true);

    const correctCount = Array.from(answers.values()).filter((a) => a.correct).length;
    const scorePercent = exercises.length > 0 ? Math.round((correctCount / exercises.length) * 100) : 0;

    try {
      const { data } = await api.post(`/skill-tree/practice/${session.sessionId}/submit`, {
        score_percent: scorePercent,
        answers: Object.fromEntries(answers),
      });
      setSubmitResult(data);
    } catch {
      setSubmitResult({ scorePercent, xpEarned: 0, status: "COMPLETED" });
    }
  };

  // Generate next
  const handleGenerateNext = async () => {
    if (!nodeId) return;
    setGeneratingNext(true);
    try {
      const { data } = await api.post<any>(`/skill-tree/${nodeId}/practice/${skill}/next`);
      if (data.sessionId) {
        const detail = await api.get<SessionDetail>(`/skill-tree/practice/${data.sessionId}`);
        setSession(detail.data);
        parseExercises(detail.data.exercises);
        setAnswers(new Map());
        setSubmitted(false);
        setSubmitResult(null);
      }
    } catch (err) {
      console.error("[PracticeSession] next gen error:", err);
    } finally {
      setGeneratingNext(false);
    }
  };

  const correctCount = useMemo(
    () => Array.from(answers.values()).filter((a) => a.correct).length,
    [answers]
  );
  const allAnswered = answers.size === exercises.length && exercises.length > 0;

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="roadmap"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout(); }}
      headerTitle={meta.label}
      headerSubtitle={session ? `${session.sourceNodeTitleVi} · Gen ${session.generation}` : "Đang tải..."}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.push(`/student/practice-node/${nodeId}`)}
          className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại chọn kỹ năng
        </button>

        {/* Header */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 border-2 border-[#E2E8F0] bg-white flex items-center gap-4"
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{ background: meta.gradient }}
            >
              <Icon size={26} />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-[#0F172A]">{meta.label}</h1>
              <p className="text-xs text-[#64748B]">
                {session.sourceNodeTitleVi} · Thế hệ {session.generation} · {exercises.length} câu
              </p>
            </div>
            {/* Progress circle */}
            <div className="text-center">
              <div className="text-2xl font-black" style={{ color: meta.text }}>
                {correctCount}/{exercises.length}
              </div>
              <p className="text-[10px] text-[#94A3B8]">Đúng</p>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#64748B]" />
            <span className="ml-3 text-sm text-[#64748B]">AI đang sinh bài tập...</span>
          </div>
        )}

        {/* Reading passage (for LESEN) */}
        {session && (session.exercises as any)?.reading_passage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 border-2 border-[#BAE6FD] bg-[#F0F9FF]"
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className="text-[#0EA5E9]" />
              <span className="text-xs font-bold text-[#0369A1] uppercase">
                {(session.exercises as any).reading_passage.text_type || "Lesetext"}
              </span>
            </div>
            <p className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
              {(session.exercises as any).reading_passage.text_de}
            </p>
          </motion.div>
        )}

        {/* Exercises */}
        {!loading && exercises.length > 0 && (
          <div className="space-y-4">
            {exercises.map((exercise, idx) => (
              <ExerciseCard
                key={idx}
                exercise={exercise}
                index={idx}
                onAnswer={(answer) => handleAnswer(idx, answer)}
                answered={answers.has(idx)}
                userAnswer={answers.get(idx)?.answer}
                isCorrect={answers.get(idx)?.correct ?? null}
              />
            ))}
          </div>
        )}

        {/* Submit button */}
        {allAnswered && !submitted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-4"
          >
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-95"
              style={{ background: "#121212", boxShadow: "0 4px 0 #000, 0 8px 24px rgba(0,0,0,0.15)" }}
            >
              <Check size={18} /> Nộp bài · {correctCount}/{exercises.length} đúng
            </button>
          </motion.div>
        )}

        {/* Result */}
        {submitResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 border-2 text-center"
            style={{
              background: submitResult.scorePercent >= 60 ? "#F0FDF4" : "#FFF7ED",
              borderColor: submitResult.scorePercent >= 60 ? "#BBF7D0" : "#FED7AA",
            }}
          >
            <Trophy size={40} className="mx-auto mb-3" style={{ color: submitResult.scorePercent >= 60 ? "#10B981" : "#F59E0B" }} />
            <h2 className="text-2xl font-black text-[#0F172A] mb-1">
              {submitResult.scorePercent ?? correctCount * Math.round(100 / exercises.length)}%
            </h2>
            <p className="text-sm text-[#64748B] mb-1">
              {correctCount} / {exercises.length} câu đúng
            </p>
            {submitResult.xpEarned > 0 && (
              <p className="text-sm font-bold text-[#10B981]">+{submitResult.xpEarned} XP 🎉</p>
            )}

            <div className="flex gap-3 mt-6 justify-center">
              <button
                type="button"
                onClick={() => void handleGenerateNext()}
                disabled={generatingNext}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ background: meta.gradient }}
              >
                {generatingNext ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generatingNext ? "Đang sinh..." : "🔄 Làm thêm bài mới"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/student/practice-node/${nodeId}`)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border-2 border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F8FAFC] transition-all active:scale-95"
              >
                <ArrowLeft size={14} /> Chọn kỹ năng khác
              </button>
            </div>

            {submitResult.totalSeenCount > 0 && (
              <p className="mt-4 text-xs text-[#94A3B8]">
                Tổng cộng đã luyện {submitResult.totalSeenCount} câu không lặp lại
              </p>
            )}
          </motion.div>
        )}
      </div>
    </StudentShell>
  );
}
