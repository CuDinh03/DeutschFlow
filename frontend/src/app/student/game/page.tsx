"use client";

import { useState, useCallback } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  X,
  Flame,
  Lightbulb,
  Heart,
  ArrowRight,
  Check,
  Volume2,
  Trophy,
  RotateCcw,
  Star,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";

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

const ITEM_TYPE = "LEGO_WORD";

const BLOCK_COLORS = [
  { bg: "#FFCE00", shadow: "#C9A200", text: "#1A1A1A", shine: "#FFD940" },
  { bg: "#4A90E2", shadow: "#2C6BA8", text: "#FFFFFF", shine: "#6AAAF7" },
  { bg: "#7C4DFF", shadow: "#5A2ED4", text: "#FFFFFF", shine: "#9C6DFF" },
  { bg: "#FF7043", shadow: "#D94F2A", text: "#FFFFFF", shine: "#FF9063" },
];

const QUESTIONS: Question[] = [
  {
    id: 1,
    category: "IT-Technologie",
    level: "A2",
    parts: ["Ich ", " heute ", " ."],
    answers: ["schreibe", "Code"],
    pool: [
      { id: "q1w1", word: "schreibe", colorIdx: 1 },
      { id: "q1w2", word: "Code", colorIdx: 0 },
      { id: "q1w3", word: "lese", colorIdx: 3 },
      { id: "q1w4", word: "einen", colorIdx: 2 },
    ],
    explanation: '"schreiben" -> "schreibe" fuer ich. "Code" ist maskulin.',
    translation: "I write code today.",
    hint: 'Verb an 2. Stelle.',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function LegoBlock({ item, isUsed, isSelected, onClick }: { item: WordItem; isUsed: boolean; isSelected: boolean; onClick: () => void }) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length];
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { wordId: item.id, word: item.word, colorIdx: item.colorIdx },
    canDrag: !isUsed,
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  if (isUsed) return <div className="px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 opacity-40 min-w-[72px] text-center"><span className="text-sm font-bold text-slate-400">{item.word}</span></div>;

  return (
    <motion.div
      ref={drag as any}
      onClick={onClick}
      className="relative cursor-grab active:cursor-grabbing px-5 py-2.5 rounded-xl font-bold text-white shadow-lg"
      style={{ background: color.bg, boxShadow: `0 6px 0 0 ${color.shadow}`, border: isSelected ? "3px solid white" : "none" }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 2 }}
    >
      <span style={{ color: color.text }}>{item.word}</span>
    </motion.div>
  );
}

function DropSlot({ slotIdx, filledWord, filledColorIdx, onDrop, onRemove, feedbackState, correctAnswer }: any) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item: any) => onDrop(slotIdx, item.wordId, item.word, item.colorIdx),
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  });

  if (filledWord) {
    const color = BLOCK_COLORS[(filledColorIdx ?? 0) % BLOCK_COLORS.length];
    const isCorrect = feedbackState !== null && filledWord === correctAnswer;
    return (
      <span className="inline-flex items-center mx-1.5 my-1">
        <span onClick={() => feedbackState === null && onRemove(slotIdx)} className="px-4 py-2 rounded-xl font-bold text-white shadow-md cursor-pointer" style={{ background: feedbackState === null ? color.bg : (isCorrect ? "#10B981" : "#EF4444"), boxShadow: `0 4px 0 0 ${feedbackState === null ? color.shadow : (isCorrect ? "#059669" : "#B91C1C")}` }}>
          {filledWord} {feedbackState === null && "×"}
        </span>
      </span>
    );
  }

  return (
    <span ref={drop as any} className={`inline-flex items-center justify-center mx-1.5 my-1 min-w-[90px] h-11 rounded-xl border-2 border-dashed transition-colors ${isOver ? "bg-yellow-50 border-yellow-400" : "bg-slate-50 border-slate-300"}`}>
      <span className="text-slate-300 text-xs font-bold">_ _ _</span>
    </span>
  );
}

