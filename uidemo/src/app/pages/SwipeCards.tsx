import { useState, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useAnimation,
} from "motion/react";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  Check,
  X,
  Lightbulb,
  RotateCcw,
  RefreshCw,
  Volume2,
  Star,
  Layers,
  ChevronRight,
  Trophy,
  Zap,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CardType = "masculine" | "feminine" | "neuter" | "verb" | "adjective";

interface VocabCard {
  id: number;
  type: CardType;
  article?: string;
  word: string;
  english: string;
  phonetic: string;
  sentence: string;
  sentenceEN: string;
  emoji: string;
  level: "A1" | "A2" | "B1" | "B2";
}

// ─── Color System ───────────────────────────────────────────────────────────────

const COLOR: Record<
  CardType,
  {
    primary: string; dark: string; light: string; bg: string;
    gradient: string; glow: string; label: string; tag: string;
  }
> = {
  masculine: {
    primary: "#2D9CDB", dark: "#1A6A9A", light: "#EBF5FB", bg: "#DBEEFF",
    gradient: "linear-gradient(145deg, #2D9CDB 0%, #1A6A9A 100%)",
    glow: "rgba(45,156,219,0.40)", label: "Maskulin", tag: "der",
  },
  feminine: {
    primary: "#EB5757", dark: "#A33030", light: "#FDEAEA", bg: "#FFE5E5",
    gradient: "linear-gradient(145deg, #EB5757 0%, #A33030 100%)",
    glow: "rgba(235,87,87,0.40)", label: "Feminin", tag: "die",
  },
  neuter: {
    primary: "#27AE60", dark: "#1A7A42", light: "#E8F8F0", bg: "#D5F5E3",
    gradient: "linear-gradient(145deg, #27AE60 0%, #1A7A42 100%)",
    glow: "rgba(39,174,96,0.40)", label: "Neutrum", tag: "das",
  },
  verb: {
    primary: "#9B51E0", dark: "#6D25B3", light: "#F4EDFF", bg: "#EDE9FE",
    gradient: "linear-gradient(145deg, #9B51E0 0%, #6D25B3 100%)",
    glow: "rgba(155,81,224,0.40)", label: "Verb", tag: "vb.",
  },
  adjective: {
    primary: "#F2994A", dark: "#C26B1A", light: "#FEF3E8", bg: "#FDE8D0",
    gradient: "linear-gradient(145deg, #F2994A 0%, #C26B1A 100%)",
    glow: "rgba(242,153,74,0.40)", label: "Adjektiv", tag: "adj.",
  },
};

// ─── Vocabulary Deck (20 cards) ────────────────────────────────────────────────

