"use client";

import { NodeContent, VocabItem, useNodeSessionStore } from "@/stores/useNodeSessionStore";
import { useState, useCallback, useRef, useMemo } from "react";
import { BookOpenText, FileQuestion, Lightbulb, Save, X, Check, CircleCheck } from "lucide-react";
import { GenderBadge, AudioButton } from "./LearnComponents";
import { reviewApi } from "@/lib/reviewApi";
import { apiMessage } from "@/lib/api";
import {
  correctIndexOf,
  isScored,
  gradeItems,
  questionTextOf,
  MULTIPLE_CHOICE,
  type AnswerMap,
  type NodeExerciseItem,
} from "@/lib/nodeExercises";

// ── Tap-to-translate tooltip ──
function TranslateTooltip({
  vocab, position, onClose, onSaveFlashcard, isSaved, saveError,
}: {
  vocab: VocabItem;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveFlashcard: (vocab: VocabItem) => void;
  isSaved: boolean;
  saveError: string | null;
}) {
  return (
    <div
      className="fixed z-50 bg-ga-card rounded-ga shadow-ga-card-hover border border-ga-line p-3 space-y-2 min-w-0 max-w-[calc(100vw_-_32px)] sm:min-w-[200px] sm:max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
      style={{ left: Math.min(position.x, window.innerWidth - 300), top: position.y + 10 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GenderBadge gender={vocab.gender} label={vocab.gender_label} />
          <span className="font-bold text-sm text-ga-ink">{vocab.german}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="text-ga-subtle hover:text-ga-ink"><X size={14} aria-hidden /></button>
      </div>
      <p className="text-sm text-ga-muted">{vocab.meaning}</p>
      {vocab.example_de && <p className="text-xs text-ga-subtle italic">{'"'}{vocab.example_de}{'"'}</p>}
      <div className="flex items-center gap-2 pt-1">
        <AudioButton text={vocab.speak_de} compact />
        <button
          type="button"
          onClick={() => onSaveFlashcard(vocab)}
          disabled={isSaved}
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold transition-colors ${
            isSaved
              ? "bg-ga-green text-white cursor-default"
              : "bg-ga-yellow text-ga-ink hover:bg-ga-yellow/80"
          }`}
        >
          {isSaved ? <><Check size={11} aria-hidden /> Đã lưu</> : <><Save size={11} aria-hidden /> Lưu Flashcard</>}
        </button>
      </div>
      {saveError && <p className="text-[10px] text-ga-red">{saveError}</p>}
    </div>
  );
}

export default function ReadingView({ content, isLocked = false }: { content: NodeContent; isLocked?: boolean }) {
  const { markTabCompleted, tabCompletion, session } = useNodeSessionStore();
  const isCompleted = tabCompletion.reading;

  const [tooltip, setTooltip] = useState<{ vocab: VocabItem; pos: { x: number; y: number } } | null>(null);
  const [savedFlashcards, setSavedFlashcards] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const passage = content.reading_passage;
  
  // ── Practice Quiz Logic ──
  const practiceItems = useMemo(
    () =>
      // Chỉ giữ mục máy chủ thật sự chấm — cùng lý do với GrammarView: mục không chấm được sẽ
      // hiện dòng trống kèm ô nhập và làm sai mẫu số "đúng x/y".
      (Array.isArray(passage?.questions) ? passage.questions : [])
        .filter((q): q is NodeExerciseItem => !!q && typeof q === "object")
        .filter(isScored),
    [passage?.questions]
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Trước đây so với `item.answerIndex`, nhưng nội dung thật dùng khoá `correct` ⇒ điểm luôn 0 và
  // tab Đọc không bao giờ qua được (F-21). Mẫu số cũ chỉ đếm mục có `options` nên câu FILL_BLANK
  // vừa không hiện ô nhập vừa bị bỏ khỏi phép tính.
  const graded = useMemo(() => gradeItems(practiceItems, answers), [practiceItems, answers]);
  const score = graded.correct;
  const validMcqCount = graded.scored;

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
    if (graded.scored > 0 && graded.correct === graded.scored) {
      markTabCompleted("reading", graded.percent);
    }
  };
  // Build vocab lookup from refs
  const vocabMap = useMemo(() => {
    const map = new Map<string, VocabItem>();
    for (const v of content.vocabulary) {
      map.set(v.id, v);
      const base = v.german.replace(/^(der|die|das|ein|eine)\s+/i, "").toLowerCase();
      map.set(base, v);
    }
    return map;
  }, [content.vocabulary]);

  // Handle text selection (Event Delegation + getSelection)
  const handleTextClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTooltip(null);
      return;
    }

    const selectedText = selection.toString().trim().toLowerCase();
    if (!selectedText || selectedText.length > 30) return;

    const found = vocabMap.get(selectedText);
    if (found) {
      setSaveError(null);
      setTooltip({ vocab: found, pos: { x: e.clientX, y: e.clientY } });
    } else {
      setTooltip(null);
    }
  }, [vocabMap]);

  const handleSaveFlashcard = useCallback(async (vocab: VocabItem) => {
    setSaveError(null);
    try {
      await reviewApi.scheduleVocab({
        nodeId: session?.nodeId,
        vocabId: vocab.id,
        german: vocab.german,
        meaning: vocab.meaning,
        exampleDe: vocab.example_de,
        speakDe: vocab.speak_de,
      });
      setSavedFlashcards((prev) => new Set(prev).add(vocab.id));
    } catch (e) {
      setSaveError(apiMessage(e));
    }
  }, [session?.nodeId]);

  if (!passage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-ga-card rounded-ga border border-ga-line">
        <BookOpenText size={40} className="mb-3 text-ga-subtle" aria-hidden />
        <p className="text-sm text-ga-muted">Bài đọc chưa có cho bài học này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Split-screen layout ── */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Text (60%) */}
        <div className="md:w-[60%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded bg-ga-ink text-white flex items-center justify-center"><BookOpenText size={13} aria-hidden /></span>
            <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide">Bài đọc</h2>
          </div>

          <div
            ref={textRef}
            onClick={handleTextClick}
            className="bg-ga-card rounded-ga border border-ga-line p-5 text-[15px] leading-relaxed text-ga-ink cursor-text select-text"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {passage.text_de}
          </div>

          <p className="flex items-center gap-1 text-xs text-ga-subtle italic">
            <Lightbulb size={12} aria-hidden /> Bôi đen từ bất kỳ để xem nghĩa
          </p>
        </div>

        {/* Questions (40%) */}
        <div className="md:w-[40%] space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded bg-ga-yellow text-ga-ink flex items-center justify-center"><FileQuestion size={13} aria-hidden /></span>
            <h2 className="text-sm font-bold text-ga-ink uppercase tracking-wide">Câu hỏi</h2>
          </div>

          <div className="bg-ga-card rounded-ga border border-ga-line p-4 space-y-4 md:sticky md:top-4">
            {practiceItems.length > 0 ? (
              <div className="space-y-6 text-left">
                {practiceItems.map((item: any, i: number) => {
                  if (typeof item === "string") {
                    return (
                      <div key={i} className="space-y-2">
                        <p className="text-sm font-medium text-ga-ink">{item}</p>
                        <textarea
                          className="w-full rounded-ga border border-ga-line px-3 py-2 text-sm focus:border-ga-yellow focus:ring-1 focus:ring-[#FFCD00] outline-none resize-none"
                          rows={2}
                          placeholder="Viết câu trả lời (tự luận)..."
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="space-y-3">
                      <p className="text-sm font-bold text-ga-ink">{i + 1}. {questionTextOf(item) ?? ""}</p>
                      {item.type !== MULTIPLE_CHOICE ? (
                        <input
                          type="text"
                          value={typeof answers[i] === "string" ? (answers[i] as string) : ""}
                          onChange={(e) => { if (!quizSubmitted) setAnswers((prev: AnswerMap) => ({ ...prev, [i]: e.target.value })); }}
                          disabled={quizSubmitted}
                          placeholder={item.hint_vi ?? "Nhập câu trả lời"}
                          aria-label={questionTextOf(item) ?? `Câu ${i + 1}`}
                          className="w-full rounded-ga border-2 border-ga-line px-3 py-2 text-xs focus:border-ga-yellow focus:outline-none disabled:opacity-60"
                        />
                      ) : (
                      <div className="space-y-2">
                        {Array.isArray(item.options) && item.options.map((opt: string, j: number) => {
                          const isSelected = answers[i] === j;
                          const isCorrect = correctIndexOf(item) === j;
                          const showResult = quizSubmitted;
                          
                          let btnClass = "border-ga-line hover:border-ga-line text-ga-muted";
                          if (isSelected && !showResult) btnClass = "border-ga-yellow bg-ga-yellow/10 text-ga-ink";
                          if (showResult && isCorrect) btnClass = "border-ga-green bg-ga-green-soft text-ga-green";
                          if (showResult && isSelected && !isCorrect) btnClass = "border-ga-red bg-ga-red-soft text-ga-red";

                          return (
                            <button
                              key={j}
                              onClick={() => !quizSubmitted && setAnswers((prev: AnswerMap) => ({ ...prev, [i]: j }))}
                              disabled={quizSubmitted}
                              className={`w-full text-left px-3 py-2 rounded-ga border-2 text-xs font-medium transition-[background-color,border-color,color,box-shadow,transform] ${btnClass}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}

                {validMcqCount > 0 && !isCompleted && (
                  <button
                    onClick={handleQuizSubmit}
                    disabled={
                      practiceItems.filter((_: unknown, i: number) => {
                        const v = answers[i]
                        return typeof v === "number" || (typeof v === "string" && v.trim() !== "")
                      }).length < validMcqCount
                    }
                    className="w-full py-2.5 rounded-ga bg-ga-ink text-white text-xs font-bold disabled:opacity-50"
                  >
                    Kiểm tra đáp án
                  </button>
                )}

                {quizSubmitted && score < validMcqCount && (
                  <div className="text-ga-red text-xs font-bold mt-2 text-center">
                    Bạn trả lời đúng {score}/{validMcqCount}. Cần đúng 100% để qua bài!
                    <button 
                      onClick={() => { setQuizSubmitted(false); setAnswers({}); }}
                      className="ml-3 text-ga-blue underline"
                    >
                      Làm lại
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ga-subtle">Chưa có câu hỏi cho bài đọc này.</p>
            )}

            {/* ── Completion Button ── */}
            <div className="pt-4 border-t border-ga-line mt-4">
              {(!validMcqCount || (quizSubmitted && score === validMcqCount)) ? (
                <button
                  onClick={() => markTabCompleted("reading")}
                  disabled={isCompleted}
                  className={`w-full py-3 rounded-ga font-bold text-sm transition-colors ${
                    isCompleted 
                      ? "bg-ga-green text-white" 
                      : "bg-ga-green hover:bg-ga-green text-white"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <CircleCheck size={15} aria-hidden />
                    {isCompleted ? "Đã hoàn thành 100%" : "Đã đọc & Hiểu (100%)"}
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)} />
          <TranslateTooltip
            vocab={tooltip.vocab}
            position={tooltip.pos}
            onClose={() => setTooltip(null)}
            onSaveFlashcard={handleSaveFlashcard}
            isSaved={savedFlashcards.has(tooltip.vocab.id)}
            saveError={saveError}
          />
        </>
      )}
    </div>
  );
}
