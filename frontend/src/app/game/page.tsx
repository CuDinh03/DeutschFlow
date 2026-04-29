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
  parts: string[]; // sentence fragments; blanks go between parts
  answers: string[]; // correct answer for each blank
  pool: WordItem[];
  explanation: string;
  translation: string;
  hint: string;
}

type FeedbackState = null | "correct" | "incorrect";

const ITEM_TYPE = "LEGO_WORD";

// ─── Block colour palette ────────────────────────────────────────────────────

const BLOCK_COLORS = [
  { bg: "#FFCE00", shadow: "#C9A200", text: "#1A1A1A", shine: "#FFD940" },
  { bg: "#4A90E2", shadow: "#2C6BA8", text: "#FFFFFF", shine: "#6AAAF7" },
  { bg: "#7C4DFF", shadow: "#5A2ED4", text: "#FFFFFF", shine: "#9C6DFF" },
  { bg: "#FF7043", shadow: "#D94F2A", text: "#FFFFFF", shine: "#FF9063" },
  { bg: "#00BCD4", shadow: "#008FA0", text: "#FFFFFF", shine: "#20DCF4" },
  { bg: "#4CAF50", shadow: "#2E8B32", text: "#FFFFFF", shine: "#6CCF70" },
  { bg: "#EC407A", shadow: "#B0003A", text: "#FFFFFF", shine: "#FC609A" },
  { bg: "#FF9800", shadow: "#D47000", text: "#FFFFFF", shine: "#FFB820" },
];

// ─── Questions ───────────────────────────────────────────────────────────────

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
      { id: "q1w4", word: "einen", colorIdx: 4 },
      { id: "q1w5", word: "teste", colorIdx: 2 },
      { id: "q1w6", word: "laufe", colorIdx: 5 },
    ],
    explanation:
      '"schreiben" -> "schreibe" fuer ich (1. Person Singular). "Code" ist ein Maskulinum im Deutschen.',
    translation: "I write code today.",
    hint: 'Das Verb steht an 2. Stelle. Wie konjugiert man "schreiben" mit "ich"?',
  },
  {
    id: 2,
    category: "IT-Technologie",
    level: "A2",
    parts: ["Das ", " läuft ohne ", " ."],
    answers: ["Programm", "Fehler"],
    pool: [
      { id: "q2w1", word: "Programm", colorIdx: 0 },
      { id: "q2w2", word: "Fehler", colorIdx: 2 },
      { id: "q2w3", word: "Code", colorIdx: 1 },
      { id: "q2w4", word: "Problem", colorIdx: 3 },
      { id: "q2w5", word: "System", colorIdx: 4 },
      { id: "q2w6", word: "Bugs", colorIdx: 5 },
    ],
    explanation:
      '"Programm" ist neutral (das Programm). "Fehler" (Plural unveraendert) - typisches IT-Vokabular!',
    translation: "The program runs without errors.",
    hint: 'Welches Wort ist neutral (das _____)? Ohne was laeuft ein perfektes Programm?',
  },
  {
    id: 3,
    category: "IT-Technologie",
    level: "A2",
    parts: ["Wir ", " die neue ", " gemeinsam."],
    answers: ["testen", "Software"],
    pool: [
      { id: "q3w1", word: "testen", colorIdx: 3 },
      { id: "q3w2", word: "Software", colorIdx: 0 },
      { id: "q3w3", word: "schreiben", colorIdx: 1 },
      { id: "q3w4", word: "Hardware", colorIdx: 2 },
      { id: "q3w5", word: "nutzen", colorIdx: 4 },
      { id: "q3w6", word: "Daten", colorIdx: 5 },
    ],
    explanation:
      '"testen" bleibt im Infinitiv nach "wir" unveraendert. "Software" ist feminin (die Software).',
    translation: "We test the new software together.",
    hint: 'Wie bleibt das Verb mit "wir"? Was testet ein Entwicklungsteam?',
  },
  {
    id: 4,
    category: "IT-Technologie",
    level: "B1",
    parts: ["Der ", " speichert alle ", " in der Cloud."],
    answers: ["Server", "Daten"],
    pool: [
      { id: "q4w1", word: "Server", colorIdx: 1 },
      { id: "q4w2", word: "Daten", colorIdx: 0 },
      { id: "q4w3", word: "Computer", colorIdx: 3 },
      { id: "q4w4", word: "Dateien", colorIdx: 2 },
      { id: "q4w5", word: "Router", colorIdx: 4 },
      { id: "q4w6", word: "Bits", colorIdx: 5 },
    ],
    explanation:
      '"Server" ist maskulin (der Server). "Daten" ist stets Plural im Deutschen - ein wichtiger Unterschied zum Englischen.',
    translation: "The server stores all data in the cloud.",
    hint: 'Was speichert Informationen in der IT? Wie sagt man "data" auf Deutsch (Plural)?',
  },
];

