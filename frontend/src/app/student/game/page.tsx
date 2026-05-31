"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Heart, Trophy, ChevronLeft, Loader2 } from "lucide-react";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WordItem {
  id: string;
  word: string;
  colorIdx: number;
}

interface Question {
  id: number;
  category: string;
  level: string;
  parts: string[];
  answers: string[];
  pool: WordItem[];
  explanation: string;
  translation: string;
  hint: string;
}

type FeedbackState = null | "correct" | "incorrect";

interface DragData {
  wordId: string;
  word: string;
  colorIdx: number;
}

const BLOCK_COLORS = [
  { bg: "#FFCD00", shadow: "#C9A200", text: "#1A1A1A", shine: "#FFD940" },
  { bg: "#4A90E2", shadow: "#2C6BA8", text: "#FFFFFF", shine: "#6AAAF7" },
  { bg: "#7C4DFF", shadow: "#5A2ED4", text: "#FFFFFF", shine: "#9C6DFF" },
  { bg: "#FF7043", shadow: "#D94F2A", text: "#FFFFFF", shine: "#FF9063" },
];

interface RawExercise {
  id: number;
  exercise_type: string;
  difficulty: number;
  question_json: string;
}

interface ParsedQ {
  prompt: string;
  options?: string[];
  correct_answer: string;
  explanation_vi?: string;
}

function rawToQuestion(ex: RawExercise, catLabel: string): Question | null {
  try {
    const parsed: ParsedQ =
      typeof ex.question_json === "string"
        ? JSON.parse(ex.question_json)
        : (ex.question_json as unknown as ParsedQ);

    const prompt: string = parsed.prompt ?? "";
    const correct: string = parsed.correct_answer ?? "";
    if (!prompt || !correct) return null;

    const BLANK = /_{2,}|\.\.\.|___/;
    const parts = prompt.split(BLANK);
    if (parts.length < 2) return null;

    const optionWords: string[] = parsed.options
      ? parsed.options.filter((o) => typeof o === "string" && o.trim())
      : [correct, "der", "die", "das", "ein"].filter((o) => o !== correct);

    if (!optionWords.includes(correct)) optionWords.unshift(correct);

    const shuffled = [...optionWords].sort(() => Math.random() - 0.5);
    const pool: WordItem[] = shuffled.map((w, i) => ({
      id: `${ex.id}_${i}`,
      word: w,
      colorIdx: i % BLOCK_COLORS.length,
    }));

    return {
      id: ex.id,
      category: catLabel,
      level:
        ex.difficulty === 1 ? "A1" : ex.difficulty === 2 ? "A2" : "B1",
      parts,
      answers: [correct],
      pool,
      explanation: parsed.explanation_vi ?? "",
      translation: "",
      hint: "",
    };
  } catch {
    return null;
  }
}

// ─── LegoBlock (draggable) ────────────────────────────────────────────────────

function LegoBlock({
  item,
  isUsed,
}: {
  item: WordItem;
  isUsed: boolean;
}) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { wordId: item.id, word: item.word, colorIdx: item.colorIdx } satisfies DragData,
    disabled: isUsed,
  });

  if (isUsed) {
    return (
      <div className="px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 opacity-40 min-w-[72px] text-center">
        <span className="text-sm font-bold text-slate-400">{item.word}</span>
      </div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="relative cursor-grab active:cursor-grabbing px-5 py-2.5 rounded-xl font-bold shadow-lg touch-none"
      style={{
        background: color.bg,
        boxShadow: `0 6px 0 0 ${color.shadow}`,
        opacity: isDragging ? 0.4 : 1,
      }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 2 }}
    >
      <span style={{ color: color.text }}>{item.word}</span>
    </motion.div>
  );
}

// ─── FloatingBlock (drag overlay) ────────────────────────────────────────────

function FloatingBlock({ item }: { item: WordItem }) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length];
  return (
    <div
      className="px-5 py-2.5 rounded-xl font-bold shadow-2xl cursor-grabbing scale-105"
      style={{ background: color.bg, boxShadow: `0 6px 0 0 ${color.shadow}` }}
    >
      <span style={{ color: color.text }}>{item.word}</span>
    </div>
  );
}