function GameContent() {
  const router = useRouter();
  const [questionIdx, setQuestionIdx] = useState(0);
  const [slots, setSlots] = useState<(string | null)[]>([null, null]);
  const [slotColorIdxs, setSlotColorIdxs] = useState<(number | null)[]>([null, null]);
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([null, null]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const q = QUESTIONS[questionIdx];
  const allFilled = slots.every((s) => s !== null);

  const handleDrop = (slotIdx: number, wordId: string, word: string, colorIdx: number) => {
    if (usedWordIds.has(wordId)) return;
    const newSlots = [...slots]; newSlots[slotIdx] = word; setSlots(newSlots);
    const newColors = [...slotColorIdxs]; newColors[slotIdx] = colorIdx; setSlotColorIdxs(newColors);
    const newIds = [...slotWordIds]; newIds[slotIdx] = wordId; setSlotWordIds(newIds);
    setUsedWordIds(new Set(Array.from(usedWordIds).concat(wordId)));
  };

  const handleRemove = (slotIdx: number) => {
    const wordId = slotWordIds[slotIdx];
    if (wordId) { const next = new Set(Array.from(usedWordIds)); next.delete(wordId); setUsedWordIds(next); }
    const newSlots = [...slots]; newSlots[slotIdx] = null; setSlots(newSlots);
    const newColors = [...slotColorIdxs]; newColors[slotIdx] = null; setSlotColorIdxs(newColors);
    const newIds = [...slotWordIds]; newIds[slotIdx] = null; setSlotWordIds(newIds);
  };

  const handleCheck = () => {
    const correct = slots.every((s, i) => s === q.answers[i]);
    setFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore(s => s + 1); else setLives(l => l - 1);
  };

  if (completed) return <div className="p-10 text-center"><Trophy size={64} className="mx-auto text-yellow-500 mb-4" /><h2 className="text-2xl font-bold">Fertig!</h2><button onClick={() => router.push("/dashboard")} className="mt-6 px-6 py-3 bg-[#00305E] text-white rounded-xl font-bold">Dashboard</button></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <header className="bg-white border-b p-4 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")}><ChevronLeft /></button>
          <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-yellow-400" style={{ width: "50%" }} /></div>
          <div className="flex gap-1">{[0, 1, 2].map(i => <Heart key={i} size={18} fill={i < lives ? "red" : "none"} className={i < lives ? "text-red-500" : "text-slate-200"} />)}</div>
       </header>

       <main className="flex-1 p-6 max-w-xl mx-auto w-full">
          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-slate-100 mb-8">
             <p className="text-2xl leading-loose">
                {q.parts.map((part, i) => (
                  <span key={i}>
                    {part}
                    {i < q.parts.length - 1 && <DropSlot slotIdx={i} filledWord={slots[i]} filledColorIdx={slotColorIdxs[i]} onDrop={handleDrop} onRemove={handleRemove} feedbackState={feedback} correctAnswer={q.answers[i]} />}
                  </span>
                ))}
             </p>
          </div>

          <div className="bg-slate-100 rounded-2xl p-6 mb-8 flex flex-wrap gap-3">
             {q.pool.map(item => <LegoBlock key={item.id} item={item} isUsed={usedWordIds.has(item.id)} isSelected={false} onClick={() => {}} />)}
          </div>

          <button onClick={feedback ? () => { if (questionIdx + 1 < QUESTIONS.length) { setQuestionIdx(v => v + 1); setFeedback(null); setSlots([null, null]); setUsedWordIds(new Set()); } else setCompleted(true); } : handleCheck} disabled={!allFilled && !feedback} className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-transform active:scale-95 ${allFilled || feedback ? "bg-[#00305E] text-white" : "bg-slate-200 text-slate-400"}`}>
             {feedback ? "Weiter" : "Prüfen"}
          </button>
       </main>
    </div>
  );
}

export default function GamePage() {
  return (
    <DndProvider backend={HTML5Backend}>
      <GameContent />
    </DndProvider>
  );
}
