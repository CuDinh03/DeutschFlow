import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  Check,
  X,
  ChevronLeft,
  RotateCcw,
  RefreshCw,
  Volume2,
  Bookmark,
  BookOpen,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Gender = "masculine" | "feminine" | "neuter" | "verb" | "adjective";

interface Flashcard {
  id: number;
  gender: Gender;
  article?: string;
  word: string;
  category: string;
  english: string;
  phonetic: string;
  sentence: { de: string; en: string };
  emoji: string;
  level: "A1" | "A2" | "B1" | "B2";
  tags: string[];
}

// ─── Color Config ──────────────────────────────────────────────────────────────

const COLOR: Record<Gender, {
  primary: string; dark: string; light: string; bg: string;
  gradient: string; glow: string; label: string; articleBg: string;
}> = {
  masculine: {
    primary: "#2D9CDB", dark: "#1A6A9A", light: "#EBF5FB",
    bg: "#DBEEFF", gradient: "linear-gradient(145deg, #2D9CDB 0%, #1A6A9A 100%)",
    glow: "rgba(45,156,219,0.45)", label: "Maskulin · der",
    articleBg: "rgba(45,156,219,0.12)",
  },
  feminine: {
    primary: "#EB5757", dark: "#B03030", light: "#FDEAEA",
    bg: "#FFE5E5", gradient: "linear-gradient(145deg, #EB5757 0%, #B03030 100%)",
    glow: "rgba(235,87,87,0.45)", label: "Feminin · die",
    articleBg: "rgba(235,87,87,0.12)",
  },
  neuter: {
    primary: "#27AE60", dark: "#1A7A42", light: "#E8F8F0",
    bg: "#D5F5E3", gradient: "linear-gradient(145deg, #27AE60 0%, #1A7A42 100%)",
    glow: "rgba(39,174,96,0.45)", label: "Neutrum · das",
    articleBg: "rgba(39,174,96,0.12)",
  },
  verb: {
    primary: "#7C3AED", dark: "#5B21B6", light: "#F5F0FF",
    bg: "#EDE9FE", gradient: "linear-gradient(145deg, #7C3AED 0%, #5B21B6 100%)",
    glow: "rgba(124,58,237,0.45)", label: "Verb",
    articleBg: "rgba(124,58,237,0.12)",
  },
  adjective: {
    primary: "#64748B", dark: "#334155", light: "#F1F5F9",
    bg: "#E2E8F0", gradient: "linear-gradient(145deg, #64748B 0%, #334155 100%)",
    glow: "rgba(100,116,139,0.45)", label: "Adjektiv",
    articleBg: "rgba(100,116,139,0.12)",
  },
};

// ─── Flashcard Data ─────────────────────────────────────────────────────────────

