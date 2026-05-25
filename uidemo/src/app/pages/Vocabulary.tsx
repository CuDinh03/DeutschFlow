import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  Search,
  BookOpen,
  X,
  Play,
  Pause,
  Volume2,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ChevronDown,
  Layers,
  Zap,
  Box,
  Star,
  Filter,
  LayoutGrid,
  List,
  Bell,
  ArrowLeft,
  Mic,
  Globe,
  MoreHorizontal,
  Hash,
  AlignLeft,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = "der" | "die" | "das";
type Level = "A1" | "A2" | "B1" | "B2";
type Category = "IT" | "Alltag" | "Business" | "Reisen" | "Grammatik";

interface VocabItem {
  id: number;
  word: string;
  article: Gender;
  english: string;
  phonetic: string;
  category: Category;
  level: Level;
  meaning: string;
  exampleDE: string;
  exampleEN: string;
  exampleBold: string; // the word to bold in the example
  tags: string[];
}

// ─── Vocabulary Data ──────────────────────────────────────────────────────────

const VOCAB: VocabItem[] = [
  {
    id: 1,
    word: "die Schnittstelle",
    article: "die",
    english: "interface",
    phonetic: "/ˈʃnɪtˌʃtɛlə/",
    category: "IT",
    level: "B1",
    meaning: "A point of interaction between components; a connection or interface in software development (IT). Used to describe how different systems or modules communicate.",
    exampleDE: "Der Java-Developer fixiert die Schnittstelle des Microservices.",
    exampleEN: "The Java developer fixes the interface of the microservice.",
    exampleBold: "Schnittstelle",
    tags: ["Software", "API", "Backend"],
  },
  {
    id: 2,
    word: "der Algorithmus",
    article: "der",
    english: "algorithm",
    phonetic: "/alɡoˈʁɪtmʊs/",
    category: "IT",
    level: "B2",
    meaning: "A finite sequence of well-defined, computer-implementable instructions for solving a class of problems.",
    exampleDE: "Der Algorithmus sortiert die Daten in wenigen Millisekunden.",
    exampleEN: "The algorithm sorts the data in just a few milliseconds.",
    exampleBold: "Algorithmus",
    tags: ["Coding", "Logic", "Math"],
  },
  {
    id: 3,
    word: "die Datenbank",
    article: "die",
    english: "database",
    phonetic: "/ˈdaːtənˌbaŋk/",
    category: "IT",
    level: "A2",
    meaning: "An organized collection of structured data stored electronically. Used in nearly every software application.",
    exampleDE: "Wir speichern alle Nutzerdaten in einer relationalen Datenbank.",
    exampleEN: "We store all user data in a relational database.",
    exampleBold: "Datenbank",
    tags: ["SQL", "Storage", "Backend"],
  },
  {
    id: 4,
    word: "das Netzwerk",
    article: "das",
    english: "network",
    phonetic: "/ˈnɛtsvɛʁk/",
    category: "IT",
    level: "A2",
    meaning: "A group of interconnected computers or devices that share resources and communicate with each other.",
    exampleDE: "Das Netzwerk des Unternehmens wurde erfolgreich aktualisiert.",
    exampleEN: "The company's network was successfully updated.",
    exampleBold: "Netzwerk",
    tags: ["Infrastructure", "Cloud", "IT"],
  },
  {
    id: 5,
    word: "der Entwickler",
    article: "der",
    english: "developer",
    phonetic: "/ɛntˈvɪklɐ/",
    category: "IT",
    level: "A2",
    meaning: "A person who writes and tests software code. Can be a frontend, backend, or full-stack developer.",
    exampleDE: "Der Entwickler hat das neue Feature in zwei Tagen fertiggestellt.",
    exampleEN: "The developer completed the new feature in two days.",
    exampleBold: "Entwickler",
    tags: ["Job", "Coding", "Team"],
  },
  {
    id: 6,
    word: "die Sitzung",
    article: "die",
    english: "session / meeting",
    phonetic: "/ˈzɪtsʊŋ/",
    category: "Business",
    level: "B1",
    meaning: "A formal meeting or an authenticated user session in software (HTTP session). Context-dependent meaning.",
    exampleDE: "Die Sitzung des Teams beginnt um 10 Uhr morgens.",
    exampleEN: "The team meeting begins at 10 o'clock in the morning.",
    exampleBold: "Sitzung",
    tags: ["Meeting", "Work", "Session"],
  },
  {
    id: 7,
    word: "der Bahnhof",
    article: "der",
    english: "train station",
    phonetic: "/ˈbaːnˌhoːf/",
    category: "Reisen",
    level: "A1",
    meaning: "A railway station; a building where trains stop to allow passengers to board and alight.",
    exampleDE: "Ich treffe dich am Bahnhof um 15 Uhr.",
    exampleEN: "I will meet you at the train station at 3 PM.",
    exampleBold: "Bahnhof",
    tags: ["Transport", "Reisen", "City"],
  },
  {
    id: 8,
    word: "das Unternehmen",
    article: "das",
    english: "company / enterprise",
    phonetic: "/ʊntɐˈneːmən/",
    category: "Business",
    level: "B1",
    meaning: "A legal entity engaged in commercial, industrial, or professional activities. Can range from startups to multinationals.",
    exampleDE: "Das Unternehmen wurde im Jahr 2010 gegründet.",
    exampleEN: "The company was founded in 2010.",
    exampleBold: "Unternehmen",
    tags: ["Business", "Startup", "Economy"],
  },
  {
    id: 9,
    word: "die Verbindung",
    article: "die",
    english: "connection / link",
    phonetic: "/fɛʁˈbɪndʊŋ/",
    category: "IT",
    level: "B1",
    meaning: "A link or connection between two systems, devices, or people. Used in both technical and social contexts.",
    exampleDE: "Die Verbindung zum Server ist unterbrochen.",
    exampleEN: "The connection to the server is interrupted.",
    exampleBold: "Verbindung",
    tags: ["Network", "IT", "Social"],
  },
  {
    id: 10,
    word: "die Besprechung",
    article: "die",
    english: "discussion / briefing",
    phonetic: "/bəˈʃpʁɛçʊŋ/",
    category: "Business",
    level: "B1",
    meaning: "A formal discussion or briefing in a professional setting. More formal than a casual conversation.",
    exampleDE: "Die Besprechung mit dem Kunden war sehr produktiv.",
    exampleEN: "The discussion with the client was very productive.",
    exampleBold: "Besprechung",
    tags: ["Work", "Client", "Meeting"],
  },
  {
    id: 11,
    word: "das Gespräch",
    article: "das",
    english: "conversation",
    phonetic: "/ɡəˈʃpʁɛːç/",
    category: "Alltag",
    level: "A1",
    meaning: "An exchange of words between two or more people; a conversation or talk in everyday life.",
    exampleDE: "Das Gespräch mit meinem Chef verlief sehr gut.",
    exampleEN: "The conversation with my boss went very well.",
    exampleBold: "Gespräch",
    tags: ["Communication", "Everyday", "Social"],
  },
  {
    id: 12,
    word: "der Speicher",
    article: "der",
    english: "storage / memory",
    phonetic: "/ˈʃpaɪ̯çɐ/",
    category: "IT",
    level: "A2",
    meaning: "Storage space in a computer's memory or on a hard drive. Also means a physical storage room.",
    exampleDE: "Der Speicher des Laptops ist fast voll.",
    exampleEN: "The laptop's storage is almost full.",
    exampleBold: "Speicher",
    tags: ["Hardware", "Memory", "IT"],
  },
];