// ─── Lego Block ───────────────────────────────────────────────────────────────

function LegoBlock({
  item,
  isUsed,
  isSelected,
  onClick,
}: {
  item: WordItem;
  isUsed: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = BLOCK_COLORS[item.colorIdx % BLOCK_COLORS.length];

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { wordId: item.id, word: item.word },
    canDrag: !isUsed,
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  if (isUsed) {
    return (
      <div
        className="px-4 py-2.5 rounded-[12px] border-2 border-dashed border-[#E2E8F0] bg-white/60"
        style={{ minWidth: 72, textAlign: "center", opacity: 0.4 }}
      >
        <span
          className="text-sm font-bold"
          style={{ color: "#94A3B8", letterSpacing: "0.04em" }}
        >
          {item.word}
        </span>
      </div>
    );
  }

  const pressed = isDragging || isSelected;

  return (
    <motion.div
      ref={drag as any}
      onClick={onClick}
      className="relative select-none cursor-grab active:cursor-grabbing"
      whileHover={{ y: -2 }}
      animate={{ y: pressed ? 4 : 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      style={{
        background: color.bg,
        boxShadow: pressed
          ? `0 2px 0 0 ${color.shadow}, 0 4px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.35)`
          : `0 6px 0 0 ${color.shadow}, 0 8px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.35)`,
        borderRadius: 12,
        padding: "10px 20px",
        outline: isSelected ? `3px solid rgba(255,255,255,0.9)` : "none",
        outlineOffset: 2,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      {/* Top shine line */}
      <div
        className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
        style={{ background: `${color.shine}80` }}
      />
      <span
        className="font-bold text-[15px] tracking-wide"
        style={{ color: color.text }}
      >
        {item.word}
      </span>
    </motion.div>
  );
}

// ─── Drop Slot ────────────────────────────────────────────────────────────────

function DropSlot({
  slotIdx,
  filledWord,
  filledColorIdx,
  onDrop,
  onRemove,
  onClickEmpty,
  hasSelection,
  feedbackState,
  correctAnswer,
}: {
  slotIdx: number;
  filledWord: string | null;
  filledColorIdx: number | null;
  onDrop: (slotIdx: number, wordId: string, word: string, colorIdx: number) => void;
  onRemove: (slotIdx: number) => void;
  onClickEmpty: (slotIdx: number) => void;
  hasSelection: boolean;
  feedbackState: FeedbackState;
  correctAnswer: string;
}) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (dragItem: { wordId: string; word: string; colorIdx: number }) =>
      onDrop(slotIdx, dragItem.wordId, dragItem.word, dragItem.colorIdx ?? 0),
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  });

  const isCorrect = feedbackState !== null && filledWord === correctAnswer;
  const isWrong = feedbackState !== null && filledWord !== null && filledWord !== correctAnswer;

  if (filledWord) {
    const color = BLOCK_COLORS[(filledColorIdx ?? 0) % BLOCK_COLORS.length];

    return (
      <motion.span
        className="inline-flex items-center mx-1.5 my-1 cursor-pointer"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      >
        <span
          onClick={() => feedbackState === null && onRemove(slotIdx)}
          className="relative px-4 py-2 rounded-[12px] font-bold text-base select-none"
          style={{
            background: feedbackState === null
              ? color.bg
              : isCorrect
                ? "#10B981"
                : "#FF4B4B",
            boxShadow: feedbackState === null
              ? `0 5px 0 0 ${color.shadow}, 0 7px 16px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.3)`
              : isCorrect
                ? "0 5px 0 0 #059669, 0 7px 16px rgba(16,185,129,0.3)"
                : "0 5px 0 0 #C9241C, 0 7px 16px rgba(255,75,75,0.3)",
            color: feedbackState === null ? color.text : "#FFFFFF",
            transition: "all 0.3s ease",
          }}
        >
          <div
            className="absolute top-0 left-3 right-3 h-[2px] rounded-full"
            style={{
              background: feedbackState === null
                ? `${color.shine}80`
                : isCorrect
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.25)",
            }}
          />
          {filledWord}
          {feedbackState === null && (
            <span className="ml-1.5 text-xs opacity-60">×</span>
          )}
          {isCorrect && <Check size={14} className="ml-1.5 inline" strokeWidth={3} />}
          {isWrong && <X size={14} className="ml-1.5 inline" />}
        </span>
      </motion.span>
    );
  }

  return (
    <span
      ref={drop as any}
      onClick={() => onClickEmpty(slotIdx)}
      className="inline-flex items-center justify-center mx-1.5 my-1 cursor-pointer select-none transition-all duration-200"
      style={{
        minWidth: 90,
        height: 44,
        borderRadius: 12,
        border: `2px dashed ${isOver && canDrop ? "#FFCE00" : hasSelection ? "#4A90E2" : "#CBD5E1"}`,
        background: isOver && canDrop
          ? "rgba(255,206,0,0.12)"
          : hasSelection
            ? "rgba(74,144,226,0.07)"
            : "#F8FAFF",
        boxShadow: isOver && canDrop ? "0 0 0 3px rgba(255,206,0,0.3)" : "none",
        transform: isOver ? "scale(1.04)" : "scale(1)",
        verticalAlign: "middle",
      }}
    >
      <span
        className="text-xs font-semibold tracking-widest"
        style={{ color: isOver ? "#B8960A" : hasSelection ? "#4A90E2" : "#CBD5E1" }}
      >
        {isOver ? "+" : "_ _ _"}
      </span>
    </span>
  );
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────

function FeedbackModal({
  state,
  question,
  slots,
  onContinue,
  onReview,
}: {
  state: FeedbackState;
  question: Question;
  slots: (string | null)[];
  onContinue: () => void;
  onReview: () => void;
}) {
  if (!state) return null;
  const correct = state === "correct";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(0,48,94,0.55)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Card */}
      <motion.div
        className="relative bg-white rounded-[24px] w-full max-w-md overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(0,48,94,0.22)" }}
        initial={{ scale: 0.88, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 32 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        {/* Top stripe */}
        <div
          className="h-2 w-full"
          style={{ background: correct ? "#10B981" : "#FF4B4B" }}
        />

        <div className="px-7 py-7">
          {/* Animated icon */}
          <div className="flex justify-center mb-5">
            <motion.div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: correct
                  ? "linear-gradient(135deg, #34D399, #10B981)"
                  : "linear-gradient(135deg, #FF6B6B, #FF4B4B)",
                boxShadow: correct
                  ? "0 8px 0 0 #059669, 0 12px 32px rgba(16,185,129,0.35)"
                  : "0 8px 0 0 #C9241C, 0 12px 32px rgba(255,75,75,0.35)",
              }}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
            >
              {correct ? (
                <Check size={40} className="text-white" strokeWidth={3} />
              ) : (
                <X size={36} className="text-white" strokeWidth={3} />
              )}
            </motion.div>
          </div>

          {/* Headline */}
          <motion.h2
            className="text-center text-2xl mb-1"
            style={{ color: correct ? "#065F46" : "#991B1B" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            {correct ? "Richtig! 🎉" : "Nicht ganz…"}
          </motion.h2>
          <motion.p
            className="text-center text-sm mb-5"
            style={{ color: "#64748B" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
          >
            {correct ? "Sehr gut gemacht!" : `Richtig wäre: "${question.answers.join('" & "')}"`}
          </motion.p>

          {/* Full sentence */}
          <motion.div
            className="rounded-[16px] p-4 mb-4"
            style={{ background: "#F8FAFF", border: "1.5px solid #E2E8F0" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "#94A3B8", letterSpacing: "0.08em" }}>VOLLSTÄNDIGER SATZ</p>
            <p className="text-lg leading-relaxed" style={{ color: "#1A1A1A" }}>
              {question.parts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < question.parts.length - 1 && (
                    <span
                      className="inline-block px-3 py-0.5 mx-0.5 rounded-[8px] font-bold"
                      style={{
                        background: slots[i] === question.answers[i] ? "#10B981" : "#FF4B4B",
                        color: "#FFFFFF",
                        fontSize: "1rem",
                      }}
                    >
                      {question.answers[i]}
                    </span>
                  )}
                </span>
              ))}
            </p>
            <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
              🇬🇧 {question.translation}
            </p>
          </motion.div>

          {/* Explanation */}
          <motion.div
            className="flex gap-3 rounded-[14px] p-3.5 mb-6"
            style={{ background: correct ? "#ECFDF5" : "#FEF2F2", border: `1.5px solid ${correct ? "#BBF7D0" : "#FECACA"}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.34 }}
          >
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{ background: correct ? "#10B981" : "#FF4B4B" }}
            >
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: correct ? "#065F46" : "#991B1B" }}>
              {question.explanation}
            </p>
          </motion.div>

          {/* Buttons */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <button
              onClick={onReview}
              className="flex-1 py-3 rounded-[14px] font-semibold text-sm transition-colors"
              style={{
                background: "#F5F7FA",
                color: "#64748B",
                border: "2px solid #E2E8F0",
              }}
            >
              Wiederholen
            </button>
            <button
              onClick={onContinue}
              className="flex-[2] py-3 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: correct ? "#10B981" : "#00305E",
                color: "#FFFFFF",
                boxShadow: correct
                  ? "0 5px 0 0 #059669, 0 8px 20px rgba(16,185,129,0.3)"
                  : "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)",
              }}
            >
              Weiter <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── AI Teacher ───────────────────────────────────────────────────────────────

function AITeacher({ onHint, showHint, hintText, onClose }: {
  onHint: () => void;
  showHint: boolean;
  hintText: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-end gap-3">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{
            background: "linear-gradient(145deg, #004080, #00305E)",
            boxShadow: "0 5px 0 0 #001F3F, 0 8px 20px rgba(0,48,94,0.3)",
            border: "3px solid rgba(255,255,255,0.15)",
          }}
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          🤖
        </motion.div>
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: "#FFCE00", border: "2px solid white" }}
        >
          <span className="text-[9px] font-bold text-[#00305E]">AI</span>
        </div>
      </div>

      {/* Hint bubble */}
      <div className="relative flex-1">
        <AnimatePresence>
          {showHint && (
            <motion.div
              className="absolute bottom-full mb-3 left-0 rounded-[16px] p-4 max-w-xs"
              style={{
                background: "#00305E",
                boxShadow: "0 8px 24px rgba(0,48,94,0.25)",
                border: "1.5px solid rgba(255,255,255,0.1)",
              }}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
            >
              <div className="absolute bottom-[-7px] left-5 w-3.5 h-3.5 rotate-45 rounded-sm" style={{ background: "#00305E" }} />
              <div className="flex items-start gap-2">
                <Lightbulb size={14} className="text-[#FFCE00] mt-0.5 flex-shrink-0" fill="#FFCE00" />
                <p className="text-white text-sm leading-snug">{hintText}</p>
              </div>
              <button onClick={onClose} className="mt-2 text-[#FFCE00] text-xs font-semibold hover:underline">
                Schließen ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onHint}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-semibold text-sm transition-all"
          style={{
            background: showHint ? "#FFF8E1" : "white",
            color: showHint ? "#B45309" : "#64748B",
            border: `2px solid ${showHint ? "#FFCE00" : "#E2E8F0"}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Lightbulb
            size={15}
            style={{ color: showHint ? "#FFCE00" : "#94A3B8" }}
            fill={showHint ? "#FFCE00" : "none"}
          />
          Hinweis
        </button>
      </div>
    </div>
  );
}

// ─── Exit Modal ───────────────────────────────────────────────────────────────

function ExitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        className="relative bg-white rounded-[20px] p-7 max-w-sm w-full text-center"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={26} className="text-red-500" />
        </div>
        <h3 className="text-lg text-[#0F172A] mb-2">Spiel verlassen?</h3>
        <p className="text-sm text-[#64748B] mb-6">Dein Fortschritt in dieser Runde geht verloren.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-[12px] bg-[#F5F7FA] text-[#0F172A] font-semibold text-sm border border-[#E2E8F0]">
            Weiterlernen
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-[12px] bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
            Verlassen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Completion Screen ────────────────────────────────────────────────────────

function CompletionScreen({
  score, total, onReplay, onExit,
}: { score: number; total: number; onReplay: () => void; onExit: () => void }) {
  const pct = Math.round((score / total) * 100);
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className="w-28 h-28 rounded-full flex items-center justify-center mb-6 text-5xl"
        style={{
          background: "linear-gradient(145deg, #FFD940, #FFCE00)",
          boxShadow: "0 8px 0 0 #C9A200, 0 12px 40px rgba(255,206,0,0.4)",
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
      >
        🏆
      </motion.div>
      <motion.h2
        className="text-3xl text-[#00305E] mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {pct === 100 ? "Perfekt! 🎉" : pct >= 75 ? "Super! 👏" : "Weiter üben! 💪"}
      </motion.h2>
      <motion.p
        className="text-[#64748B] text-sm mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <strong className="text-[#00305E]">{score}</strong> von <strong className="text-[#00305E]">{total}</strong> Fragen korrekt
      </motion.p>

      <motion.div
        className="flex gap-5 mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {[
          { label: "Genauigkeit", value: `${pct}%`, color: "#00305E" },
          { label: "XP verdient", value: `+${score * 20}`, color: "#FFCE00" },
          { label: "Serie 🔥", value: "14", color: "#F97316" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center bg-white rounded-[16px] px-5 py-4 min-w-[90px]"
            style={{ boxShadow: "0 4px 16px rgba(0,48,94,0.1)", border: "1.5px solid #E2E8F0" }}
          >
            <span className="text-2xl font-extrabold mb-1" style={{ color }}>{value}</span>
            <span className="text-[#94A3B8] text-xs">{label}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="flex gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <button
          onClick={onReplay}
          className="flex items-center gap-2 px-5 py-3 rounded-[14px] font-semibold text-sm transition-colors"
          style={{ background: "#F5F7FA", color: "#00305E", border: "2px solid #E2E8F0" }}
        >
          <RotateCcw size={15} /> Nochmal spielen
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-7 py-3 rounded-[14px] font-bold text-sm transition-colors"
          style={{
            background: "#00305E",
            color: "white",
            boxShadow: "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)",
          }}
        >
          Zur Karte <ArrowRight size={15} />
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Game Content (inner, wrapped by DndProvider) ─────────────────────────────

function GameContent() {
  const router = useRouter();
  const [questionIdx, setQuestionIdx] = useState(0);
  const [slots, setSlots] = useState<(string | null)[]>([null, null]);
  const [slotColorIdxs, setSlotColorIdxs] = useState<(number | null)[]>([null, null]);
  const [slotWordIds, setSlotWordIds] = useState<(string | null)[]>([null, null]);
  const [usedWordIds, setUsedWordIds] = useState<Set<string>>(new Set());
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showHint, setShowHint] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [showExit, setShowExit] = useState(false);
  const [completed, setCompleted] = useState(false);

  const q = QUESTIONS[questionIdx];
  const progressPct = (questionIdx / QUESTIONS.length) * 100;
  const allFilled = slots.every((s) => s !== null);

  const resetQuestion = useCallback(() => {
    setSlots(new Array(q.answers.length).fill(null));
    setSlotColorIdxs(new Array(q.answers.length).fill(null));
    setSlotWordIds(new Array(q.answers.length).fill(null));
    setUsedWordIds(new Set());
    setSelectedWordId(null);
    setFeedback(null);
    setShowHint(false);
  }, [q]);

  const goToQuestion = useCallback((idx: number) => {
    setQuestionIdx(idx);
    const nextQ = QUESTIONS[idx];
    setSlots(new Array(nextQ.answers.length).fill(null));
    setSlotColorIdxs(new Array(nextQ.answers.length).fill(null));
    setSlotWordIds(new Array(nextQ.answers.length).fill(null));
    setUsedWordIds(new Set());
    setSelectedWordId(null);
    setFeedback(null);
    setShowHint(false);
  }, []);

  const placeWord = useCallback((slotIdx: number, wordId: string, word: string, colorIdx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      // If slot already filled, return that word to pool
      const oldWordId = slotWordIds[slotIdx];
      if (oldWordId) {
        setUsedWordIds((u) => { const s = new Set(u); s.delete(oldWordId); return s; });
      }
      next[slotIdx] = word;
      return next;
    });
    setSlotColorIdxs((prev) => { const n = [...prev]; n[slotIdx] = colorIdx; return n; });
    setSlotWordIds((prev) => { const n = [...prev]; n[slotIdx] = wordId; return n; });
    setUsedWordIds((u) => { const newSet = new Set(u); newSet.add(wordId); return newSet; });
    setSelectedWordId(null);
  }, [slotWordIds]);

  const removeWord = useCallback((slotIdx: number) => {
    const oldWordId = slotWordIds[slotIdx];
    if (oldWordId) setUsedWordIds((u) => { const s = new Set(u); s.delete(oldWordId); return s; });
    setSlots((prev) => { const n = [...prev]; n[slotIdx] = null; return n; });
    setSlotColorIdxs((prev) => { const n = [...prev]; n[slotIdx] = null; return n; });
    setSlotWordIds((prev) => { const n = [...prev]; n[slotIdx] = null; return n; });
  }, [slotWordIds]);

  const handleCheck = () => {
    const allCorrect = slots.every((s, i) => s === q.answers[i]);
    setFeedback(allCorrect ? "correct" : "incorrect");
    if (allCorrect) setScore((s) => s + 1);
    else setLives((l) => Math.max(0, l - 1));
  };

  const handleContinue = () => {
    if (questionIdx + 1 >= QUESTIONS.length) {
      setCompleted(true);
    } else {
      goToQuestion(questionIdx + 1);
    }
  };

  const handleReview = () => {
    setFeedback(null);
    resetQuestion();
  };

  const handleWordClick = (item: WordItem) => {
    if (usedWordIds.has(item.id)) return;
    setSelectedWordId((prev) => (prev === item.id ? null : item.id));
  };

  const handleSlotClickEmpty = (slotIdx: number) => {
    if (selectedWordId) {
      const wordItem = q.pool.find((w) => w.id === selectedWordId);
      if (!wordItem) return;
      placeWord(slotIdx, wordItem.id, wordItem.word, wordItem.colorIdx);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#F8FAFF",
        backgroundImage: "radial-gradient(circle, rgba(0,48,94,0.045) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/90 backdrop-blur border-b border-[#E2E8F0] px-5 py-4 flex items-center gap-4 flex-shrink-0" style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.07)" }}>
        <button
          onClick={() => setShowExit(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#0F172A] transition-colors font-medium text-sm"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Verlassen</span>
        </button>

        {/* Segmented progress */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex gap-1.5">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-2.5 rounded-full transition-all duration-500"
                style={{
                  background: i < questionIdx
                    ? "#FFCE00"
                    : i === questionIdx
                      ? "linear-gradient(90deg, #FFCE00 0%, #E2E8F0 100%)"
                      : "#E2E8F0",
                  boxShadow: i <= questionIdx ? "0 1px 4px rgba(255,206,0,0.35)" : "none",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8] text-xs">Frage {questionIdx + 1}/{QUESTIONS.length}</span>
            <span className="text-[#00305E] text-xs font-semibold">{Math.round(progressPct)}%</span>
          </div>
        </div>

        {/* Score */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
          style={{ background: "#FFF8E1", border: "1.5px solid rgba(255,206,0,0.4)" }}
        >
          <Star size={14} fill="#FFCE00" className="text-[#FFCE00]" />
          <span className="font-bold text-[#00305E] text-sm">{score * 20}</span>
        </div>

        {/* Streak */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
          style={{ background: "#FFF4EC", border: "1.5px solid rgba(249,115,22,0.3)" }}
        >
          <Flame size={14} fill="#F97316" className="text-orange-500" />
          <span className="font-bold text-[#00305E] text-sm">14</span>
        </div>

        {/* Lives */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              size={18}
              className={i < lives ? "text-red-500" : "text-[#E2E8F0]"}
              fill={i < lives ? "#EF4444" : "#E2E8F0"}
            />
          ))}
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      {completed ? (
        <CompletionScreen
          score={score}
          total={QUESTIONS.length}
          onReplay={() => { goToQuestion(0); setScore(0); setLives(3); setCompleted(false); }}
          onExit={() => router.push("/roadmap")}
        />
      ) : (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">

          {/* Category badge */}
          <div className="flex items-center gap-2 mb-5">
            <motion.span
              key={q.id}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: "#EEF4FF",
                color: "#00305E",
                border: "1.5px solid rgba(0,48,94,0.12)",
              }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              💻 {q.category}
            </motion.span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,206,0,0.18)", color: "#00305E" }}
            >
              {q.level}
            </span>
          </div>

          {/* Instruction */}
          <motion.h2
            className="text-xl text-[#00305E] mb-2"
            key={`inst-${q.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Baue den deutschen Satz! 🧱
          </motion.h2>
          <p className="text-sm text-[#64748B] mb-5">Ziehe die richtigen Wörter in die Lücken.</p>

          {/* ── Target Sentence Card ──────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              className="mb-5 rounded-[20px] p-6 sm:p-8"
              style={{
                background: "white",
                border: "2px solid #E2E8F0",
                boxShadow: "0 4px 24px rgba(0,48,94,0.08)",
              }}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* Audio button */}
              <button
                className="flex items-center gap-1.5 mb-4 text-xs font-medium transition-colors px-3 py-1.5 rounded-[8px]"
                style={{ color: "#64748B", background: "#F5F7FA", border: "1.5px solid #E2E8F0" }}
              >
                <Volume2 size={13} /> Anhören
              </button>

              {/* Sentence with drop zones */}
              <p className="text-2xl sm:text-3xl leading-loose flex flex-wrap items-center" style={{ color: "#1A1A1A" }}>
                {q.parts.map((part, i) => (
                  <span key={i}>
                    <span>{part}</span>
                    {i < q.parts.length - 1 && (
                      <DropSlot
                        slotIdx={i}
                        filledWord={slots[i]}
                        filledColorIdx={slotColorIdxs[i]}
                        onDrop={(si, wordId, word, colorIdx) => placeWord(si, wordId, word, colorIdx)}
                        onRemove={removeWord}
                        onClickEmpty={handleSlotClickEmpty}
                        hasSelection={!!selectedWordId}
                        feedbackState={feedback}
                        correctAnswer={q.answers[i]}
                      />
                    )}
                  </span>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* ── Word Pool ─────────────────────────────────────────────────── */}
          <div
            className="rounded-[20px] p-5 mb-5"
            style={{
              background: "#F1F4F9",
              border: "2px solid #E2E8F0",
              minHeight: 100,
            }}
          >
            <p className="text-xs font-semibold text-[#94A3B8] mb-3 uppercase tracking-wider">
              Verfügbare Wörter
            </p>
            <div className="flex flex-wrap gap-3">
              {q.pool.map((item) => (
                <LegoBlock
                  key={item.id}
                  item={item}
                  isUsed={usedWordIds.has(item.id)}
                  isSelected={selectedWordId === item.id}
                  onClick={() => handleWordClick(item)}
                />
              ))}
            </div>
          </div>

          {/* ── Bottom: AI + Check ────────────────────────────────────────── */}
          <div className="flex items-end gap-4 justify-between">
            <AITeacher
              onHint={() => setShowHint((v) => !v)}
              showHint={showHint}
              hintText={q.hint}
              onClose={() => setShowHint(false)}
            />
            <motion.button
              onClick={handleCheck}
              disabled={!allFilled || feedback !== null}
              className="px-8 py-3.5 rounded-[14px] font-bold text-base flex items-center gap-2 transition-all flex-shrink-0"
              style={{
                background: allFilled && feedback === null ? "#00305E" : "#E2E8F0",
                color: allFilled && feedback === null ? "white" : "#94A3B8",
                boxShadow:
                  allFilled && feedback === null
                    ? "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)"
                    : "0 3px 0 0 #CBD5E1",
                cursor: allFilled && feedback === null ? "pointer" : "not-allowed",
                transform: "none",
              }}
              whileHover={allFilled && feedback === null ? { y: -1 } : {}}
              whileTap={allFilled && feedback === null ? { y: 4 } : {}}
            >
              <Check size={17} strokeWidth={3} />
              Prüfen
            </motion.button>
          </div>
        </div>
      )}

      {/* ── Feedback Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {feedback !== null && (
          <FeedbackModal
            state={feedback}
            question={q}
            slots={slots}
            onContinue={handleContinue}
            onReview={handleReview}
          />
        )}
      </AnimatePresence>

      {/* ── Exit Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showExit && (
          <ExitModal
            onConfirm={() => router.push("/roadmap")}
            onCancel={() => setShowExit(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Default export (DndProvider wrapper) ────────────────────────────────────

export default function GamePage() {
  return (
    <DndProvider backend={HTML5Backend}>
      <GameContent />
    </DndProvider>
  );
}