const DECK: Flashcard[] = [
  { id: 1, gender: "masculine", article: "Der", word: "Apfel", category: "Nomen", english: "Apple", phonetic: "/ˈapfəl/", sentence: { de: "Der Apfel ist frisch und knackig.", en: "The apple is fresh and crispy." }, emoji: "🍎", level: "A1", tags: ["Essen", "Natur"] },
  { id: 2, gender: "feminine", article: "Die", word: "Schule", category: "Nomen", english: "School", phonetic: "/ˈʃuːlə/", sentence: { de: "Die Schule beginnt um acht Uhr morgens.", en: "School starts at eight in the morning." }, emoji: "🏫", level: "A1", tags: ["Bildung", "Alltag"] },
  { id: 3, gender: "neuter", article: "Das", word: "Fenster", category: "Nomen", english: "Window", phonetic: "/ˈfɛnstɐ/", sentence: { de: "Das Fenster ist weit offen.", en: "The window is wide open." }, emoji: "🪟", level: "A1", tags: ["Haus", "Alltag"] },
  { id: 4, gender: "verb", word: "lernen", category: "Verb", english: "to learn", phonetic: "/ˈlɛʁnən/", sentence: { de: "Ich lerne jeden Tag Deutsch.", en: "I learn German every day." }, emoji: "📖", level: "A1", tags: ["Bildung", "Aktion"] },
  { id: 5, gender: "masculine", article: "Der", word: "Bahnhof", category: "Nomen", english: "Train Station", phonetic: "/ˈbaːnˌhoːf/", sentence: { de: "Der Bahnhof liegt im Stadtzentrum.", en: "The train station is in the city center." }, emoji: "🚂", level: "A2", tags: ["Transport", "Stadt"] },
  { id: 6, gender: "feminine", article: "Die", word: "Sprache", category: "Nomen", english: "Language", phonetic: "/ˈʃpʁaːxə/", sentence: { de: "Die Sprache ist sehr schoen.", en: "The language is very beautiful." }, emoji: "💬", level: "A2", tags: ["Kommunikation"] },
  { id: 7, gender: "neuter", article: "Das", word: "Wasser", category: "Nomen", english: "Water", phonetic: "/ˈvasɐ/", sentence: { de: "Das Wasser ist klar und kalt.", en: "The water is clear and cold." }, emoji: "💧", level: "A1", tags: ["Natur", "Alltag"] },
  { id: 8, gender: "adjective", word: "interessant", category: "Adjektiv", english: "Interesting", phonetic: "/ɪntʁəˈsant/", sentence: { de: "Das Buch ist sehr interessant.", en: "The book is very interesting." }, emoji: "✨", level: "A2", tags: ["Beschreibung"] },
  { id: 9, gender: "masculine", article: "Der", word: "Schluessel", category: "Nomen", english: "Key", phonetic: "/ˈʃlʏsəl/", sentence: { de: "Der Schluessel liegt auf dem Tisch.", en: "The key is lying on the table." }, emoji: "🔑", level: "A1", tags: ["Haus", "Alltag"] },
  { id: 10, gender: "feminine", article: "Die", word: "Katze", category: "Nomen", english: "Cat", phonetic: "/ˈkatsə/", sentence: { de: "Die Katze schlaeft auf dem Sofa.", en: "The cat is sleeping on the sofa." }, emoji: "🐱", level: "A1", tags: ["Tiere", "Alltag"] },
  { id: 11, gender: "neuter", article: "Das", word: "Buch", category: "Nomen", english: "Book", phonetic: "/buːx/", sentence: { de: "Das Buch ist sehr spannend.", en: "The book is very exciting." }, emoji: "📚", level: "A1", tags: ["Bildung", "Medien"] },
  { id: 12, gender: "verb", word: "schreiben", category: "Verb", english: "to write", phonetic: "/ˈʃʁaɪ̯bən/", sentence: { de: "Er schreibt einen langen Brief.", en: "He is writing a long letter." }, emoji: "✍️", level: "A1", tags: ["Aktion", "Kommunikation"] },
];

// ─── Card Front ────────────────────────────────────────────────────────────────

function CardFront({ card }: { card: Flashcard }) {
  const c = COLOR[card.gender];
  return (
    <div
      className="absolute inset-0 overflow-hidden flex flex-col"
      style={{
        borderRadius: 24, background: c.gradient,
        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
        boxShadow: `0 20px 60px ${c.glow}, 0 4px 0 ${c.dark}`,
      }}
    >
      <div className="absolute pointer-events-none">
        <div className="absolute rounded-full" style={{ top: -80, right: -80, width: 240, height: 240, background: "rgba(255,255,255,0.07)" }} />
        <div className="absolute rounded-full" style={{ bottom: -60, left: -60, width: 180, height: 180, background: "rgba(255,255,255,0.07)" }} />
      </div>
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]">
        <defs>
          <pattern id={`fc-dots-${card.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="2" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#fc-dots-${card.id})`} />
      </svg>
      <div className="relative flex flex-col h-full px-7 pt-7 pb-6">
        <div className="flex items-center justify-between mb-2">
          {card.article ? (
            <span className="px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)", backdropFilter: "blur(8px)" }}>
              {card.article}
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1.5px solid rgba(255,255,255,0.3)" }}>
              {card.category}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)" }}>
            {card.level}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <h1 className="font-black leading-none tracking-tight text-white"
            style={{ fontSize: card.word.length > 12 ? 36 : card.word.length > 8 ? 44 : 52, letterSpacing: "-1.5px", textShadow: "0 2px 16px rgba(0,0,0,0.15)" }}>
            {card.article ? `${card.article} ${card.word}` : card.word}
          </h1>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm font-mono px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)" }}>
              {card.phonetic}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{c.label}</span>
          <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            <RefreshCw size={11} />
            <span className="text-xs">Tippe zum Umdrehen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Back ──────────────────────────────────────────────────────────────────

