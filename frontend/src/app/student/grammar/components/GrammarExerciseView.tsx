"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, XCircle } from "lucide-react";
import type { GrammarTopic, ParsedQuestion } from "../page";

export default function GrammarExerciseView({
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
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <p className="font-bold text-slate-900">{topic.title_de}</p>
          <p className="text-xs text-slate-500">{topic.title_vi}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{currentExerciseNumber}/{total}</p>
          <p className="text-xs text-slate-400">{score.correct}/{score.total} đúng</p>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>}

      {!loading && prompt && (
        <div className="space-y-4">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">{prompt.options ? "Trắc nghiệm" : "Tự luận"}</span>
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-4">{prompt.prompt}</p>
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
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium"
              />
            )}
            {!result && <button onClick={onSubmit} disabled={!answer.trim() || submitting} className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 shadow-sm" style={{ background: "#6366F1" }}>{submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Kiểm tra"}</button>}
          </div>
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-5 border-2 shadow-sm ${result.correct ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.correct ? <CheckCircle2 size={20} className="text-emerald-500" /> : <XCircle size={20} className="text-rose-500" />}
                  <p className="font-bold" style={{ color: result.correct ? "#16a34a" : "#dc2626" }}>{result.correct ? "Chính xác! 🎉" : "Chưa đúng"}</p>
                </div>
                {!result.correct && <p className="text-sm font-semibold text-slate-900 mb-2">Đáp án: <span className="text-emerald-600">{result.correctAnswer}</span></p>}
                {result.explanation && <p className="text-sm text-slate-600">{String(result.explanation)}</p>}
                <button onClick={onNext} className="mt-4 w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-sm" style={{ background: result.correct ? "#16a34a" : "#6366F1" }}>Tiếp theo <ChevronRight size={16} /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