const CATEGORIES: (Category | "Alle")[] = ["Alle", "IT", "Business", "Alltag", "Reisen", "Grammatik"];
const LEVELS: (Level | "Alle")[] = ["Alle", "A1", "A2", "B1", "B2"];

// ─── Gender Config ────────────────────────────────────────────────────────────

const GENDER_CONFIG: Record<Gender, { bg: string; text: string; border: string; dot: string }> = {
  der: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", dot: "#3B82F6" },
  die: { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3", dot: "#F43F5E" },
  das: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0", dot: "#10B981" },
};

const LEVEL_CONFIG: Record<Level, { bg: string; text: string }> = {
  A1: { bg: "#F0FDF4", text: "#166534" },
  A2: { bg: "#EFF6FF", text: "#1D4ED8" },
  B1: { bg: "#FFF8E1", text: "#92400E" },
  B2: { bg: "#F5F3FF", text: "#4C1D95" },
};

// ─── Waveform Bars ────────────────────────────────────────────────────────────

const WAVEFORM_BARS = [
  3, 6, 10, 16, 22, 28, 32, 36, 30, 26, 34, 38, 32, 28, 22, 18, 26, 34, 38, 34,
  28, 22, 30, 36, 32, 26, 20, 16, 12, 18, 22, 28, 24, 18, 14, 10, 7, 5, 8, 12,
  16, 20, 14, 10, 7, 5, 6, 9, 12, 8,
];

function WaveformVisualizer({ isPlaying, progress }: { isPlaying: boolean; progress: number }) {
  const playedCount = Math.floor(WAVEFORM_BARS.length * progress);

  return (
    <div className="flex items-center gap-[2.5px] h-12 px-1">
      {WAVEFORM_BARS.map((h, i) => (
        <motion.div
          key={i}
          className="rounded-full flex-shrink-0"
          style={{
            width: 3,
            height: h,
            background: i < playedCount ? "#FFCE00" : "#CBD5E1",
            transformOrigin: "center",
          }}
          animate={isPlaying && Math.abs(i - playedCount) < 5 ? { scaleY: [1, 1.4, 1] } : { scaleY: 1 }}
          transition={{
            duration: 0.35,
            repeat: isPlaying && Math.abs(i - playedCount) < 5 ? Infinity : 0,
            delay: (i % 3) * 0.07,
          }}
        />
      ))}
    </div>
  );
}

// ─── Hierarchy Tree ───────────────────────────────────────────────────────────

interface TreeNode {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  children?: TreeNode[];
}

function TreeItem({ node, depth = 0, isLast = false }: { node: TreeNode; depth?: number; isLast?: boolean }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2.5 py-2 px-2 rounded-[8px] hover:bg-[#F8FAFF] cursor-pointer group transition-colors"
        style={{ paddingLeft: depth > 0 ? depth * 20 + 8 : 8 }}
        onClick={() => hasChildren && setOpen((v) => !v)}
      >
        {/* Connector lines */}
        {depth > 0 && (
          <>
            <div
              className="absolute"
              style={{
                left: depth * 20 - 4,
                top: 0,
                bottom: isLast ? "50%" : 0,
                width: 1.5,
                background: "#E2E8F0",
              }}
            />
            <div
              className="absolute"
              style={{
                left: depth * 20 - 4,
                top: "50%",
                width: 12,
                height: 1.5,
                background: "#E2E8F0",
              }}
            />
          </>
        )}

        {/* Expand icon */}
        {hasChildren ? (
          <div className="w-4 h-4 flex-shrink-0">
            <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight size={14} className="text-[#94A3B8]" />
            </motion.div>
          </div>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <div
          className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ background: `${node.color}18`, border: `1.5px solid ${node.color}30` }}
        >
          <span style={{ color: node.color }}>{node.icon}</span>
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0F172A] leading-tight truncate">{node.label}</p>
          <p className="text-[10px] text-[#94A3B8] leading-tight">{node.sublabel}</p>
        </div>

        {/* Tag */}
        {depth === 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `${node.color}18`, color: node.color }}>
            root
          </span>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {open && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children!.map((child, i) => (
              <TreeItem
                key={i}
                node={child}
                depth={depth + 1}
                isLast={i === node.children!.length - 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HierarchyTree({ item }: { item: VocabItem }) {
  const genderColor = GENDER_CONFIG[item.article].dot;

  const treeData: TreeNode = {
    label: "Interaktionszustand",
    sublabel: "Interaction State",
    icon: <Zap size={13} />,
    color: "#7C4DFF",
    children: [
      {
        label: "Komponentenzustand",
        sublabel: "Component State",
        icon: <Layers size={13} />,
        color: "#00305E",
        children: [
          {
            label: "Komponenten-Hero",
            sublabel: "Component Hero",
            icon: <Star size={13} />,
            color: "#FFCE00",
            children: [
              {
                label: item.word,
                sublabel: item.english + " · " + item.article,
                icon: <Hash size={11} />,
                color: genderColor,
              },
              {
                label: item.article.charAt(0).toUpperCase() + item.article.slice(1) + " (Artikel)",
                sublabel: "Grammatical gender",
                icon: <AlignLeft size={11} />,
                color: genderColor,
              },
            ],
          },
        ],
      },
    ],
  };

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ background: "#F8FAFF", border: "1.5px solid #E2E8F0" }}
    >
      <TreeItem node={treeData} />
    </div>
  );
}

// ─── Vocab Card ───────────────────────────────────────────────────────────────

function VocabCard({
  item,
  onClick,
  isSelected,
  showCursor,
}: {
  item: VocabItem;
  onClick: () => void;
  isSelected: boolean;
  showCursor: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const gender = GENDER_CONFIG[item.article];
  const level = LEVEL_CONFIG[item.level];

  return (
    <motion.div
      className="relative bg-white rounded-[16px] flex flex-col cursor-pointer overflow-visible"
      style={{
        border: isSelected
          ? "2px solid #00305E"
          : hovered
          ? "2px solid #CBD5E1"
          : "2px solid #E2E8F0",
        boxShadow: isSelected
          ? "0 8px 32px rgba(0,48,94,0.16), 0 0 0 3px rgba(0,48,94,0.08)"
          : hovered
          ? "0 8px 24px rgba(0,48,94,0.1)"
          : "0 2px 8px rgba(0,48,94,0.05)",
        transition: "all 0.2s ease",
      }}
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Selected indicator stripe */}
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[14px]"
          style={{ background: "linear-gradient(90deg, #00305E, #004080)" }} />
      )}

      {/* Card Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        {/* Gender + Level badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
            style={{ background: gender.bg, color: gender.text, borderColor: gender.border }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: gender.dot }} />
            {item.article}
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: level.bg, color: level.text }}
          >
            {item.level}
          </span>
        </div>

        {/* Bookmark */}
        <button
          onClick={(e) => { e.stopPropagation(); setBookmarked((v) => !v); }}
          className="p-1 rounded-[6px] hover:bg-[#F5F7FA] transition-colors"
        >
          {bookmarked
            ? <BookmarkCheck size={16} className="text-[#FFCE00]" fill="#FFCE00" />
            : <Bookmark size={16} className="text-[#CBD5E1] hover:text-[#94A3B8]" />
          }
        </button>
      </div>

      {/* Word + phonetic */}
      <div className="px-4 pb-3">
        <h3
          className="font-extrabold text-lg leading-tight mb-1 tracking-tight"
          style={{ color: "#00305E" }}
        >
          {item.word}
        </h3>
        <p className="text-[11px] font-mono" style={{ color: "#94A3B8" }}>
          {item.phonetic}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: "#F0F4F8" }} />

      {/* English meaning */}
      <div className="px-4 py-3 flex-1">
        <p className="text-sm font-semibold" style={{ color: "#334155" }}>
          {item.english}
        </p>
        <p className="text-xs mt-1.5 leading-snug line-clamp-2" style={{ color: "#94A3B8" }}>
          {item.meaning.split('.')[0]}.
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "#F1F4F9", color: "#64748B" }}
          >
            {item.category}
          </span>
          {item.tags.slice(0, 1).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "#F1F4F9", color: "#94A3B8" }}>
              {tag}
            </span>
          ))}
        </div>
        <motion.div
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: isSelected || hovered ? "#00305E" : "#CBD5E1" }}
          animate={{ x: hovered ? 2 : 0 }}
        >
          Details <ChevronRight size={13} />
        </motion.div>
      </div>

      {/* Cursor pointer indicator (for die Schnittstelle preview) */}
      {showCursor && (
        <motion.div
          className="absolute -bottom-2 right-8 pointer-events-none"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <div className="flex flex-col items-center">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path d="M4 2L4 18L8 14L11 20L13 19L10 13L16 13L4 2Z" fill="#00305E" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="text-[9px] font-bold text-white bg-[#00305E] px-1.5 py-0.5 rounded-[4px] mt-0.5 whitespace-nowrap">Klick!</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Vocab Modal ──────────────────────────────────────────────────────────────

function VocabModal({ item, onClose }: { item: VocabItem; onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [examplePlaying, setExamplePlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gender = GENDER_CONFIG[item.article];
  const level = LEVEL_CONFIG[item.level];

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearInterval(intervalRef.current!);
    } else {
      setIsPlaying(true);
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 1) {
            clearInterval(intervalRef.current!);
            setIsPlaying(false);
            return 0;
          }
          return p + 0.012;
        });
      }, 80);
    }
  };

  useEffect(() => () => clearInterval(intervalRef.current!), []);

  // Build example sentence with bold word
  const renderExample = (de: string, bold: string) => {
    const idx = de.indexOf(bold);
    if (idx === -1) return <span>{de}</span>;
    return (
      <>
        {de.slice(0, idx)}
        <span className="font-extrabold" style={{ color: "#00305E" }}>
          {bold}
        </span>
        {de.slice(idx + bold.length)}
      </>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: "rgba(0,48,94,0.45)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Panel */}
      <motion.div
        className="relative bg-white rounded-[24px] w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col"
        style={{ boxShadow: "0 32px 80px rgba(0,48,94,0.22), 0 0 0 1px rgba(0,48,94,0.05)" }}
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
      >
        {/* ── SECTION 1: Header ─────────────────────────────────────────── */}
        <div
          className="relative px-6 pt-6 pb-5"
          style={{
            background: "linear-gradient(135deg, #00305E 0%, #004080 100%)",
            borderRadius: "24px 24px 0 0",
          }}
        >
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
            style={{ background: "white", transform: "translate(30%, -30%)" }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5"
            style={{ background: "#FFCE00", transform: "translate(-30%, 30%)" }} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors z-10"
            style={{ background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.2)" }}
          >
            <X size={16} className="text-white" />
          </button>

          {/* Word & Translation */}
          <div className="flex items-start gap-3 mb-4 pr-10">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${gender.dot}25`, color: gender.bg, border: `1.5px solid ${gender.dot}40` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: gender.bg }} />
                  {item.article}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,206,0,0.2)", color: "#FFCE00", border: "1px solid rgba(255,206,0,0.3)" }}>
                  {item.level}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                  {item.category}
                </span>
              </div>
              <h2 className="text-white font-extrabold text-2xl leading-tight tracking-tight">
                {item.word}
              </h2>
              <p className="text-white/60 text-sm font-medium mt-0.5">{item.english}</p>
            </div>
          </div>

          {/* Waveform + Phonetic */}
          <div
            className="rounded-[16px] p-4"
            style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              {/* Speaker icon label */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,206,0,0.2)", border: "1.5px solid rgba(255,206,0,0.4)" }}
              >
                <Volume2 size={14} className="text-[#FFCE00]" />
              </div>
              <div>
                <p className="text-white text-[10px] font-bold uppercase tracking-widest opacity-60">Originalton</p>
                <p className="text-white/40 text-[10px] font-mono mt-0.5">{item.phonetic}</p>
              </div>
            </div>

            {/* Waveform */}
            <div className="mb-3">
              <WaveformVisualizer isPlaying={isPlaying} progress={progress} />
            </div>

            {/* Play button row */}
            <div className="flex items-center gap-3">
              <motion.button
                onClick={togglePlay}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] font-bold text-sm transition-all"
                style={{
                  background: isPlaying
                    ? "rgba(255,206,0,0.9)"
                    : "rgba(255,206,0,0.85)",
                  color: "#00305E",
                  boxShadow: "0 4px 0 0 rgba(0,0,0,0.25), 0 6px 16px rgba(255,206,0,0.25)",
                }}
                whileTap={{ y: 3, boxShadow: "0 1px 0 0 rgba(0,0,0,0.25)" }}
              >
                {isPlaying
                  ? <><Pause size={15} fill="#00305E" /> Pause</>
                  : <><Play size={15} fill="#00305E" /> Abspielen</>
                }
              </motion.button>

              {isPlaying && (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.6)", height: 12 }}
                        animate={{ scaleY: [1, 1.8, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-xs">Wird abgespielt…</span>
                </motion.div>
              )}

              <div className="ml-auto text-white/30 text-xs font-mono">
                {Math.round(progress * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Bedeutung (Meaning) ───────────────────────────── */}
        <div className="px-6 py-5 border-b border-[#F0F4F8]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
              style={{ background: "#EEF4FF" }}>
              <BookOpen size={14} className="text-[#00305E]" />
            </div>
            <h3 className="font-bold text-[#00305E] text-sm uppercase tracking-widest">
              Bedeutung
            </h3>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>
            {item.meaning}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: "#F1F4F9", color: "#64748B", border: "1px solid #E2E8F0" }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── SECTION 3: Beispielsatz (Example Sentence) ───────────────── */}
        <div className="px-6 py-5 border-b border-[#F0F4F8]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
              style={{ background: "#FFF8E1" }}>
              <AlignLeft size={14} className="text-[#B45309]" />
            </div>
            <h3 className="font-bold text-[#B45309] text-sm uppercase tracking-widest">
              Beispielsatz
            </h3>
          </div>

          {/* German sentence */}
          <div
            className="rounded-[14px] p-4 mb-3"
            style={{ background: "#FAFBFF", border: "1.5px solid #E2E8F0" }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-base leading-relaxed flex-1" style={{ color: "#1A1A1A" }}>
                🇩🇪 {renderExample(item.exampleDE, item.exampleBold)}
              </p>
              <button
                onClick={() => setExamplePlaying((v) => !v)}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors mt-0.5"
                style={{
                  background: examplePlaying ? "#FFCE00" : "#F1F4F9",
                  border: "1.5px solid #E2E8F0",
                }}
              >
                {examplePlaying
                  ? <Pause size={13} fill="#00305E" className="text-[#00305E]" />
                  : <Play size={13} fill="#64748B" className="text-[#64748B]" />
                }
              </button>
            </div>

            <div className="mt-2 pt-2 flex items-center gap-2" style={{ borderTop: "1px dashed #E2E8F0" }}>
              <span className="text-lg">🇬🇧</span>
              <p className="text-sm italic" style={{ color: "#94A3B8" }}>
                {item.exampleEN}
              </p>
            </div>

            {examplePlaying && (
              <motion.div
                className="mt-3 flex items-center gap-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div className="flex gap-0.5 items-end h-5">
                  {[5, 8, 12, 16, 12, 8, 14, 10, 7, 12].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 rounded-full bg-[#FFCE00]"
                      style={{ height: h }}
                      animate={{ scaleY: [1, 1.6, 1] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.06 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-[#94A3B8]">Beispiel wird abgespielt…</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── SECTION 4: Hierarchy Structure ───────────────────────────── */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
              style={{ background: "#F5F3FF" }}>
              <Layers size={14} className="text-[#7C3AED]" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-widest" style={{ color: "#7C3AED" }}>
              Hierarchiestruktur
            </h3>
          </div>

          <p className="text-xs text-[#94A3B8] mb-3">
            Interaktionszustand → Komponentenzustand → Komponenten-Hero
          </p>

          <HierarchyTree item={item} />

          {/* Bottom action row */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold border transition-colors"
              style={{ background: "#F5F7FA", color: "#64748B", borderColor: "#E2E8F0" }}
            >
              Schließen
            </button>
            <button
              className="flex-[2] py-2.5 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: "#00305E",
                color: "white",
                boxShadow: "0 4px 0 0 #002447, 0 6px 16px rgba(0,48,94,0.25)",
              }}
            >
              <BookmarkCheck size={15} /> Zur Lernliste hinzufügen
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Vocabulary Page ─────────────────────────────────────────────────────

export default function Vocabulary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "Alle">("Alle");
  const [levelFilter, setLevelFilter] = useState<Level | "Alle">("Alle");
  const [selectedItem, setSelectedItem] = useState<VocabItem | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return VOCAB.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        v.word.toLowerCase().includes(q) ||
        v.english.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q));
      const matchCat = categoryFilter === "Alle" || v.category === categoryFilter;
      const matchLvl = levelFilter === "Alle" || v.level === levelFilter;
      return matchSearch && matchCat && matchLvl;
    });
  }, [search, categoryFilter, levelFilter]);

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: "#F5F5F5" }}>
      <div className="max-w-[430px] mx-auto w-full flex flex-col flex-1">
        {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
        <header
          className="bg-white border-b border-[#E2E8F0] flex-shrink-0"
          style={{ boxShadow: "0 1px 8px rgba(0,48,94,0.06)" }}
        >
          <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center gap-4">
            {/* Logo */}
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-[8px] flex items-center justify-center"
                style={{
                  background: "linear-gradient(145deg, #FFD940, #FFCE00)",
                  boxShadow: "0 3px 0 0 #C9A200",
                }}
              >
                <span className="text-[#00305E] font-extrabold text-base leading-none">D</span>
              </div>
              <span className="font-extrabold text-[#00305E] text-base tracking-tight hidden sm:block">
                DeutschFlow
              </span>
            </button>

            {/* Nav tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#F5F7FA] rounded-[12px] p-1 border border-[#E2E8F0]">
              {[
                { label: "Dashboard", path: "/" },
                { label: "Vokabular", path: "/vocabulary", active: true },
                { label: "Lernpfad", path: "/roadmap" },
                { label: "Spielen", path: "/game" },
              ].map(({ label, path, active }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  className="px-3.5 py-2 rounded-[10px] text-sm font-semibold transition-all"
                  style={{
                    background: active ? "white" : "transparent",
                    color: active ? "#00305E" : "#64748B",
                    boxShadow: active ? "0 1px 4px rgba(0,48,94,0.1)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button className="relative p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#94A3B8] hover:text-[#64748B] transition-colors">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              </button>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[#E2E8F0] bg-[#FAFBFC] cursor-pointer hover:bg-[#F5F7FA] transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #00305E, #004080)" }}
                >
                  <span className="text-white text-[9px] font-bold">HC</span>
                </div>
                <span className="text-[#0F172A] text-xs font-semibold hidden sm:block">Huy Cu</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Search + Filters Bar ────────────────────────────────────────────── */}
        <div
          className="bg-white border-b border-[#E2E8F0] flex-shrink-0"
          style={{ boxShadow: "0 1px 4px rgba(0,48,94,0.04)" }}
        >
          <div className="max-w-7xl mx-auto px-5 py-4">
            {/* Page title + stats */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-[#00305E] font-extrabold text-xl tracking-tight">
                  Deutsches Vokabular
                </h1>
                <p className="text-[#94A3B8] text-xs mt-0.5">
                  {filtered.length} Wörter · {VOCAB.filter((v) => v.category === "IT").length} IT-Begriffe
                </p>
              </div>
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-[#F5F7FA] rounded-[10px] p-0.5 border border-[#E2E8F0]">
                {(["grid", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="p-2 rounded-[8px] transition-all"
                    style={{
                      background: viewMode === mode ? "white" : "transparent",
                      color: viewMode === mode ? "#00305E" : "#94A3B8",
                      boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {mode === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Search row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Wort suchen, z. B. Schnittstelle…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-[12px] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15 focus:border-[#00305E]/40 transition-colors"
                  style={{ background: "#F8FAFF", border: "1.5px solid #E2E8F0" }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[12px] text-sm font-medium transition-colors border"
                style={{
                  background: showFilters ? "#EEF4FF" : "#F8FAFF",
                  color: showFilters ? "#00305E" : "#64748B",
                  borderColor: showFilters ? "rgba(0,48,94,0.2)" : "#E2E8F0",
                }}
              >
                <Filter size={14} />
                Filter
                {(categoryFilter !== "Alle" || levelFilter !== "Alle") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFCE00]" />
                )}
              </button>
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat as any)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                  style={{
                    background: categoryFilter === cat ? "#00305E" : "white",
                    color: categoryFilter === cat ? "white" : "#64748B",
                    borderColor: categoryFilter === cat ? "#00305E" : "#E2E8F0",
                    boxShadow: categoryFilter === cat ? "0 2px 8px rgba(0,48,94,0.2)" : "none",
                  }}
                >
                  {cat}
                </button>
              ))}

              <div className="w-px h-4 bg-[#E2E8F0] mx-1" />

              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl as any)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
                  style={{
                    background:
                      levelFilter === lvl
                        ? lvl === "Alle"
                          ? "#64748B"
                          : LEVEL_CONFIG[lvl as Level]?.bg ?? "#F1F4F9"
                        : "white",
                    color:
                      levelFilter === lvl
                        ? lvl === "Alle"
                          ? "white"
                          : LEVEL_CONFIG[lvl as Level]?.text ?? "#64748B"
                        : "#94A3B8",
                    borderColor:
                      levelFilter === lvl
                        ? lvl === "Alle"
                          ? "#64748B"
                          : LEVEL_CONFIG[lvl as Level]?.text ?? "#CBD5E1"
                        : "#E2E8F0",
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card Grid ───────────────────────────────────────────────────────── */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F1F4F9] flex items-center justify-center mb-4">
                <Search size={24} className="text-[#CBD5E1]" />
              </div>
              <p className="text-[#64748B] font-semibold mb-1">Keine Wörter gefunden</p>
              <p className="text-[#94A3B8] text-sm">Versuche einen anderen Suchbegriff oder Filter.</p>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                  : "flex flex-col gap-3"
              }
            >
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  {viewMode === "grid" ? (
                    <VocabCard
                      item={item}
                      onClick={() => setSelectedItem(item)}
                      isSelected={selectedItem?.id === item.id}
                      showCursor={item.id === 1 && !selectedItem}
                    />
                  ) : (
                    /* List view row */
                    <motion.div
                      className="bg-white rounded-[14px] px-5 py-3.5 flex items-center gap-4 cursor-pointer"
                      style={{
                        border: selectedItem?.id === item.id ? "2px solid #00305E" : "2px solid #E2E8F0",
                        boxShadow: selectedItem?.id === item.id
                          ? "0 4px 16px rgba(0,48,94,0.1)"
                          : "0 1px 4px rgba(0,48,94,0.04)",
                      }}
                      onClick={() => setSelectedItem(item)}
                      whileHover={{ x: 2 }}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0"
                        style={{
                          background: GENDER_CONFIG[item.article].bg,
                          color: GENDER_CONFIG[item.article].text,
                          borderColor: GENDER_CONFIG[item.article].border,
                        }}
                      >
                        {item.article}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[#00305E] truncate">{item.word}</p>
                        <p className="text-xs text-[#94A3B8] font-mono">{item.phonetic}</p>
                      </div>
                      <p className="text-sm text-[#334155] hidden sm:block flex-1">{item.english}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: LEVEL_CONFIG[item.level].bg, color: LEVEL_CONFIG[item.level].text }}>
                          {item.level}
                        </span>
                        <ChevronRight size={14} className="text-[#CBD5E1]" />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Stats footer */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[#94A3B8]">
            <span>{VOCAB.length} Wörter gesamt</span>
            <span>·</span>
            <span>{VOCAB.filter(v => v.category === "IT").length} IT-Begriffe</span>
            <span>·</span>
            <span>{VOCAB.filter(v => v.level === "A1" || v.level === "A2").length} Anfänger</span>
            <span>·</span>
            <span>{VOCAB.filter(v => v.level === "B1" || v.level === "B2").length} Fortgeschritten</span>
          </div>
        </main>

        {/* ── Modal ────────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedItem && (
            <VocabModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          )}
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  );
}