function CardBack({ card }: { card: Flashcard }) {
  const c = COLOR[card.gender];
  const [audioPlaying, setAudioPlaying] = useState(false);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAudioPlaying(true);
    setTimeout(() => setAudioPlaying(false), 1800);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        borderRadius: 24, background: "white",
        backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10), 0 4px 0 rgba(0,0,0,0.08)",
      }}
    >
      <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ background: c.gradient, borderRadius: "24px 24px 0 0" }}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{card.category}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>{card.level}</span>
            </div>
            <h2 className="text-white font-black leading-tight tracking-tight" style={{ fontSize: card.english.length > 12 ? 28 : 34, letterSpacing: "-0.5px" }}>
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
      <div className="flex-1 flex flex-col px-6 py-4 gap-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#94A3B8" }}>Deutsches Wort</p>
            <p className="font-bold text-base" style={{ color: "#0F172A" }}>{card.article ? `${card.article} ${card.word}` : card.word}</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{card.phonetic}</p>
          </div>
          <button
            onClick={playAudio}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[12px] font-medium text-sm transition-all"
            style={{ background: audioPlaying ? c.bg : "#F8FAFF", color: audioPlaying ? c.primary : "#64748B", border: `1.5px solid ${audioPlaying ? c.primary + "50" : "#E2E8F0"}` }}
          >
            {audioPlaying ? (
              <div className="flex items-end gap-0.5 h-4">
                {[4, 7, 11, 8, 5].map((h, i) => (
                  <motion.div key={i} className="w-1 rounded-full" style={{ background: c.primary }}
                    animate={{ height: [h, h * 1.8, h] }}
                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.07 }} />
                ))}
              </div>
            ) : <Volume2 size={14} />}
            <span className="text-xs">{audioPlaying ? "Absp..." : "Hören"}</span>
          </button>
        </div>
        <div className="h-px" style={{ background: "#F0F4F8" }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: c.light }}>
              <BookOpen size={11} style={{ color: c.primary }} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Beispielsatz</p>
          </div>
          <div className="rounded-[14px] px-4 py-3.5" style={{ background: c.light, border: `1.5px solid ${c.primary}22` }}>
            <p className="text-sm font-semibold leading-snug mb-2" style={{ color: "#0F172A" }}>🇩🇪 {card.sentence.de}</p>
            <div className="h-px mb-2" style={{ background: `${c.primary}20` }} />
            <p className="text-xs italic leading-snug" style={{ color: "#64748B" }}>🇬🇧 {card.sentence.en}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: c.articleBg, color: c.dark }}>
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Flippable Card (with stack position) ──────────────────────────────────────

