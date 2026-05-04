"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
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
  Sparkles,
  Loader2,
  Brain,
} from "lucide-react";
import { useWordExamples, useWordMnemonic } from "@/hooks/useLocalAi";

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

// ─── Main Vocabulary Page ─────────────────────────────────────────────────────

export default function VocabularyPage() {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<VocabItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "Alle">("Alle");
  const [levelFilter, setLevelFilter] = useState<Level | "Alle">("Alle");
  const [aiExamples, setAiExamples] = useState<string[]>([]);
  const [aiMnemonic, setAiMnemonic] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filteredVocab = useMemo(() => {
    return VOCAB.filter((item) => {
      const matchesSearch = item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.meaning.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "Alle" || item.category === categoryFilter;
      const matchesLevel = levelFilter === "Alle" || item.level === levelFilter;
      
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [searchQuery, categoryFilter, levelFilter]);

  // ── AI features for selected word ──────────────────────────────────────────
  const { examples: wordExamples, loading: examplesLoading, generate: generateExamples } = useWordExamples();
  const { mnemonic: wordMnemonic, loading: mnemonicLoading, generate: generateMnemonic } = useWordMnemonic();

  const handleSelectItem = (item: VocabItem) => {
    setSelectedItem(item);
    setAiExamples([]);
    setAiMnemonic(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-[#64748B] hover:text-[#00305E] transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Zurück</span>
            </button>
            <div className="w-px h-6 bg-[#E2E8F0]" />
            <div>
              <h1 className="text-xl font-bold text-[#00305E]">Vokabular</h1>
              <p className="text-sm text-[#64748B]">{filteredVocab.length} Wörter verfügbar</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Wörter suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20 focus:border-[#00305E] w-64"
              />
            </div>
            
            {/* Filters */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | "Alle")}
              className="px-3 py-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as Level | "Alle")}
              className="px-3 py-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00305E]/20"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex gap-6">
          {/* Vocab Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedItem ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-4"} gap-6 flex-1`}>
            {filteredVocab.map((item) => (
              <VocabCard
                key={item.id}
                item={item}
                onClick={() => handleSelectItem(item)}
                isSelected={selectedItem?.id === item.id}
                showCursor={item.id === 1 && !selectedItem}
              />
            ))}
          </div>

          {/* AI Detail Panel */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, x: 32, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 360 }}
                exit={{ opacity: 0, x: 32, width: 0 }}
                transition={{ duration: 0.25 }}
                className="flex-shrink-0 bg-white rounded-[20px] border border-[#E2E8F0] shadow-lg overflow-hidden self-start sticky top-6"
                style={{ minWidth: 320 }}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between bg-[#F8FAFF]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: GENDER_CONFIG[selectedItem.article].bg, color: GENDER_CONFIG[selectedItem.article].text }}>
                        {selectedItem.article}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: LEVEL_CONFIG[selectedItem.level].bg, color: LEVEL_CONFIG[selectedItem.level].text }}>
                        {selectedItem.level}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-[#00305E]">{selectedItem.word.replace(/^(der|die|das)\s/, "")}</h2>
                    <p className="text-sm text-[#64748B]">{selectedItem.english}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{selectedItem.phonetic}</p>
                  </div>
                  <button onClick={() => setSelectedItem(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#F1F4F9] transition-colors">
                    <X size={14} className="text-[#64748B]" />
                  </button>
                </div>

                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                  {/* Meaning */}
                  <div>
                    <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Bedeutung</p>
                    <p className="text-sm text-[#1A1A1A] leading-relaxed">{selectedItem.meaning}</p>
                  </div>

                  {/* Built-in example */}
                  <div>
                    <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1.5">Beispiel</p>
                    <p className="text-sm font-medium text-[#00305E]">{selectedItem.exampleDE}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{selectedItem.exampleEN}</p>
                  </div>

                  {/* AI Examples */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-purple-500" />
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">AI Beispiele</p>
                      </div>
                      <button
                        onClick={() => void generateExamples(selectedItem.word.replace(/^(der|die|das)\s/, ""), 3)}
                        disabled={examplesLoading}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={{ background: examplesLoading ? "#F1F4F9" : "#EDE9FE", color: examplesLoading ? "#94A3B8" : "#7C3AED" }}
                      >
                        {examplesLoading ? (
                          <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Laden...</span>
                        ) : wordExamples.length > 0 ? "Neu" : "Generieren"}
                      </button>
                    </div>
                    {wordExamples.length > 0 ? (
                      <div className="space-y-2">
                        {wordExamples.map((ex, i) => (
                          <div key={i} className="text-sm text-[#374151] bg-[#F5F3FF] rounded-lg px-3 py-2 border border-purple-100">
                            {ex}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#CBD5E1] italic">Klicke &quot;Generieren&quot; für AI-Beispiele</p>
                    )}
                  </div>

                  {/* AI Mnemonic */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Brain size={13} className="text-blue-500" />
                        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Merkhilfe</p>
                      </div>
                      <button
                        onClick={() => void generateMnemonic(
                          selectedItem.word.replace(/^(der|die|das)\s/, ""),
                          selectedItem.english
                        )}
                        disabled={mnemonicLoading}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={{ background: mnemonicLoading ? "#F1F4F9" : "#EFF6FF", color: mnemonicLoading ? "#94A3B8" : "#1D4ED8" }}
                      >
                        {mnemonicLoading ? (
                          <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Laden...</span>
                        ) : wordMnemonic ? "Neu" : "Erstellen"}
                      </button>
                    </div>
                    {wordMnemonic ? (
                      <div className="text-sm text-[#1E40AF] bg-[#EFF6FF] rounded-lg px-3 py-2 border border-blue-100 leading-relaxed">
                        {wordMnemonic}
                      </div>
                    ) : (
                      <p className="text-xs text-[#CBD5E1] italic">Klicke &quot;Erstellen&quot; für eine Merkhilfe</p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F4F9] text-[#64748B]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {filteredVocab.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F5F7FA] flex items-center justify-center">
              <Search size={24} className="text-[#94A3B8]" />
            </div>
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Keine Wörter gefunden</h3>
            <p className="text-[#64748B]">Versuche andere Suchbegriffe oder Filter.</p>
          </div>
        )}
      </main>
    </div>
  );
}