// ─── DropSlot ─────────────────────────────────────────────────────────────────

function DropSlot({
  slotIdx,
  filledWord,
  filledColorIdx,
  onRemove,
  feedbackState,
  correctAnswer,
}: {
  slotIdx: number;
  filledWord: string | null;
  filledColorIdx: number | null;
  onRemove: (slotIdx: number) => void;
  feedbackState: FeedbackState;
  correctAnswer: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIdx}` });

  if (filledWord) {
    const color =
      BLOCK_COLORS[(filledColorIdx ?? 0) % BLOCK_COLORS.length];
    const isCorrect =
      feedbackState !== null && filledWord === correctAnswer;
    return (
      <span className="inline-flex items-center mx-1.5 my-1">
        <span
          onClick={() => feedbackState === null && onRemove(slotIdx)}
          className="px-4 py-2 rounded-xl font-bold text-white shadow-md cursor-pointer"
          style={{
            background:
              feedbackState === null
                ? color.bg
                : isCorrect
                ? "#10B981"
                : "#EF4444",
            boxShadow: `0 4px 0 0 ${
              feedbackState === null
                ? color.shadow
                : isCorrect
                ? "#059669"
                : "#B91C1C"
            }`,
          }}
        >
          {filledWord} {feedbackState === null && "×"}
        </span>
      </span>
    );
  }

  return (
    <span
      ref={setNodeRef}
      className={`inline-flex items-center justify-center mx-1.5 my-1 min-w-[90px] h-11 rounded-xl border-2 border-dashed transition-colors ${
        isOver
          ? "bg-yellow-50 border-yellow-400"
          : "bg-slate-50 border-slate-300"
      }`}
    >
      <span className="text-slate-300 text-xs font-bold">_ _ _</span>
    </span>
  );
}

// ─── GameContent ──────────────────────────────────────────────────────────────

function GameContent() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [slotColorIdxs, setSlotColorIdxs] = useState<(number | null)[]>([]);
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [activeItem, setActiveItem] = useState<WordItem | null>(null);

  const resetSlots = useCallback((answerCount: number) => {
    setSlots(Array(answerCount).fill(null));
    setSlotColorIdxs(Array(answerCount).fill(null));
    setSlotWordIds(Array(answerCount).fill(null));
    setUsedWordIds(new Set());
    setFeedback(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingQ(true);
      try {
        const topicsRes = await api.get<{ id: number; title_de: string }[]>(
          "/grammar/syllabus/topics?cefrLevel=A1"
        );
        const topics = topicsRes.data ?? [];
        const allQ: Question[] = [];
        for (const topic of topics.slice(0, 4)) {
          const exRes = await api.get<RawExercise[]>(
            `/grammar/syllabus/topics/${topic.id}/exercises?limit=5`
          );
          const mapped = (exRes.data ?? [])
            .filter(
              (e) =>
                e.exercise_type === "FILL_BLANK" ||
                e.exercise_type === "MULTIPLE_CHOICE"
            )
            .map((e) => rawToQuestion(e, topic.title_de))
            .filter((q): q is Question => q !== null);
          allQ.push(...mapped);
        }
        if (cancelled) return;
        const deck = allQ.sort(() => Math.random() - 0.5).slice(0, 10);
        setQuestions(deck);
        if (deck.length > 0) resetSlots(deck[0].answers.length);
      } catch {
        // will show empty state
      } finally {
        if (!cancelled) setLoadingQ(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [resetSlots]);

  const q = questions[questionIdx];
  const allFilled = slots.length > 0 && slots.every((s) => s !== null);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    const item = q?.pool.find((p) => p.id === data.wordId) ?? null;
    setActiveItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const slotId = over.id as string;
    if (!slotId.startsWith("slot-")) return;
    const slotIdx = parseInt(slotId.replace("slot-", ""), 10);

    const data = active.data.current as DragData | undefined;
    if (!data) return;
    if (usedWordIds.has(data.wordId)) return;

    setSlots((prev) => {
      const n = [...prev];
      n[slotIdx] = data.word;
      return n;
    });
    setSlotColorIdxs((prev) => {
      const n = [...prev];
      n[slotIdx] = data.colorIdx;
      return n;
    });
    setSlotWordIds((prev) => {
      const n = [...prev];
      n[slotIdx] = data.wordId;
      return n;
    });
    setUsedWordIds((prev) => {
      const n = new Set(prev);
      n.add(data.wordId);
      return n;
    });
  };

  const handleRemove = (slotIdx: number) => {
    const wordId = slotWordIds[slotIdx];
    if (wordId)
      setUsedWordIds((prev) => {
        const n = new Set(prev);
        n.delete(wordId);
        return n;
      });
    setSlots((prev) => {
      const n = [...prev];
      n[slotIdx] = null;
      return n;
    });
    setSlotColorIdxs((prev) => {
      const n = [...prev];
      n[slotIdx] = null;
      return n;
    });
    setSlotWordIds((prev) => {
      const n = [...prev];
      n[slotIdx] = null;
      return n;
    });
  };

  const handleCheck = () => {
    if (!q) return;
    const correct = slots.every(
      (s, i) => s?.toLowerCase() === q.answers[i]?.toLowerCase()
    );
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore((s) => s + 1);
    else setLives((l) => l - 1);
  };

  const handleNext = () => {
    const nextIdx = questionIdx + 1;
    if (nextIdx < questions.length) {
      setQuestionIdx(nextIdx);
      resetSlots(questions[nextIdx].answers.length);
    } else {
      setCompleted(true);
    }
  };

  if (loadingQ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#FFCD00]" />
      </div>
    );
  }

  if (completed || !q) {
    return (
      <div className="p-10 text-center">
        <Trophy size={64} className="mx-auto text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold">
          Fertig! {score}/{questions.length}
        </h2>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-6 py-3 bg-[#121212] text-white rounded-xl font-bold"
        >
          Dashboard
        </button>
      </div>
    );
  }

  const progress =
    (questionIdx / Math.max(questions.length, 1)) * 100;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b p-4 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")}>
            <ChevronLeft />
          </button>
          <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                size={18}
                fill={i < lives ? "red" : "none"}
                className={i < lives ? "text-red-500" : "text-slate-200"}
              />
            ))}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-xl mx-auto w-full">
          <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">
            {q.category} · {q.level}
          </p>

          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-slate-100 mb-8">
            <p className="text-2xl leading-loose">
              {q.parts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < q.parts.length - 1 && (
                    <DropSlot
                      slotIdx={i}
                      filledWord={slots[i]}
                      filledColorIdx={slotColorIdxs[i]}
                      onRemove={handleRemove}
                      feedbackState={feedback}
                      correctAnswer={q.answers[i]}
                    />
                  )}
                </span>
              ))}
            </p>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl p-4 mb-6 text-sm font-medium ${
                  feedback === "correct"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {feedback === "correct"
                  ? "✓ Chính xác!"
                  : `✗ Đáp án đúng: ${q.answers.join(", ")}`}
                {q.explanation && (
                  <p className="mt-1 text-xs opacity-80">{q.explanation}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-slate-100 rounded-2xl p-6 mb-8 flex flex-wrap gap-3">
            {q.pool.map((item) => (
              <LegoBlock
                key={item.id}
                item={item}
                isUsed={usedWordIds.has(item.id)}
              />
            ))}
          </div>

          <button
            onClick={feedback ? handleNext : handleCheck}
            disabled={!allFilled && !feedback}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-transform active:scale-95 ${
              allFilled || feedback
                ? "bg-[#121212] text-white"
                : "bg-slate-200 text-slate-400"
            }`}
          >
            {feedback ? "Weiter →" : "Prüfen"}
          </button>
        </main>
      </div>

      <DragOverlay>
        {activeItem ? <FloatingBlock item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function GamePage() {
  usePageTimeTracker("game");
  return <GameContent />;
}