const DECK: VocabCard[] = [
  { id: 1, type: "masculine", article: "Der", word: "Tisch", english: "Table", phonetic: "/tɪʃ/", sentence: "Der Tisch steht im Esszimmer.", sentenceEN: "The table is in the dining room.", emoji: "🪑", level: "A1" },
  { id: 2, type: "feminine", article: "Die", word: "Katze", english: "Cat", phonetic: "/ˈkatsə/", sentence: "Die Katze schlaeft auf dem Sofa.", sentenceEN: "The cat sleeps on the sofa.", emoji: "🐱", level: "A1" },
  { id: 3, type: "neuter", article: "Das", word: "Buch", english: "Book", phonetic: "/buːx/", sentence: "Das Buch ist sehr spannend.", sentenceEN: "The book is very exciting.", emoji: "📚", level: "A1" },
  { id: 4, type: "verb", word: "lernen", english: "to learn", phonetic: "/ˈlɛʁnən/", sentence: "Ich lerne jeden Tag Deutsch.", sentenceEN: "I learn German every day.", emoji: "📖", level: "A1" },
  { id: 5, type: "adjective", word: "interessant", english: "interesting", phonetic: "/ɪntʁəˈsant/", sentence: "Das Thema ist sehr interessant.", sentenceEN: "The topic is very interesting.", emoji: "✨", level: "A2" },
  { id: 6, type: "masculine", article: "Der", word: "Bahnhof", english: "Train Station", phonetic: "/ˈbaːnˌhoːf/", sentence: "Der Bahnhof ist nicht weit.", sentenceEN: "The train station is not far.", emoji: "🚂", level: "A2" },
  { id: 7, type: "feminine", article: "Die", word: "Schule", english: "School", phonetic: "/ˈʃuːlə/", sentence: "Die Schule beginnt um acht Uhr.", sentenceEN: "School starts at eight o'clock.", emoji: "🏫", level: "A1" },
  { id: 8, type: "neuter", article: "Das", word: "Fenster", english: "Window", phonetic: "/ˈfɛnstɐ/", sentence: "Das Fenster ist weit offen.", sentenceEN: "The window is wide open.", emoji: "🪟", level: "A1" },
  { id: 9, type: "verb", word: "schreiben", english: "to write", phonetic: "/ˈʃʁaɪ̯bən/", sentence: "Er schreibt einen langen Brief.", sentenceEN: "He writes a long letter.", emoji: "✍️", level: "A1" },
  { id: 10, type: "adjective", word: "muede", english: "tired", phonetic: "/ˈmyːdə/", sentence: "Ich bin heute sehr muede.", sentenceEN: "I am very tired today.", emoji: "😴", level: "A1" },
  { id: 11, type: "masculine", article: "Der", word: "Schluessel", english: "Key", phonetic: "/ˈʃlʏsəl/", sentence: "Der Schluessel liegt auf dem Tisch.", sentenceEN: "The key is on the table.", emoji: "🔑", level: "A1" },
  { id: 12, type: "feminine", article: "Die", word: "Strasse", english: "Street", phonetic: "/ˈʃtʁaːsə/", sentence: "Die Strasse ist sehr belebt.", sentenceEN: "The street is very busy.", emoji: "🛣️", level: "A2" },
  { id: 13, type: "neuter", article: "Das", word: "Fahrrad", english: "Bicycle", phonetic: "/ˈfaːɐ̯ˌʁaːt/", sentence: "Das Fahrrad ist neu und schnell.", sentenceEN: "The bicycle is new and fast.", emoji: "🚲", level: "A2" },
  { id: 14, type: "verb", word: "verstehen", english: "to understand", phonetic: "/fɛɐ̯ˈʃteːən/", sentence: "Ich verstehe die Frage sehr gut.", sentenceEN: "I understand the question very well.", emoji: "💡", level: "A2" },
  { id: 15, type: "adjective", word: "schwierig", english: "difficult", phonetic: "/ˈʃviːʁɪç/", sentence: "Die Pruefung ist sehr schwierig.", sentenceEN: "The exam is very difficult.", emoji: "😤", level: "A2" },
  { id: 16, type: "masculine", article: "Der", word: "Arzt", english: "Doctor", phonetic: "/aːɐ̯tst/", sentence: "Der Arzt hilft dem Patienten.", sentenceEN: "The doctor helps the patient.", emoji: "👨‍⚕️", level: "A2" },
  { id: 17, type: "feminine", article: "Die", word: "Zeitung", english: "Newspaper", phonetic: "/ˈtsaɪ̯tʊŋ/", sentence: "Die Zeitung liegt auf dem Tisch.", sentenceEN: "The newspaper is on the table.", emoji: "📰", level: "A2" },
  { id: 18, type: "neuter", article: "Das", word: "Krankenhaus", english: "Hospital", phonetic: "/ˈkʁaŋkənˌhaʊ̯s/", sentence: "Das Krankenhaus ist in der Naehe.", sentenceEN: "The hospital is nearby.", emoji: "🏥", level: "B1" },
  { id: 19, type: "verb", word: "besuchen", english: "to visit", phonetic: "/bəˈzuːxən/", sentence: "Wir besuchen unsere Grosseltern.", sentenceEN: "We visit our grandparents.", emoji: "🏡", level: "A2" },
  { id: 20, type: "adjective", word: "freundlich", english: "friendly", phonetic: "/ˈfʁɔʏ̯ntlɪç/", sentence: "Die Lehrerin ist sehr freundlich.", sentenceEN: "The teacher is very friendly.", emoji: "😊", level: "A2" },
];

const LEVEL_BG: Record<string, string> = {
  A1: "rgba(255,255,255,0.2)", A2: "rgba(255,255,255,0.2)",
  B1: "rgba(255,255,255,0.2)", B2: "rgba(255,255,255,0.2)",
};