function FlippableCard({ card, isFlipped, onFlip, stackOffset }: {
  card: Flashcard; isFlipped: boolean; onFlip: () => void; stackOffset: 0 | 1 | 2;
}) {
  const c = COLOR[card.gender];
  const isStack = stackOffset > 0;

  return (
    <motion.div
      className="absolute left-0 right-0 cursor-pointer"
      style={{ height: 420, zIndex: 3 - stackOffset, top: stackOffset * 10, transformOrigin: "center bottom" }}
      initial={false}
      animate={{
        scale: 1 - stackOffset * 0.038,
        rotate: stackOffset === 1 ? 1.5 : stackOffset === 2 ? -1 : 0,
        filter: isStack ? "brightness(0.88)" : "brightness(1)",
      }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
    >
      {isStack ? (
        <div className="w-full h-full overflow-hidden" style={{ borderRadius: 24, background: c.gradient, boxShadow: `0 12px 32px ${c.glow}80` }} />
      ) : (
        <div className="w-full h-full" style={{ perspective: 1200 }} onClick={onFlip}>
          <motion.div
            className="relative w-full h-full"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22, duration: 0.55 }}
          >
            <CardFront card={card} />
            <CardBack card={card} />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Variant Showcase Row ──────────────────────────────────────────────────────

function VariantShowcase({ onSelectGender }: { onSelectGender: (g: Gender) => void }) {
  const items: Array<{ gender: Gender; article: string; word: string; emoji: string }> = [
    { gender: "masculine", article: "Der", word: "Apfel", emoji: "🍎" },
    { gender: "feminine", article: "Die", word: "Schule", emoji: "🏫" },
    { gender: "neuter", article: "Das", word: "Buch", emoji: "📚" },
    { gender: "verb", article: "", word: "lernen", emoji: "📖" },
    { gender: "adjective", article: "", word: "schoen", emoji: "✨" },
  ];
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map((item) => {
        const c = COLOR[item.gender];
        return (
          <motion.button key={item.gender} onClick={() => onSelectGender(item.gender)}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-[16px] transition-all"
            style={{ background: c.light, border: `2px solid ${c.primary}30`, width: 88 }}
            whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
          >
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-xl" style={{ background: c.gradient, boxShadow: `0 4px 10px ${c.glow}` }}>
              {item.emoji}
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: c.dark }}>{item.article || item.gender.slice(0, 3)}</p>
              <p className="text-xs font-bold" style={{ color: "#0F172A" }}>{item.word}</p>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: c.gradient }} />
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────

function SessionComplete({ knownCount, studyAgainCount, total, onRestart, onExit }: {
  knownCount: number; studyAgainCount: number; total: number;
  onRestart: () => void; onExit: () => void;
}) {
  const pct = Math.round((knownCount / total) * 100);
  const size = 148, radius = 56;
  const circ = 2 * Math.PI * radius;

  return (
    <motion.div className="flex flex-col items-center gap-6 py-8 px-4"
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}>
      <motion.div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl"
        style={{ background: "linear-gradient(145deg, #FFCE00, #F59E0B)", boxShadow: "0 8px 0 0 #B45309, 0 14px 40px rgba(255,206,0,0.4)" }}
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}>
        🏆
      </motion.div>
      <div className="text-center">
        <h2 className="font-extrabold text-2xl text-[#00305E]">Sitzung beendet!</h2>
        <p className="text-[#64748B] text-sm mt-1">Alle {total} Karten durchgegangen</p>
      </div>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="fc-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2D9CDB" />
            <stop offset="100%" stopColor="#27AE60" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={10} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#fc-score-grad)"
          strokeWidth={10} strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle"
          style={{ fontSize: 26, fontWeight: 900, fill: "#00305E", transform: `rotate(90deg) translate(0, -${size}px)` }}>
          {pct}%
        </text>
      </svg>
      <div className="w-full grid grid-cols-3 gap-3">
        {[
          { label: "Gelernt", value: knownCount, color: "#27AE60", bg: "#E8F8F0" },
          { label: "Score", value: `${pct}%`, color: "#2D9CDB", bg: "#EBF5FB" },
          { label: "Wiederholen", value: studyAgainCount, color: "#EB5757", bg: "#FDEAEA" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-[16px] p-3 flex flex-col items-center gap-1"
            style={{ background: bg, border: `2px solid ${color}20` }}>
            <span className="text-lg font-black" style={{ color }}>{value}</span>
            <span className="text-[10px] font-semibold text-center" style={{ color: "#64748B" }}>{label}</span>
          </div>
        ))}
      </div>
      <div className="w-full flex flex-col gap-3">
        <button onClick={onRestart}
          className="w-full py-4 rounded-[16px] font-bold text-white flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #00305E, #004080)", boxShadow: "0 5px 0 0 #002447" }}>
          <RotateCcw size={16} /> Nochmal spielen
        </button>
        <button onClick={onExit}
          className="w-full py-3 rounded-[16px] font-semibold flex items-center justify-center gap-2"
          style={{ background: "#F5F7FA", color: "#64748B", border: "2px solid #E2E8F0" }}>
          <ChevronLeft size={16} /> Zurueck
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Flashcards() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [studyAgain, setStudyAgain] = useState<Set<number>>(new Set());
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [filterGender, setFilterGender] = useState<Gender | "all">("all");
  const [showComplete, setShowComplete] = useState(false);

  const displayDeck = filterGender === "all" ? DECK : DECK.filter((c) => c.gender === filterGender);
  const current = displayDeck[currentIndex];
  const total = displayDeck.length;
  const isLast = currentIndex >= total - 1;
  const progress = (currentIndex / total) * 100;
  const c = current ? COLOR[current.gender] : COLOR.masculine;

  const advance = (dir: "left" | "right", markKnown: boolean) => {
    if (!current) return;
    setExitDir(dir);
    if (markKnown) setKnown((s) => new Set(s).add(current.id));
    else setStudyAgain((s) => new Set(s).add(current.id));
    setTimeout(() => {
      setIsFlipped(false);
      setExitDir(null);
      if (isLast) setShowComplete(true);
      else setCurrentIndex((i) => i + 1);
    }, 320);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setKnown(new Set());
    setStudyAgain(new Set());
    setIsFlipped(false);
    setExitDir(null);
    setShowComplete(false);
  };

  return (
    <div className="min-h-screen flex items-start justify-center pb-24" style={{ background: "linear-gradient(180deg, #F0F4FC 0%, #FAFBFF 60%, #F0F4FC 100%)" }}>
      <div className="w-full sm:max-w-[420px] min-h-screen flex flex-col">

        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-5 pb-4 bg-white flex-shrink-0" style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.06)" }}>
          <button onClick={() => navigate("/")} className="p-2 rounded-[10px] hover:bg-[#F5F7FA] transition-colors" style={{ color: "#64748B" }}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <h1 className="font-extrabold text-[#00305E] text-base">Vokabular-Karten</h1>
            {!showComplete && <p className="text-[11px] text-[#94A3B8]">{currentIndex + 1} / {total} Karten</p>}
          </div>
          <button className="p-2 rounded-[10px] hover:bg-[#F5F7FA] transition-colors" style={{ color: "#94A3B8" }}>
            <Bookmark size={18} />
          </button>
        </header>

        {/* Progress */}
        {!showComplete && (
          <div className="px-5 py-2 bg-white border-b border-[#F0F4F8] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-[#F0F4F8] overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: c.gradient }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
              </div>
              <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                <span className="flex items-center gap-1 font-semibold" style={{ color: "#27AE60" }}>
                  <Check size={11} /> {known.size}
                </span>
                <span className="flex items-center gap-1 font-semibold" style={{ color: "#EB5757" }}>
                  <X size={11} /> {studyAgain.size}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 flex flex-col">
          {showComplete ? (
            <SessionComplete
              knownCount={known.size} studyAgainCount={studyAgain.size} total={total}
              onRestart={handleRestart} onExit={() => navigate("/")}
            />
          ) : (
            <>
              {/* Variant Showcase */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Grammatik-Varianten</p>
                  {filterGender !== "all" && (
                    <button onClick={() => setFilterGender("all")} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#F1F4F9", color: "#64748B" }}>
                      Alle ×
                    </button>
                  )}
                </div>
                <VariantShowcase onSelectGender={(g) => { setFilterGender((p) => p === g ? "all" : g); setCurrentIndex(0); setIsFlipped(false); }} />
              </div>

              {/* Card Stack */}
              {current && (
                <div className="flex-1 flex flex-col">
                  <div className="relative" style={{ minHeight: 460 }}>
                    {displayDeck[currentIndex + 2] && <FlippableCard key={`${displayDeck[currentIndex + 2].id}-2`} card={displayDeck[currentIndex + 2]} isFlipped={false} onFlip={() => {}} stackOffset={2} />}
                    {displayDeck[currentIndex + 1] && <FlippableCard key={`${displayDeck[currentIndex + 1].id}-1`} card={displayDeck[currentIndex + 1]} isFlipped={false} onFlip={() => {}} stackOffset={1} />}
                    <AnimatePresence mode="wait">
                      <motion.div key={current.id} className="absolute inset-x-0" style={{ height: 420, zIndex: 10 }}
                        initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, x: exitDir === "right" ? 320 : exitDir === "left" ? -320 : 0, rotate: exitDir === "right" ? 12 : exitDir === "left" ? -12 : 0, scale: 0.88 }}
                        transition={{ type: "spring", stiffness: 220, damping: 22, duration: 0.32 }}>
                        <FlippableCard card={current} isFlipped={isFlipped} onFlip={() => setIsFlipped((v) => !v)} stackOffset={0} />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <motion.button onClick={() => advance("left", false)}
                      className="flex flex-col items-center gap-2.5 py-4 rounded-[20px]"
                      style={{ background: "white", border: "2px solid #FECDD3", boxShadow: "0 4px 0 0 #FECDD3" }}
                      whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.96, y: 4, boxShadow: "0 1px 0 0 #FECDD3" }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#FFF1F2", border: "2px solid #FECDD3" }}>
                        <X size={22} style={{ color: "#EB5757" }} strokeWidth={2.5} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: "#EB5757" }}>Nochmal</p>
                        <p className="text-[10px]" style={{ color: "#94A3B8" }}>Weiter lernen</p>
                      </div>
                    </motion.button>
                    <motion.button onClick={() => advance("right", true)}
                      className="flex flex-col items-center gap-2.5 py-4 rounded-[20px]"
                      style={{ background: "white", border: "2px solid #BBF7D0", boxShadow: "0 4px 0 0 #BBF7D0" }}
                      whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.96, y: 4, boxShadow: "0 1px 0 0 #BBF7D0" }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#F0FDF4", border: "2px solid #BBF7D0" }}>
                        <Check size={22} style={{ color: "#27AE60" }} strokeWidth={2.5} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm" style={{ color: "#27AE60" }}>Ich weiss es!</p>
                        <p className="text-[10px]" style={{ color: "#94A3B8" }}>Weiter</p>
                      </div>
                    </motion.button>
                  </div>

                  {/* Color legend */}
                  <div className="mt-5 rounded-[16px] p-4" style={{ background: "white", border: "1.5px solid #E2E8F0" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Grammatisches Geschlecht</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["masculine", "feminine", "neuter"] as Gender[]).map((g) => {
                        const gc = COLOR[g];
                        const lbl = { masculine: "Maskulin · der", feminine: "Feminin · die", neuter: "Neutrum · das" };
                        return (
                          <div key={g} className="flex flex-col items-center gap-1.5 p-2.5 rounded-[12px]"
                            style={{ background: gc.light, border: `1.5px solid ${gc.primary}25` }}>
                            <div className="w-6 h-6 rounded-full" style={{ background: gc.gradient }} />
                            <p className="text-[9px] font-bold text-center leading-tight" style={{ color: gc.dark }}>{lbl[g]}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}