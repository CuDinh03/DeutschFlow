import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
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
  {
    id: 4,
    type: "grammar-rule",
    category: "Wortstellung",
    level: "A2",
    instruction: "Welche Satzstellung ist grammatikalisch korrekt?",
    questionParts: [
      "Der Zug kommt wegen des Sturms zu spät.",
    ],
    blank: null,
    options: [
      "Der Zug kommt wegen des Sturms zu spät.",
      "Der Zug wegen des Sturms kommt zu spät.",
      "Wegen des Sturms der Zug kommt zu spät.",
      "Zu spät kommt der Zug des Sturms wegen.",
    ],
    correct: 0,
    explanation:
      'Im deutschen Hauptsatz steht das Verb an zweiter Stelle. Adverbiale Phrasen wie "wegen des Sturms" können am Anfang oder Ende stehen, aber das Verb bleibt an Position 2.',
    hint: 'Im Deutschen steht das konjugierte Verb immer an zweiter Position im Hauptsatz.',
  },
  {
    id: 5,
    type: "translation",
    category: "Vokabular",
    level: "A1",
    instruction: "Was bedeutet das folgende Wort auf Englisch?",
    questionParts: ['"Schmettерling"'],
    blank: null,
    options: ["Butterfly", "Dragonfly", "Beetle", "Grasshopper"],
    correct: 0,
    explanation:
      '"Schmetterling" ist das deutsche Wort für "butterfly" — eines der schönsten Wörter der deutschen Sprache!',
    hint: 'Dieses Tier hat farbenfrohe Flügel und fliegt von Blume zu Blume.',
  },
  {
    id: 6,
    type: "fill-blank",
    category: "Dativ",
    level: "B1",
    instruction: "Wähle den richtigen Artikel im Dativ",
    questionParts: ["Ich gebe ", " Frau das Buch."],
    blank: "___",
    options: ["die", "der", "den", "das"],
    correct: 1,
    explanation:
      '"Die Frau" ist feminin. Im Dativ wird der bestimmte Artikel feminin zu "der".',
    hint: '"Die Frau" ist feminin — wie verändert sich der Artikel im Dativ?',
  },
  {
    id: 7,
    type: "translation",
    category: "Redewendungen",
    level: "B1",
    instruction: "Wähle die beste Übersetzung",
    questionParts: ['"Das ist mir Wurst."'],
    blank: null,
    options: [
      "I don't care.",
      "I love sausages.",
      "That's my favourite meal.",
      "This is very important.",
    ],
    correct: 0,
    explanation:
      '"Das ist mir Wurst" ist eine umgangssprachliche Redewendung. Sie bedeutet, dass einem etwas egal ist — wie Wurst, die immer gleich schmeckt!',
    hint: 'Diese Redewendung drückt Gleichgültigkeit gegenüber etwas aus.',
  },
  {
    id: 8,
    type: "fill-blank",
    category: "Konjunktiv",
    level: "B1",
    instruction: "Ergänze den Satz korrekt",
    questionParts: ["Wenn ich Zeit hätte, ", " ich mehr lesen."],
    blank: "___",
    options: ["würde", "werde", "will", "hätte"],
    correct: 0,
    explanation:
      'Im Konjunktiv II (irreale Bedingungssätze) verwendet man "würde + Infinitiv" im Hauptsatz, wenn der Kontext unrealistisch oder hypothetisch ist.',
    hint: '"Wenn ... hätte" signalisiert den Konjunktiv II. Welches Hilfsverb nutzt man im Hauptsatz?',
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
        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#FFCE00] to-[#E6B900] flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(255,206,0,0.4)]"
      >
        <Trophy size={48} className="text-[#00305E]" />
      </motion.div>

      <motion.h2
        className="text-3xl text-[#00305E] mb-2"
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
        Du hast <span className="font-bold text-[#00305E]">{score}</span> von{" "}
        <span className="font-bold text-[#00305E]">{total}</span> Fragen richtig
        beantwortet.
      </motion.p>

      {/* Stats Row */}
      <motion.div
        className="flex gap-6 mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        {[
          { label: "Genauigkeit", value: `${pct}%`, color: "#00305E" },
          { label: "XP verdient", value: `+${score * 15}`, color: "#FFCE00" },
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
          className="flex items-center gap-2 px-6 py-3 rounded-[12px] bg-[#F5F7FA] hover:bg-[#E2E8F0] text-[#00305E] font-semibold transition-colors border border-[#E2E8F0]"
        >
          <RotateCcw size={16} />
          Nochmal üben
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-8 py-3 rounded-[12px] bg-[#00305E] hover:bg-[#002447] text-white font-semibold transition-colors shadow-md"
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
        <h3 className="text-lg text-[#1A1A1A] mb-2">Lektion verlassen?</h3>
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
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#00305E] text-white rounded-[12px] px-4 py-3 shadow-xl z-10 w-72 text-sm text-center"
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00305E] rotate-45 rounded-sm" />
      <p className="leading-snug">{hint}</p>
      <button
        onClick={onClose}
        className="mt-2 text-[#FFCE00] text-xs font-semibold hover:underline"
      >
        Schließen
      </button>
    </motion.div>
  );
}

