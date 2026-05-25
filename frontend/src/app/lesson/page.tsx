"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  X,
  Lightbulb,
  CheckCircle,
  XCircle,
  ArrowRight,
  Heart,
  Flame,
  Trophy,
  RotateCcw,
  BookOpen,
  Volume2,
} from "lucide-react";

// ─── Question data ─────────────────────────────────────────────────────────────
const questions = [
  {
    id: 1,
    type: "fill-blank",
    category: "Grammatik",
    level: "A2",
    instruction: "Wähle die richtige Antwort",
    questionParts: ["Ich ", " gestern ins Kino gegangen."],
    blank: "___",
    options: ["bin", "habe", "war", "wurde"],
    correct: 0,
    explanation:
      'Mit Bewegungsverben wie "gehen" verwendet man "sein" als Hilfsverb im Perfekt.',
    hint: 'Denk an Bewegungsverben — welches Hilfsverb nutzen sie im Perfekt?',
  },
  {
    id: 2,
    type: "translation",
    category: "Übersetzung",
    level: "A2",
    instruction: "Wie lautet die korrekte Übersetzung?",
    questionParts: ['"I would like a coffee, please."'],
    blank: null,
    options: [
      "Ich möchte einen Kaffee, bitte.",
      "Ich will Kaffee haben.",
      "Ich hätte gerne Kaffee trinken.",
      "Mir gefällt Kaffee, danke.",
    ],
    correct: 0,
    explanation:
      '"Ich möchte" ist die höfliche Form für Wünsche und wird in Restaurants und Cafés verwendet.',
    hint: 'Die höflichere Form von "wollen" ist "möchten".',
  },
  {
    id: 3,
    type: "fill-blank",
    category: "Adjektiv-Deklination",
    level: "A2",
    instruction: "Wähle die richtige Adjektivform",
    questionParts: ["Das ist ein ", " Auto. (groß)"],
    blank: "___",
    options: ["große", "großes", "großen", "großer"],
    correct: 1,
    explanation:
      'Nach dem unbestimmten Artikel "ein" erhält ein neutrales Nomen (das Auto) die Endung "-es".',
    hint: '"Das Auto" ist neutral. Welche Endung bekommt "groß" nach "ein"?',
  },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
type CheckState = "idle" | "correct" | "incorrect";

// ─── Completion Screen ──────────────────────────────────────────────────────────
function CompletionScreen({
  score,
  total,
  onRestart,
  onExit,
}: {
  score: number;
  total: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const pct = Math.round((score / total) * 100);
  const perfect = score === total;
  const good = pct >= 75;

  return (
    <motion.div
      className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#FFCD00] to-[#E6B900] flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(255,206,0,0.4)]"
      >
        <Trophy size={48} className="text-[#121212]" />
      </motion.div>

      <motion.h2
        className="text-3xl font-bold text-[#121212] mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        {perfect ? "Perfekt! 🎉" : good ? "Sehr gut! 👏" : "Weiter üben! 💪"}
      </motion.h2>

      <motion.p
        className="text-[#64748B] text-base mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        Du hast <span className="font-bold text-[#121212]">{score}</span> von{" "}
        <span className="font-bold text-[#121212]">{total}</span> Fragen richtig
        beantwortet.
      </motion.p>

      <motion.div
        className="flex gap-6 mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        {[
          { label: "Genauigkeit", value: `${pct}%`, color: "#121212" },
          { label: "XP verdient", value: `+${score * 15}`, color: "#FFCD00" },
          { label: "Serie", value: "14 🔥", color: "#f97316" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center bg-white rounded-[14px] px-6 py-4 shadow-[0_2px_12px_rgba(0,48,94,0.08)] border border-[#E2E8F0] min-w-[90px]"
          >
            <span
              className="text-2xl font-extrabold mb-1"
              style={{ color }}
            >
              {value}
            </span>
            <span className="text-[#64748B] text-xs">{label}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="flex gap-3 flex-wrap justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-6 py-3 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] text-[#121212] font-semibold transition-colors border border-[#E2E8F0]"
        >
          <RotateCcw size={16} />
          Nochmal üben
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-8 py-3 rounded-[12px] bg-[#121212] hover:bg-[#000000] text-white font-semibold transition-colors shadow-md"
        >
          Zum Dashboard
          <ArrowRight size={16} />
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Exit Modal ─────────────────────────────────────────────────────────────────
function ExitModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-[20px] p-8 max-w-sm w-full shadow-2xl text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <X size={24} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Lektion verlassen?</h3>
        <p className="text-[#64748B] text-sm mb-6">
          Dein Fortschritt in dieser Lektion geht verloren.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] text-[#1A1A1A] font-semibold text-sm transition-colors border border-[#E2E8F0]"
          >
            Weiterlernen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-[12px] bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
          >
            Verlassen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Hint Popover ────────────────────────────────────────────────────────────────
function HintPopover({
  hint,
  onClose,
}: {
  hint: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#121212] text-white rounded-[12px] px-4 py-3 shadow-xl z-10 w-72 text-sm text-center"
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#121212] rotate-45 rounded-sm" />
      <p className="leading-snug">{hint}</p>
      <button
        onClick={onClose}
        className="mt-2 text-[#FFCD00] text-xs font-semibold hover:underline"
      >
        Schließen
      </button>
    </motion.div>
  );
}

export default function LessonPage() {
  const router = useRouter();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [showHint, setShowHint] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [direction, setDirection] = useState(1);

  const q = questions[questionIndex];
  const totalQuestions = questions.length;
  const progressPct = (questionIndex / totalQuestions) * 100;

  useEffect(() => {
    setSelectedOption(null);
    setCheckState("idle");
    setShowHint(false);
  }, [questionIndex]);

  const handleCheck = () => {
    if (selectedOption === null) return;
    const isCorrect = selectedOption === q.correct;
    setCheckState(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      setScore((s) => s + 1);
    } else {
      setLives((l) => Math.max(0, l - 1));
    }
  };

  const handleNext = () => {
    if (questionIndex + 1 >= totalQuestions) {
      setCompleted(true);
    } else {
      setDirection(1);
      setQuestionIndex((i) => i + 1);
    }
  };

  const handleRestart = () => {
    setQuestionIndex(0);
    setSelectedOption(null);
    setCheckState("idle");
    setShowHint(false);
    setLives(3);
    setScore(0);
    setCompleted(false);
  };

  const checkBtnStyle = () => {
    if (checkState === "correct")
      return "bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)]";
    if (checkState === "incorrect")
      return "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)]";
    if (selectedOption !== null)
      return "bg-[#121212] hover:bg-[#000000] text-white shadow-[0_4px_16px_rgba(0,48,94,0.25)]";
    return "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed";
  };

  const optionStyle = (idx: number) => {
    const base =
      "w-full flex items-center gap-4 px-5 py-4 rounded-[14px] border-2 text-left transition-all duration-200 font-medium text-sm group";

    if (checkState !== "idle") {
      if (idx === q.correct)
        return `${base} border-[#10B981] bg-[#F0FDF4] text-[#065F46]`;
      if (idx === selectedOption && idx !== q.correct)
        return `${base} border-[#EF4444] bg-[#FEF2F2] text-[#991B1B]`;
      return `${base} border-[#E2E8F0] bg-white text-[#94A3B8]`;
    }

    if (selectedOption === idx)
      return `${base} border-[#121212] bg-[#EEF4FF] text-[#121212] shadow-[0_0_0_3px_rgba(0,48,94,0.1)]`;
    return `${base} border-[#E2E8F0] bg-white text-[#1A1A1A] hover:border-[#121212]/40 hover:bg-[#F8FAFF] hover:shadow-sm`;
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F4F8] flex-shrink-0">
        <button
          onClick={() => setShowExitModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[#64748B] hover:bg-[#F5F7FA] transition-colors text-sm font-medium flex-shrink-0"
        >
          <X size={16} />
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <div className="h-3 bg-[#F0F4F8] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#FFCD00] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div key={i} animate={i >= lives ? { scale: [1, 1.3, 1] } : {}}>
              <Heart size={18} className={i < lives ? "text-red-500 fill-red-500" : "text-[#E2E8F0] fill-[#E2E8F0]"} />
            </motion.div>
          ))}
        </div>
      </header>

      {/* ── Main Body ───────────────────────────────────────────────────────── */}
      {completed ? (
        <CompletionScreen
          score={score}
          total={totalQuestions}
          onRestart={handleRestart}
          onExit={() => router.push("/dashboard")}
        />
      ) : (
        <div className="flex-1 flex flex-col max-w-[430px] mx-auto w-full px-4 py-5">
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 bg-[#EEF4FF] text-[#121212] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#121212]/15">
              <BookOpen size={12} />
              {q.category}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <p className="text-[#64748B] text-sm mb-3">{q.instruction}</p>

              <div className="bg-gradient-to-br from-[#F8FAFF] to-[#F0F4FF] rounded-[20px] p-6 sm:p-8 mb-6 border border-[#E2E8F0] shadow-[0_2px_12px_rgba(0,48,94,0.06)]">
                <p className="text-[#1A1A1A] text-xl sm:text-2xl leading-relaxed">
                  {q.questionParts.map((part, i) => (
                    <span key={i}>
                      {part}
                      {i < q.questionParts.length - 1 && q.blank && (
                        <span className="inline-flex items-center mx-1">
                          {checkState !== "idle" ? (
                            <motion.span className={`inline-block px-3 py-0.5 rounded-[8px] font-bold text-lg ${checkState === "correct" ? "bg-[#10B981] text-white" : "bg-[#EF4444] text-white"}`}>
                              {q.options[selectedOption ?? 0]}
                            </motion.span>
                          ) : selectedOption !== null ? (
                            <motion.span className="inline-block px-3 py-0.5 rounded-[8px] bg-[#121212] text-white font-bold text-lg">
                              {q.options[selectedOption]}
                            </motion.span>
                          ) : (
                            <span className="inline-block w-16 h-1 bg-[#121212]/30 rounded-full align-middle mx-1" />
                          )}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {q.options.map((option, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => { if (checkState === "idle") setSelectedOption(idx); }}
                    className={optionStyle(idx)}
                    disabled={checkState !== "idle"}
                  >
                    <span className={`w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${checkState !== "idle" ? (idx === q.correct ? "bg-[#10B981] text-white" : (idx === selectedOption ? "bg-[#EF4444] text-white" : "bg-[#F5F7FA] text-[#94A3B8]")) : (selectedOption === idx ? "bg-[#121212] text-white" : "bg-[#F5F7FA] text-[#64748B] group-hover:bg-[#121212]/10")}}`}>
                      {optionLabels[idx]}
                    </span>
                    <span className="flex-1 leading-snug">{option}</span>
                  </motion.button>
                ))}
              </div>

              {checkState === "idle" && (
                <div className="flex justify-center mb-2 relative">
                  {showHint && <HintPopover hint={q.hint} onClose={() => setShowHint(false)} />}
                  <button onClick={() => setShowHint((v) => !v)} className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 ${showHint ? "bg-[#FFF8E1] text-[#B45309] border border-[#FFCD00]/50" : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#1A1A1A] border border-transparent"}`}>
                    <Lightbulb size={15} fill={showHint ? "#FFCD00" : "none"} className={showHint ? "text-[#FFCD00]" : ""} />
                    Hinweis anzeigen
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Feedback Panel + Check Button ─────────────────────────────────── */}
      {!completed && (
        <div className="flex-shrink-0 bg-white border-t border-[#F0F4F8] px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            {checkState === "idle" ? (
              <button
                onClick={handleCheck}
                disabled={selectedOption === null}
                className={`w-full py-4 rounded-[14px] font-semibold text-base transition-all duration-200 ${checkBtnStyle()}`}
              >
                Antwort prüfen
              </button>
            ) : (
              <div className={`p-4 rounded-xl mb-4 ${checkState === "correct" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                <p className="font-bold mb-1">{checkState === "correct" ? "Richtig! 🎉" : "Nicht ganz…"}</p>
                <p className="text-sm">{q.explanation}</p>
                <button
                  onClick={handleNext}
                  className="mt-4 w-full py-3 bg-[#121212] text-white rounded-xl font-bold"
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showExitModal && <ExitModal onConfirm={() => router.push("/dashboard")} onCancel={() => setShowExitModal(false)} />}
    </div>
  );
}