// ─── Swipe-able Card Component ─────────────────────────────────────────────────

interface SwipeCardProps {
  card: VocabCard;
  stackIndex: 0 | 1 | 2;
  onSwipe: (dir: "learned" | "unlearned") => void;
  showHint: boolean;
}

function SwipeCard({ card, stackIndex, onSwipe, showHint }: SwipeCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const c = COLOR[card.type];
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);

  // Overlay intensities
  const learnedBg = useTransform(x, [0, 130], [0, 0.88]);
  const unlearnedBg = useTransform(x, [-130, 0], [0.88, 0]);
  const learnedLabelOp = useTransform(x, [20, 100], [0, 1]);
  const unlearnedLabelOp = useTransform(x, [-100, -20], [1, 0]);
  const learnedLabelScale = useTransform(x, [20, 100], [0.6, 1]);
  const unlearnedLabelScale = useTransform(x, [-100, -20], [1, 0.6]);

  const isTop = stackIndex === 0;

  const swipeAway = useCallback(
    async (dir: "learned" | "unlearned") => {
      await controls.start({
        x: dir === "learned" ? 700 : -700,
        rotate: dir === "learned" ? 22 : -22,
        opacity: 0,
        transition: { duration: 0.38, ease: [0.25, 0.1, 0.25, 1] },
      });
      onSwipe(dir);
    },
    [controls, onSwipe]
  );

  const handleDragEnd = useCallback(
    async (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      setIsDragging(false);
      const { offset, velocity } = info;
      if (offset.x > 100 || velocity.x > 550) {
        await swipeAway("learned");
      } else if (offset.x < -100 || velocity.x < -550) {
        await swipeAway("unlearned");
      } else {
        controls.start({
          x: 0, rotate: 0,
          transition: { type: "spring", stiffness: 320, damping: 28 },
        });
      }
    },
    [controls, swipeAway]
  );

  const simulatePlay = () => {
    setAudioPlaying(true);
    setTimeout(() => setAudioPlaying(false), 1800);
  };

  if (stackIndex > 0) {
    // Background stack cards – static, show front color only
    return (
      <motion.div
        className="absolute inset-0"
        style={{ borderRadius: 24 }}
        animate={{
          scale: 1 - stackIndex * 0.038,
          y: stackIndex * 12,
          rotate: stackIndex === 1 ? 1.5 : -1.2,
          filter: `brightness(${1 - stackIndex * 0.1})`,
        }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        <div
          className="w-full h-full rounded-[24px] overflow-hidden"
          style={{
            background: c.gradient,
            boxShadow: `0 8px 24px ${c.glow}`,
          }}
        />
      </motion.div>
    );
  }

  // ── TOP (active) card ──────────────────────────────────────────────────────
  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, borderRadius: 24, zIndex: 10 }}
      animate={controls}
      drag={!isFlipped ? true : "x"} // allow drag on both sides
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.65}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => { if (!isDragging) setIsFlipped((v) => !v); }}
      whileDrag={{ scale: 1.02 }}
    >
      {/* ── "Gelernt" overlay (right drag) ──────────────────────── */}
      <motion.div
        className="absolute inset-0 rounded-[24px] flex items-center justify-start pl-6 z-20 pointer-events-none overflow-hidden"
        style={{ opacity: learnedBg, background: "rgba(39,174,96,0.18)" }}
      >
        {/* Green border flash */}
        <motion.div
          className="absolute inset-0 rounded-[24px]"
          style={{ border: "3px solid #27AE60", opacity: learnedBg }}
        />
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ opacity: learnedLabelOp, scale: learnedLabelScale }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#27AE60", boxShadow: "0 0 24px rgba(39,174,96,0.5)" }}
          >
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
          <span
            className="font-extrabold text-lg tracking-wide mt-1"
            style={{ color: "#27AE60", textShadow: "0 1px 8px rgba(39,174,96,0.3)" }}
          >
            Gelernt!
          </span>
        </motion.div>
      </motion.div>

      {/* ── "Lernen" overlay (left drag) ────────────────────────── */}
      <motion.div
        className="absolute inset-0 rounded-[24px] flex items-center justify-end pr-6 z-20 pointer-events-none overflow-hidden"
        style={{ opacity: unlearnedBg, background: "rgba(235,87,87,0.18)" }}
      >
        <motion.div
          className="absolute inset-0 rounded-[24px]"
          style={{ border: "3px solid #EB5757", opacity: unlearnedBg }}
        />
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ opacity: unlearnedLabelOp, scale: unlearnedLabelScale }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#EB5757", boxShadow: "0 0 24px rgba(235,87,87,0.5)" }}
          >
            <X size={32} className="text-white" strokeWidth={3} />
          </div>
          <span
            className="font-extrabold text-lg tracking-wide mt-1"
            style={{ color: "#EB5757", textShadow: "0 1px 8px rgba(235,87,87,0.3)" }}
          >
            Lernen!
          </span>
        </motion.div>
      </motion.div>

      {/* ── Card face (3D flip) ──────────────────────────────────── */}
      <div className="w-full h-full" style={{ perspective: 1200 }}>
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 22 }}
        >
          {/* ── FRONT ────────────────────────────────────────────── */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
              borderRadius: 24,
              background: c.gradient,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              boxShadow: `0 16px 48px ${c.glow}, 0 4px 0 ${c.dark}`,
            }}
          >
            {/* Decorative shapes */}
            <div className="absolute pointer-events-none">
              <div className="absolute rounded-full" style={{ top: -60, right: -60, width: 200, height: 200, background: "rgba(255,255,255,0.07)" }} />
              <div className="absolute rounded-full" style={{ bottom: -50, left: -50, width: 160, height: 160, background: "rgba(255,255,255,0.07)" }} />
            </div>
            {/* Dot grid */}
            <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }}>
              <defs>
                <pattern id={`g${card.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="4" cy="4" r="2" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#g${card.id})`} />
            </svg>

            <div className="relative flex flex-col h-full px-6 pt-6 pb-5">
              {/* Top row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {card.article ? (
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-bold"
                      style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)" }}
                    >
                      {card.article}
                    </span>
                  ) : (
                    <span
                      className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
                      style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)" }}
                    >
                      {c.label}
                    </span>
                  )}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)" }}
                >
                  {card.level}
                </span>
              </div>

              {/* Center: Word + phonetic */}
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                {/* Hint overlay */}
                <AnimatePresence>
                  {showHint && (
                    <motion.div
                      className="absolute inset-x-0 flex flex-col items-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <div
                        className="px-6 py-3 rounded-[16px] text-center"
                        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)" }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Hinweis</p>
                        <p className="text-white font-bold text-lg">{card.english}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.h1
                  className="font-black text-white leading-none text-center tracking-tight"
                  style={{
                    fontSize: card.word.length > 12 ? 36 : card.word.length > 8 ? 44 : 54,
                    letterSpacing: "-1.5px",
                    textShadow: "0 2px 16px rgba(0,0,0,0.15)",
                  }}
                >
                  {card.article ? `${card.article} ${card.word}` : card.word}
                </motion.h1>

                <span
                  className="mt-4 px-3 py-1.5 rounded-full text-sm font-mono"
                  style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  {card.phonetic}
                </span>
              </div>

              {/* Bottom: type label + flip hint */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)" }}
                >
                  {c.label} · {c.tag}
                </span>
                <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <RefreshCw size={11} />
                  <span className="text-[11px]">Antippen</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── BACK ─────────────────────────────────────────────── */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
              borderRadius: 24,
              background: "white",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.10), 0 4px 0 rgba(0,0,0,0.07)",
            }}
          >
            {/* Colored top header */}
            <div
              className="px-6 pt-5 pb-4 flex-shrink-0"
              style={{
                background: c.gradient,
                borderRadius: "24px 24px 0 0",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                      {c.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                      {card.level}
                    </span>
                  </div>
                  <h2
                    className="text-white font-black leading-tight tracking-tight"
                    style={{ fontSize: card.english.length > 12 ? 26 : 32, letterSpacing: "-0.5px" }}
                  >
                    {card.english}
                  </h2>
                </div>
                <motion.div
                  className="flex-shrink-0 w-16 h-16 rounded-[16px] flex items-center justify-center text-4xl"
                  style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)" }}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  {card.emoji}
                </motion.div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col px-6 py-4 gap-3 overflow-hidden">
              {/* Original word */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: "#94A3B8" }}>Deutsches Wort</p>
                  <p className="font-bold" style={{ color: "#0F172A" }}>
                    {card.article ? `${card.article} ${card.word}` : card.word}
                  </p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{card.phonetic}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); simulatePlay(); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium transition-all"
                  style={{
                    background: audioPlaying ? c.bg : "#F8FAFF",
                    color: audioPlaying ? c.primary : "#64748B",
                    border: `1.5px solid ${audioPlaying ? c.primary + "50" : "#E2E8F0"}`,
                  }}
                >
                  {audioPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      {[3, 6, 9, 6, 3].map((h, i) => (
                        <motion.div key={i} className="w-1 rounded-full" style={{ background: c.primary }}
                          animate={{ height: [h, h * 1.8, h] }}
                          transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.07 }} />
                      ))}
                    </div>
                  ) : (
                    <Volume2 size={13} />
                  )}
                  <span>{audioPlaying ? "..." : "Hören"}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="h-px" style={{ background: "#F0F4F8" }} />

              {/* Example sentence */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-[4px] flex items-center justify-center" style={{ background: c.light }}>
                    <span style={{ fontSize: 9, color: c.primary }}>S</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
                    Beispielsatz
                  </p>
                </div>
                <div
                  className="rounded-[14px] px-4 py-3"
                  style={{ background: c.light, border: `1.5px solid ${c.primary}22` }}
                >
                  <p className="text-sm font-semibold leading-snug mb-2" style={{ color: "#0F172A" }}>
                    🇩🇪 {card.sentence}
                  </p>
                  <div className="h-px mb-2" style={{ background: `${c.primary}20` }} />
                  <p className="text-xs italic leading-snug" style={{ color: "#64748B" }}>
                    🇬🇧 {card.sentenceEN}
                  </p>
                </div>
              </div>

              {/* Flip back hint */}
              <div className="flex items-center justify-center gap-1" style={{ color: "#CBD5E1" }}>
                <RefreshCw size={10} />
                <span className="text-[10px]">Antippen zum Zurueckklappen</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── State Preview Card (static mini card) ────────────────────────────────────

function MiniStateCard({
  label, sublabel, tilt, overlay, borderColor, icon
}: {
  label: string; sublabel: string;
  tilt: number;
  overlay: null | "learned" | "unlearned";
  borderColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: 96,
          height: 124,
          borderRadius: 16,
          transform: `rotate(${tilt}deg)`,
          background: "linear-gradient(145deg, #2D9CDB, #1A6A9A)",
          border: `3px solid ${borderColor}`,
          boxShadow: overlay
            ? `0 6px 20px ${borderColor}50`
            : "0 4px 12px rgba(0,0,0,0.1)",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Overlay */}
        {overlay && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: overlay === "learned" ? "rgba(39,174,96,0.28)" : "rgba(235,87,87,0.28)",
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: overlay === "learned" ? "#27AE60" : "#EB5757",
                boxShadow: `0 0 16px ${overlay === "learned" ? "rgba(39,174,96,0.5)" : "rgba(235,87,87,0.5)"}`,
              }}
            >
              {icon}
            </div>
          </div>
        )}

        {!overlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
            <span className="text-white font-black text-lg leading-tight text-center" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
              Der Tisch
            </span>
            <span className="text-white/60 text-[9px] font-mono mt-1">/tɪʃ/</span>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-bold" style={{ color: "#334155" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "#94A3B8" }}>{sublabel}</p>
      </div>
    </div>
  );
}