// ─── Main Lesson Component ───────────────────────────────────────────────────────
export default function Lesson() {
  const navigate = useNavigate();
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

  // Reset state when question changes
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

  // Check button styles
  const checkBtnStyle = () => {
    if (checkState === "correct")
      return "bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)]";
    if (checkState === "incorrect")
      return "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[0_4px_16px_rgba(239,68,68,0.35)]";
    if (selectedOption !== null)
      return "bg-[#00305E] hover:bg-[#002447] text-white shadow-[0_4px_16px_rgba(0,48,94,0.25)]";
    return "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed";
  };

  // Option styles
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
      return `${base} border-[#00305E] bg-[#EEF4FF] text-[#00305E] shadow-[0_0_0_3px_rgba(0,48,94,0.1)]`;
    return `${base} border-[#E2E8F0] bg-white text-[#1A1A1A] hover:border-[#00305E]/40 hover:bg-[#F8FAFF] hover:shadow-sm`;
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-[#F0F4F8] flex-shrink-0">
        {/* Exit Button */}
        <button
          onClick={() => setShowExitModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#1A1A1A] transition-colors text-sm font-medium flex-shrink-0"
        >
          <X size={16} />
          <span className="hidden sm:inline">Verlassen</span>
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 bg-[#F0F4F8] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#FFCE00] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#94A3B8] text-xs">
              Frage {questionIndex + 1} von {totalQuestions}
            </span>
            <span className="text-[#00305E] text-xs font-semibold">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Lives */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              animate={i >= lives ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart
                size={20}
                className={
                  i < lives
                    ? "text-red-500 fill-red-500"
                    : "text-[#E2E8F0] fill-[#E2E8F0]"
                }
              />
            </motion.div>
          ))}
        </div>

        {/* Streak */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#FFF8E1] rounded-[10px] px-3 py-1.5 border border-[#FFCE00]/30 flex-shrink-0">
          <Flame size={15} className="text-orange-500" fill="#f97316" />
          <span className="text-[#00305E] text-xs font-bold">14</span>
        </div>
      </header>

      {/* ── Main Body ───────────────────────────────────────────────────────── */}
      {completed ? (
        <CompletionScreen
          score={score}
          total={totalQuestions}
          onRestart={handleRestart}
          onExit={() => navigate("/")}
        />
      ) : (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {/* Category badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 bg-[#EEF4FF] text-[#00305E] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#00305E]/15">
              <BookOpen size={12} />
              {q.category}
            </span>
            <span className="bg-[#FFCE00]/20 text-[#00305E] text-xs font-bold px-2.5 py-1 rounded-full">
              {q.level}
            </span>
          </div>

          {/* ── Question Card ─────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {/* Instruction */}
              <p className="text-[#64748B] text-sm mb-3">{q.instruction}</p>

              {/* Question display */}
              <div className="bg-gradient-to-br from-[#F8FAFF] to-[#F0F4FF] rounded-[20px] p-6 sm:p-8 mb-6 border border-[#E2E8F0] shadow-[0_2px_12px_rgba(0,48,94,0.06)]">
                {/* Audio icon for translation tasks */}
                {q.type === "translation" && (
                  <button className="flex items-center gap-2 mb-4 text-[#00305E]/60 hover:text-[#00305E] text-xs font-medium transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-[#00305E]/8 group-hover:bg-[#00305E]/15 flex items-center justify-center transition-colors">
                      <Volume2 size={14} />
                    </div>
                    Anhören
                  </button>
                )}

                {/* Question text with blank highlight */}
                <p className="text-[#1A1A1A] text-xl sm:text-2xl leading-relaxed">
                  {q.questionParts.map((part, i) => (
                    <span key={i}>
                      {part}
                      {i < q.questionParts.length - 1 && q.blank && (
                        <span className="inline-flex items-center mx-1">
                          {checkState !== "idle" ? (
                            <motion.span
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              className={`inline-block px-3 py-0.5 rounded-[8px] font-bold text-lg ${
                                checkState === "correct"
                                  ? "bg-[#10B981] text-white"
                                  : "bg-[#EF4444] text-white"
                              }`}
                            >
                              {q.options[selectedOption ?? 0]}
                            </motion.span>
                          ) : selectedOption !== null ? (
                            <motion.span
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              className="inline-block px-3 py-0.5 rounded-[8px] bg-[#00305E] text-white font-bold text-lg"
                            >
                              {q.options[selectedOption]}
                            </motion.span>
                          ) : (
                            <span className="inline-block w-16 h-1 bg-[#00305E]/30 rounded-full align-middle mx-1" />
                          )}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              </div>

              {/* ── Answer Options ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {q.options.map((option, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => {
                      if (checkState === "idle") setSelectedOption(idx);
                    }}
                    className={optionStyle(idx)}
                    whileHover={
                      checkState === "idle" && selectedOption !== idx
                        ? { scale: 1.01 }
                        : {}
                    }
                    whileTap={checkState === "idle" ? { scale: 0.99 } : {}}
                    disabled={checkState !== "idle"}
                  >
                    {/* Letter badge */}
                    <span
                      className={`w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                        checkState !== "idle"
                          ? idx === q.correct
                            ? "bg-[#10B981] text-white"
                            : idx === selectedOption
                              ? "bg-[#EF4444] text-white"
                              : "bg-[#F5F7FA] text-[#94A3B8]"
                          : selectedOption === idx
                            ? "bg-[#00305E] text-white"
                            : "bg-[#F5F7FA] text-[#64748B] group-hover:bg-[#00305E]/10"
                      }`}
                    >
                      {optionLabels[idx]}
                    </span>
                    <span className="flex-1 leading-snug">{option}</span>
                    {/* State icons */}
                    {checkState !== "idle" && idx === q.correct && (
                      <CheckCircle
                        size={18}
                        className="text-[#10B981] flex-shrink-0"
                      />
                    )}
                    {checkState !== "idle" &&
                      idx === selectedOption &&
                      idx !== q.correct && (
                        <XCircle
                          size={18}
                          className="text-[#EF4444] flex-shrink-0"
                        />
                      )}
                  </motion.button>
                ))}
              </div>

              {/* ── Hint Button ────────────────────────────────────────────── */}
              {checkState === "idle" && (
                <div className="flex justify-center mb-2 relative">
                  <AnimatePresence>
                    {showHint && (
                      <HintPopover
                        hint={q.hint}
                        onClose={() => setShowHint(false)}
                      />
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setShowHint((v) => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                      showHint
                        ? "bg-[#FFF8E1] text-[#B45309] border border-[#FFCE00]/50"
                        : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#1A1A1A] border border-transparent"
                    }`}
                  >
                    <Lightbulb
                      size={15}
                      className={showHint ? "text-[#FFCE00]" : ""}
                      fill={showHint ? "#FFCE00" : "none"}
                    />
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
        <AnimatePresence>
          {checkState !== "idle" ? (
            <motion.div
              key="feedback"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className={`flex-shrink-0 border-t-2 ${
                checkState === "correct"
                  ? "bg-[#F0FDF4] border-[#10B981]"
                  : "bg-[#FEF2F2] border-[#EF4444]"
              }`}
            >
              <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Left: result */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      checkState === "correct" ? "bg-[#10B981]" : "bg-[#EF4444]"
                    }`}
                  >
                    {checkState === "correct" ? (
                      <CheckCircle size={22} className="text-white" />
                    ) : (
                      <XCircle size={22} className="text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`font-bold text-base mb-0.5 ${
                        checkState === "correct"
                          ? "text-[#065F46]"
                          : "text-[#991B1B]"
                      }`}
                    >
                      {checkState === "correct"
                        ? "Richtig! 🎉"
                        : "Nicht ganz…"}
                    </p>
                    {checkState === "incorrect" && (
                      <p className="text-[#991B1B] text-sm mb-1">
                        Richtige Antwort:{" "}
                        <strong>{q.options[q.correct]}</strong>
                      </p>
                    )}
                    <p
                      className={`text-sm leading-snug ${
                        checkState === "correct"
                          ? "text-[#047857]"
                          : "text-[#B91C1C]"
                      }`}
                    >
                      {q.explanation}
                    </p>
                  </div>
                </div>

                {/* Right: Continue button */}
                <motion.button
                  onClick={handleNext}
                  className={`flex items-center gap-2 px-6 py-3 rounded-[12px] font-semibold text-sm flex-shrink-0 transition-colors ${
                    checkState === "correct"
                      ? "bg-[#10B981] hover:bg-[#059669] text-white shadow-md"
                      : "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-md"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {questionIndex + 1 >= totalQuestions
                    ? "Abschließen"
                    : "Weiter"}
                  <ArrowRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="check"
              className="flex-shrink-0 bg-white border-t border-[#F0F4F8] px-4 sm:px-6 py-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="max-w-2xl mx-auto">
                <motion.button
                  onClick={handleCheck}
                  disabled={selectedOption === null}
                  className={`w-full py-4 rounded-[14px] font-semibold text-base transition-all duration-200 ${checkBtnStyle()}`}
                  whileHover={selectedOption !== null ? { scale: 1.01 } : {}}
                  whileTap={selectedOption !== null ? { scale: 0.99 } : {}}
                >
                  Antwort prüfen
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Exit Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showExitModal && (
          <ExitModal
            onConfirm={() => navigate("/")}
            onCancel={() => setShowExitModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