// ─── Session Complete ─────────────────────────────────────────────────────────

function SessionComplete({
  learned, unlearned, total, onRestart, onExit
}: {
  learned: number; unlearned: number; total: number;
  onRestart: () => void; onExit: () => void;
}) {
  const pct = Math.round((learned / total) * 100);

  return (
    <motion.div
      className="flex flex-col items-center gap-5 py-8"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
        style={{
          background: "linear-gradient(145deg, #FFCE00, #F59E0B)",
          boxShadow: "0 8px 0 0 #B45309, 0 12px 32px rgba(255,206,0,0.35)",
        }}
        initial={{ scale: 0, rotate: -25 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 18, delay: 0.1 }}
      >
        🏆
      </motion.div>

      <div className="text-center">
        <h2 className="font-extrabold text-2xl" style={{ color: "#00305E" }}>Sitzung beendet!</h2>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>Du hast alle {total} Karten durchgespielt</p>
      </div>

      <div className="w-full grid grid-cols-3 gap-3">
        {[
          { label: "Gelernt", val: learned, bg: "#E8F8F0", color: "#27AE60", icon: "✓" },
          { label: "Score", val: `${pct}%`, bg: "#EBF5FB", color: "#2D9CDB", icon: "%" },
          { label: "Lernen", val: unlearned, bg: "#FDEAEA", color: "#EB5757", icon: "↺" },
        ].map(({ label, val, bg, color, icon }) => (
          <div key={label} className="rounded-[16px] p-3 flex flex-col items-center gap-1"
            style={{ background: bg, border: `2px solid ${color}20` }}>
            <span className="font-black text-xl" style={{ color }}>{val}</span>
            <span className="text-[10px] font-semibold" style={{ color: "#64748B" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="w-full">
        <div className="flex justify-between mb-1.5 text-xs" style={{ color: "#94A3B8" }}>
          <span>Fortschritt</span><span>{pct}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "#FDEAEA" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #27AE60, #2D9CDB)" }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          />
        </div>
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={onRestart}
          className="w-full py-4 rounded-[16px] font-bold text-white flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #00305E, #004080)",
            boxShadow: "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)",
          }}
        >
          <RotateCcw size={16} /> Nochmal spielen
        </button>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-[16px] font-semibold flex items-center justify-center gap-2"
          style={{ background: "#F5F5F5", color: "#64748B", border: "2px solid #E2E8F0" }}
        >
          Zurueck
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SwipeCards() {
  const navigate = useNavigate();
  const [learnedIds, setLearnedIds] = useState<Set<number>>(new Set());
  const [unlearnedIds, setUnlearnedIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<CardType | "all">("all");
  const [showHint, setShowHint] = useState(false);
  const [hintTimeout, setHintTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const allCards = filterType === "all" ? DECK : DECK.filter((c) => c.type === filterType);
  const remaining = allCards.filter((c) => !learnedIds.has(c.id) && !unlearnedIds.has(c.id));

  const currentCard = remaining[0];
  const nextCard = remaining[1];
  const thirdCard = remaining[2];
  const total = allCards.length;
  const done = learnedIds.size + unlearnedIds.size;

  const handleSwipe = useCallback(
    (dir: "learned" | "unlearned") => {
      if (!currentCard) return;
      setShowHint(false);
      if (dir === "learned") {
        setLearnedIds((s) => new Set(s).add(currentCard.id));
      } else {
        setUnlearnedIds((s) => new Set(s).add(currentCard.id));
      }
      if (remaining.length <= 1) {
        setTimeout(() => setShowComplete(true), 200);
      }
    },
    [currentCard, remaining.length]
  );

  const handleHint = () => {
    if (hintTimeout) clearTimeout(hintTimeout);
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 2500);
    setHintTimeout(t);
  };

  const handleRestart = () => {
    setLearnedIds(new Set());
    setUnlearnedIds(new Set());
    setShowComplete(false);
  };

  const c = currentCard ? COLOR[currentCard.type] : COLOR.masculine;

  const filterOptions: Array<{ key: CardType | "all"; label: string; color: string }> = [
    { key: "all", label: "Alle", color: "#00305E" },
    { key: "masculine", label: "der", color: "#2D9CDB" },
    { key: "feminine", label: "die", color: "#EB5757" },
    { key: "neuter", label: "das", color: "#27AE60" },
    { key: "verb", label: "Verb", color: "#9B51E0" },
    { key: "adjective", label: "Adj.", color: "#F2994A" },
  ];

  return (
    <div
      className="min-h-screen flex items-start justify-center pb-24"
      style={{ background: "#F5F5F5" }}
    >
      <div className="w-full sm:max-w-[420px] min-h-screen flex flex-col">

        {/* ── Header ──────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 pt-5 pb-4 bg-white flex-shrink-0"
          style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-[10px] hover:bg-[#F5F5F5] transition-colors"
            style={{ color: "#64748B" }}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="text-center">
            <h1 className="font-extrabold text-[#00305E] text-base">Vokabeln lernen</h1>
            {!showComplete && (
              <p className="text-xs font-bold mt-0.5" style={{ color: currentCard ? c.primary : "#94A3B8" }}>
                {done + 1 > total ? total : done + 1} / {total} Karten
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "#FFF8E1", color: "#B45309", border: "1.5px solid #FDE68A" }}
            >
              {learnedIds.size}
            </div>
          </div>
        </header>

        {/* ── Progress Bar ─────────────────────────────────────────── */}
        {!showComplete && (
          <div className="px-5 py-3 bg-white border-b border-[#F0F4F8] flex-shrink-0">
            {/* Three-segment progress */}
            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden mb-2">
              {/* Learned (green) */}
              <motion.div
                className="rounded-l-full"
                style={{ background: "#27AE60" }}
                animate={{ width: `${(learnedIds.size / total) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
              {/* Unlearned (red) */}
              <motion.div
                style={{ background: "#EB5757" }}
                animate={{ width: `${(unlearnedIds.size / total) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
              {/* Remaining (gray) */}
              <div
                className="flex-1 rounded-r-full"
                style={{ background: "#E2E8F0", minWidth: 4 }}
              />
            </div>
            {/* Progress legend */}
            <div className="flex items-center gap-4 text-[10px] font-semibold">
              <span className="flex items-center gap-1" style={{ color: "#27AE60" }}>
                <span className="w-2 h-2 rounded-full bg-[#27AE60]" /> Gelernt: {learnedIds.size}
              </span>
              <span className="flex items-center gap-1" style={{ color: "#EB5757" }}>
                <span className="w-2 h-2 rounded-full bg-[#EB5757]" /> Lernen: {unlearnedIds.size}
              </span>
              <span className="flex items-center gap-1 ml-auto" style={{ color: "#94A3B8" }}>
                Verbleibend: {remaining.length}
              </span>
            </div>
          </div>
        )}

        {/* ── Filter chips ─────────────────────────────────────────── */}
        {!showComplete && (
          <div className="px-5 py-2.5 bg-white border-b border-[#F0F4F8] flex-shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {filterOptions.map(({ key, label, color }) => {
                const isActive = filterType === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setFilterType(key); setLearnedIds(new Set()); setUnlearnedIds(new Set()); setShowComplete(false); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                    style={{
                      background: isActive ? color : "white",
                      color: isActive ? "white" : color,
                      borderColor: isActive ? color : `${color}40`,
                      boxShadow: isActive ? `0 3px 8px ${color}35` : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col px-5 pt-5 pb-4 overflow-hidden">
          {showComplete ? (
            <SessionComplete
              learned={learnedIds.size}
              unlearned={unlearnedIds.size}
              total={total}
              onRestart={handleRestart}
              onExit={() => navigate("/")}
            />
          ) : (
            <>
              {/* ── Swipe Direction Labels ──────────────────────── */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "#FDEAEA", border: "1.5px solid #EB5757" }}
                  >
                    <X size={14} style={{ color: "#EB5757" }} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#EB5757" }}>← Noch nicht</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ color: "#27AE60" }}>Gelernt →</span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "#E8F8F0", border: "1.5px solid #27AE60" }}
                  >
                    <Check size={14} style={{ color: "#27AE60" }} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* ── Card Stack ──────────────────────────────────── */}
              {currentCard ? (
                <div className="relative flex-1" style={{ minHeight: 400 }}>
                  {/* Third card */}
                  {thirdCard && (
                    <SwipeCard key={`${thirdCard.id}-third`} card={thirdCard} stackIndex={2} onSwipe={() => {}} showHint={false} />
                  )}
                  {/* Second card */}
                  {nextCard && (
                    <SwipeCard key={`${nextCard.id}-second`} card={nextCard} stackIndex={1} onSwipe={() => {}} showHint={false} />
                  )}
                  {/* Active card */}
                  <AnimatePresence mode="wait">
                    <SwipeCard
                      key={currentCard.id}
                      card={currentCard}
                      stackIndex={0}
                      onSwipe={handleSwipe}
                      showHint={showHint}
                    />
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[#94A3B8] font-semibold">Alle Karten abgeschlossen!</p>
                </div>
              )}

              {/* ── Action Buttons ──────────────────────────────── */}
              <div className="mt-5 flex flex-col gap-3">
                {/* Main swipe buttons */}
                <div className="grid grid-cols-3 gap-3 items-center">
                  {/* Swipe Left Button */}
                  <motion.button
                    onClick={() => {
                      if (currentCard) {
                        setUnlearnedIds((s) => new Set(s).add(currentCard.id));
                        if (remaining.length <= 1) setTimeout(() => setShowComplete(true), 300);
                      }
                    }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-[18px]"
                    style={{
                      background: "white",
                      border: "2px solid #FECDD3",
                      boxShadow: "0 4px 0 0 #FECDD3",
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94, y: 4, boxShadow: "0 0px 0 0 #FECDD3" }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FFF1F2" }}>
                      <X size={20} style={{ color: "#EB5757" }} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: "#EB5757" }}>Noch nicht</span>
                  </motion.button>

                  {/* Hint button */}
                  <motion.button
                    onClick={handleHint}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-[18px]"
                    style={{
                      background: showHint ? "#FFF8E1" : "white",
                      border: `2px solid ${showHint ? "#FDE68A" : "#E2E8F0"}`,
                      boxShadow: showHint ? "0 4px 0 0 #FDE68A" : "0 4px 0 0 #E2E8F0",
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94, y: 4 }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: showHint ? "#FEF9C3" : "#F8FAFF" }}
                    >
                      <Lightbulb size={18} style={{ color: showHint ? "#D97706" : "#94A3B8" }} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: showHint ? "#D97706" : "#94A3B8" }}>
                      Hinweis
                    </span>
                  </motion.button>

                  {/* Swipe Right Button */}
                  <motion.button
                    onClick={() => {
                      if (currentCard) {
                        setLearnedIds((s) => new Set(s).add(currentCard.id));
                        if (remaining.length <= 1) setTimeout(() => setShowComplete(true), 300);
                      }
                    }}
                    className="flex flex-col items-center gap-1.5 py-3.5 rounded-[18px]"
                    style={{
                      background: "white",
                      border: "2px solid #BBF7D0",
                      boxShadow: "0 4px 0 0 #BBF7D0",
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94, y: 4, boxShadow: "0 0px 0 0 #BBF7D0" }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#F0FDF4" }}>
                      <Check size={20} style={{ color: "#27AE60" }} strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: "#27AE60" }}>Gelernt!</span>
                  </motion.button>
                </div>

                {/* Swipe hint text */}
                <p className="text-center text-[10px]" style={{ color: "#CBD5E1" }}>
                  Karte nach links oder rechts wischen · oder Antippen zum Umdrehen
                </p>
              </div>

              {/* ── 3 Visual State Preview ──────────────────────── */}
              <div
                className="mt-4 rounded-[20px] p-4"
                style={{ background: "white", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-3" style={{ color: "#94A3B8" }}>
                  Zustandsvorschau · UX-Flows
                </p>
                <div className="flex items-start justify-around">
                  <MiniStateCard
                    label="Neutral"
                    sublabel="Zentriert"
                    tilt={0}
                    overlay={null}
                    borderColor="#2D9CDB"
                    icon={null}
                  />
                  <MiniStateCard
                    label="← Noch nicht"
                    sublabel="Links wischen"
                    tilt={-13}
                    overlay="unlearned"
                    borderColor="#EB5757"
                    icon={<X size={18} className="text-white" strokeWidth={3} />}
                  />
                  <MiniStateCard
                    label="Gelernt →"
                    sublabel="Rechts wischen"
                    tilt={13}
                    overlay="learned"
                    borderColor="#27AE60"
                    icon={<Check size={18} className="text-white" strokeWidth={3} />}
                  />
                </div>

                {/* Color legend */}
                <div className="mt-4 pt-3 border-t border-[#F0F4F8]">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>Farb-Kodierung</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(["masculine", "feminine", "neuter", "verb", "adjective"] as CardType[]).map((type) => {
                      const cc = COLOR[type];
                      return (
                        <div key={type} className="flex flex-col items-center gap-1">
                          <div className="w-5 h-5 rounded-full" style={{ background: cc.gradient }} />
                          <p className="text-[8px] font-bold text-center" style={{ color: cc.dark }}>{cc.tag}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}