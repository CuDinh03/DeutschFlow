"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import api from "@/lib/api";
import { clearTokens, logout } from "@/lib/authSession";
import { StudentShell } from "@/components/layouts/StudentShell";
import { PracticeGlassSkeleton } from "@/components/practice/PracticeGlassSkeleton";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { speakGerman, primeGermanVoices } from "@/lib/speechDe";
import { ChevronLeft, Check, RefreshCw, RotateCcw, Volume2, X } from "lucide-react";

type CardType = "masculine" | "feminine" | "neuter" | "verb" | "adjective";

type CardMode = "flip" | "type";

type SwipeCard = {
  id: number;
  type: CardType;
  article?: string;
  word: string;
  english: string;
  phonetic: string;
  sentence: string;
  sentenceEN: string;
  emoji: string;
  level: string;
  /** German answer: "Der Tisch" or lemma for verbs/adjectives — exact match for type mode */
  expectedAnswer: string;
};

type WordRow = {
  id: number;
  dtype: string;
  baseForm: string;
  cefrLevel?: string | null;
  phonetic?: string | null;
  meaning?: string | null;
  meaningEn?: string | null;
  exampleDe?: string | null;
  example?: string | null;
  exampleEn?: string | null;
  gender?: "DER" | "DIE" | "DAS" | null;
  article?: "der" | "die" | "das" | null;
};

const EMOJIS = ["📖", "🎯", "✨", "💡", "📝", "🗣️", "⭐", "🔤", "📚", "🎓"];

const COLOR: Record<
  CardType,
  { primary: string; dark: string; light: string; gradient: string; glow: string; label: string; tag: string }
> = {
  masculine: {
    primary: "#2D9CDB",
    dark: "#1A6A9A",
    light: "#EBF5FB",
    gradient: "linear-gradient(145deg, #2D9CDB 0%, #1A6A9A 100%)",
    glow: "rgba(45,156,219,0.40)",
    label: "Maskulin",
    tag: "der",
  },
  feminine: {
    primary: "#EB5757",
    dark: "#A33030",
    light: "#FDEAEA",
    gradient: "linear-gradient(145deg, #EB5757 0%, #A33030 100%)",
    glow: "rgba(235,87,87,0.40)",
    label: "Feminin",
    tag: "die",
  },
  neuter: {
    primary: "#27AE60",
    dark: "#1A7A42",
    light: "#E8F8F0",
    gradient: "linear-gradient(145deg, #27AE60 0%, #1A7A42 100%)",
    glow: "rgba(39,174,96,0.40)",
    label: "Neutrum",
    tag: "das",
  },
  verb: {
    primary: "#9B51E0",
    dark: "#6D25B3",
    light: "#F4EDFF",
    gradient: "linear-gradient(145deg, #9B51E0 0%, #6D25B3 100%)",
    glow: "rgba(155,81,224,0.40)",
    label: "Verb",
    tag: "vb.",
  },
  adjective: {
    primary: "#F2994A",
    dark: "#C26B1A",
    light: "#FEF3E8",
    gradient: "linear-gradient(145deg, #F2994A 0%, #C26B1A 100%)",
    glow: "rgba(242,153,74,0.40)",
    label: "Adjektiv",
    tag: "adj.",
  },
};

function mapWordToSwipe(w: WordRow, locale: string): SwipeCard {
  const dtype = (w.dtype || "Noun").toLowerCase();
  let type: CardType = "masculine";
  if (dtype === "verb") type = "verb";
  else if (dtype === "adjective") type = "adjective";
  else if (w.gender === "DIE") type = "feminine";
  else if (w.gender === "DAS") type = "neuter";
  else type = "masculine";

  const art =
    type === "masculine" || type === "feminine" || type === "neuter"
      ? (w.article ?? (type === "masculine" ? "der" : type === "feminine" ? "die" : "das"))
      : undefined;
  const articleCap = art ? art.charAt(0).toUpperCase() + art.slice(1) : undefined;

  const loc = locale.toLowerCase();
  const isVi = loc.startsWith("vi");
  const isDe = loc.startsWith("de");
  const english = isDe
    ? (w.meaning ?? w.meaningEn ?? "")
    : isVi
      ? (w.meaning ?? w.meaningEn ?? "")
      : (w.meaningEn ?? w.meaning ?? "");

  const expectedAnswer = articleCap ? `${articleCap} ${w.baseForm}` : w.baseForm;

  return {
    id: w.id,
    type,
    article: articleCap,
    word: w.baseForm,
    english: english || w.baseForm,
    phonetic: w.phonetic?.trim() || "",
    sentence: w.exampleDe ?? w.example ?? "",
    sentenceEN: w.exampleEn ?? "",
    emoji: EMOJIS[Math.abs(w.id) % EMOJIS.length],
    level: (w.cefrLevel ?? "A1").toUpperCase(),
    expectedAnswer,
  };
}

function isExactMatch(input: string, expected: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(input) === norm(expected);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SwipeCardView({
  card,
  stackIndex,
  onSwipe,
  mode,
  t,
}: {
  card: SwipeCard;
  stackIndex: 0 | 1 | 2;
  onSwipe: (dir: "learned" | "unlearned") => void;
  mode: CardMode;
  t: (key: string) => string;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<"idle" | "correct" | "wrong">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const c = COLOR[card.type];
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);
  const learnedBg = useTransform(x, [0, 130], [0, 0.88]);
  const unlearnedBg = useTransform(x, [-130, 0], [0.88, 0]);
  const learnedLabelOp = useTransform(x, [20, 100], [0, 1]);
  const unlearnedLabelOp = useTransform(x, [-100, -20], [1, 0]);
  const learnedLabelScale = useTransform(x, [20, 100], [0.6, 1]);
  const unlearnedLabelScale = useTransform(x, [-100, -20], [1, 0.6]);

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
    [controls, onSwipe],
  );

  useEffect(() => {
    setAnswer("");
    setVerdict("idle");
  }, [card.id, mode]);

  useEffect(() => {
    if (verdict !== "correct") return;
    const timer = setTimeout(() => {
      void swipeAway("learned");
    }, 250);
    return () => clearTimeout(timer);
  }, [verdict, swipeAway]);

  useEffect(() => {
    if (mode === "type" && stackIndex === 0) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [mode, stackIndex, card.id]);

  const handleDragEnd = useCallback(
    async (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      setIsDragging(false);
      const { offset, velocity } = info;
      if (offset.x > 100 || velocity.x > 550) {
        await swipeAway("learned");
      } else if (offset.x < -100 || velocity.x < -550) {
        await swipeAway("unlearned");
      } else {
        controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 320, damping: 28 } });
      }
    },
    [controls, swipeAway],
  );

  const play = (e: React.MouseEvent) => {
    e.stopPropagation();
    const line = card.article ? `${card.article} ${card.word}` : card.word;
    setAudioPlaying(true);
    speakGerman(card.sentence || line);
    setTimeout(() => setAudioPlaying(false), 1800);
  };

  const submitAnswer = useCallback(() => {
    if (mode !== "type" || verdict !== "idle") return;
    if (isExactMatch(answer, card.expectedAnswer)) {
      setVerdict("correct");
    } else {
      setVerdict("wrong");
    }
  }, [mode, verdict, answer, card.expectedAnswer]);

  if (stackIndex > 0) {
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
        <div className="w-full h-full rounded-[24px] overflow-hidden" style={{ background: c.gradient, boxShadow: `0 8px 24px ${c.glow}` }} />
      </motion.div>
    );
  }

  if (mode === "type") {
    return (
      <motion.div
        className="absolute inset-0 cursor-default"
        style={{ x, rotate, borderRadius: 24, zIndex: 10 }}
        animate={controls}
        drag={false}
      >
        <motion.div
          className="absolute inset-0 rounded-[24px] flex items-center justify-start pl-6 z-20 pointer-events-none overflow-hidden"
          style={{ opacity: learnedBg, background: "rgba(39,174,96,0.18)" }}
        >
          <motion.div className="absolute inset-0 rounded-[24px]" style={{ border: "3px solid #27AE60", opacity: learnedBg }} />
          <motion.div className="flex flex-col items-center gap-1" style={{ opacity: learnedLabelOp, scale: learnedLabelScale }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#27AE60", boxShadow: "0 0 24px rgba(39,174,96,0.5)" }}
            >
              <Check size={32} className="text-white" strokeWidth={3} />
            </div>
            <span className="font-extrabold text-lg tracking-wide mt-1" style={{ color: "#27AE60" }}>
              {t("learned")}
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute inset-0 rounded-[24px] flex items-center justify-end pr-6 z-20 pointer-events-none overflow-hidden"
          style={{ opacity: unlearnedBg, background: "rgba(235,87,87,0.18)" }}
        >
          <motion.div className="absolute inset-0 rounded-[24px]" style={{ border: "3px solid #EB5757", opacity: unlearnedBg }} />
          <motion.div className="flex flex-col items-center gap-1" style={{ opacity: unlearnedLabelOp, scale: unlearnedLabelScale }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#EB5757", boxShadow: "0 0 24px rgba(235,87,87,0.5)" }}
            >
              <X size={30} className="text-white" strokeWidth={3} />
            </div>
            <span className="font-extrabold text-lg tracking-wide mt-1" style={{ color: "#EB5757" }}>
              {t("review")}
            </span>
          </motion.div>
        </motion.div>

        <div className="absolute inset-0 rounded-[24px] overflow-hidden bg-white shadow-xl flex flex-col">
          {verdict === "correct" ? (
            <div
              className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none"
              style={{ background: "rgba(39,174,96,0.35)" }}
            >
              <span className="text-white font-black text-2xl drop-shadow-md">{t("correct")}</span>
            </div>
          ) : null}

          {verdict === "wrong" ? (
            <div
              className="absolute inset-0 z-[30] flex flex-col p-5 overflow-y-auto"
              style={{ background: "rgba(127,29,29,0.92)" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">{t("wrong")}</p>
              <p className="text-white/70 text-xs font-semibold mb-1">{t("correctAnswerLabel")}</p>
              <p className="text-white font-black text-xl mb-1">{card.expectedAnswer}</p>
              {card.phonetic ? <p className="text-white/70 text-xs font-mono mb-3">{card.phonetic}</p> : <div className="mb-3" />}
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">{t("example")}</p>
              <div className="rounded-[14px] px-3 py-2 border border-white/20 bg-white/10 mb-4 flex-shrink-0">
                <p className="text-sm font-semibold text-white mb-1">🇩🇪 {card.sentence || "—"}</p>
                <p className="text-xs text-white/80 italic">🇬🇧 {card.sentenceEN || "—"}</p>
              </div>
              <button
                type="button"
                className="mt-auto w-full py-3 rounded-[14px] font-bold bg-white text-rose-900"
                onClick={() => void swipeAway("unlearned")}
              >
                {t("next")}
              </button>
            </div>
          ) : null}

          <div className="flex-1 flex flex-col min-h-0" style={{ background: c.gradient }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white/90 bg-white/20">{c.label}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white/90 bg-white/15">{card.level}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-2 min-h-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">{t("meaningLabel")}</span>
              <p className="text-white font-bold text-lg text-center leading-snug line-clamp-4 mb-2">{card.english}</p>
              <span className="text-[10px] text-white/50 mb-3">
                {c.label} · {c.tag}
              </span>
              <div className="w-full flex gap-2 items-stretch pointer-events-auto">
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                  disabled={verdict !== "idle"}
                  placeholder={t("inputPlaceholder")}
                  className="flex-1 min-w-0 rounded-[12px] px-3 py-2.5 text-sm font-semibold text-slate-900 bg-white/95 border-2 border-white/40 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/80"
                />
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={verdict !== "idle"}
                  className="px-4 rounded-[12px] font-bold text-sm bg-white text-slate-900 disabled:opacity-50"
                >
                  {t("submit")}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-white/10 flex-shrink-0">
              <button
                type="button"
                onClick={play}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-[10px] text-[11px] font-medium bg-white/20 text-white border border-white/30"
              >
                <Volume2 size={13} />
                {audioPlaying ? "…" : t("listen")}
              </button>
              <span className="text-2xl">{card.emoji}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, borderRadius: 24, zIndex: 10 }}
      animate={controls}
      drag={!isFlipped ? true : "x"}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.65}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (!isDragging) setIsFlipped((v) => !v);
      }}
      whileDrag={{ scale: 1.02 }}
    >
      <motion.div
        className="absolute inset-0 rounded-[24px] flex items-center justify-start pl-6 z-20 pointer-events-none overflow-hidden"
        style={{ opacity: learnedBg, background: "rgba(39,174,96,0.18)" }}
      >
        <motion.div className="absolute inset-0 rounded-[24px]" style={{ border: "3px solid #27AE60", opacity: learnedBg }} />
        <motion.div className="flex flex-col items-center gap-1" style={{ opacity: learnedLabelOp, scale: learnedLabelScale }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#27AE60", boxShadow: "0 0 24px rgba(39,174,96,0.5)" }}
          >
            <Check size={32} className="text-white" strokeWidth={3} />
          </div>
          <span className="font-extrabold text-lg tracking-wide mt-1" style={{ color: "#27AE60" }}>
            {t("learned")}
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 rounded-[24px] flex items-center justify-end pr-6 z-20 pointer-events-none overflow-hidden"
        style={{ opacity: unlearnedBg, background: "rgba(235,87,87,0.18)" }}
      >
        <motion.div className="absolute inset-0 rounded-[24px]" style={{ border: "3px solid #EB5757", opacity: unlearnedBg }} />
        <motion.div className="flex flex-col items-center gap-1" style={{ opacity: unlearnedLabelOp, scale: unlearnedLabelScale }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#EB5757", boxShadow: "0 0 24px rgba(235,87,87,0.5)" }}
          >
            <X size={30} className="text-white" strokeWidth={3} />
          </div>
          <span className="font-extrabold text-lg tracking-wide mt-1" style={{ color: "#EB5757" }}>
            {t("review")}
          </span>
        </motion.div>
      </motion.div>

      <div className="absolute inset-0 rounded-[24px] overflow-hidden bg-white shadow-xl" style={{ perspective: 1200 }}>
        <motion.div
          className="w-full h-full relative"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="absolute inset-0 flex flex-col backface-hidden" style={{ backfaceVisibility: "hidden" }}>
            <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: c.gradient }}>
              <span className="text-5xl mb-3">{card.emoji}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white/90 bg-white/20 mb-2">{c.label}</span>
              <h2 className="text-white font-black text-2xl text-center leading-tight">{card.article ? `${card.article} ${card.word}` : card.word}</h2>
              {card.phonetic ? <p className="text-white/70 text-xs font-mono mt-2">{card.phonetic}</p> : null}
              <p className="text-white/85 text-sm mt-3 text-center line-clamp-3">{card.english}</p>
            </div>
            <div className="py-2 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <RefreshCw size={10} /> {t("tapFlip")}
            </div>
          </div>

          <div
            className="absolute inset-0 flex flex-col backface-hidden rounded-[24px] overflow-hidden bg-white"
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
          >
            <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ background: c.gradient, borderRadius: "24px 24px 0 0" }}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">{c.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/80">{card.level}</span>
                  </div>
                  <h2 className="text-white font-black text-xl leading-tight tracking-tight line-clamp-2">{card.english}</h2>
                </div>
                <div className="flex-shrink-0 w-14 h-14 rounded-[14px] flex items-center justify-center text-3xl bg-white/20 border-2 border-white/30">
                  {card.emoji}
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col px-6 py-4 gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold mb-0.5 text-slate-400">{t("germanWord")}</p>
                  <p className="font-bold text-slate-900">{card.article ? `${card.article} ${card.word}` : card.word}</p>
                  {card.phonetic ? <p className="text-xs font-mono mt-0.5 text-slate-400">{card.phonetic}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={play}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium transition-all border"
                  style={{
                    background: audioPlaying ? c.light : "#F8FAFF",
                    color: audioPlaying ? c.primary : "#64748B",
                    borderColor: audioPlaying ? `${c.primary}50` : "#E2E8F0",
                  }}
                >
                  <Volume2 size={13} />
                  {audioPlaying ? "…" : t("listen")}
                </button>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex-1 min-h-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t("example")}</p>
                <div className="rounded-[14px] px-4 py-3 border" style={{ background: c.light, borderColor: `${c.primary}22` }}>
                  <p className="text-sm font-semibold leading-snug text-slate-900 mb-2">🇩🇪 {card.sentence || "—"}</p>
                  <div className="h-px mb-2 bg-slate-200/80" />
                  <p className="text-xs italic text-slate-500 leading-snug">🇬🇧 {card.sentenceEN || "—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1 text-slate-300 text-[10px]">
                <RefreshCw size={10} /> {t("tapFlipBack")}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function SwipeCardsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("swipeCards");
  const uiLocale = useLocale();
  const urlCefrQ = (searchParams.get("cefr") ?? "").trim().toUpperCase();
  const urlTagQ = (searchParams.get("tag") ?? "").trim();

  const { me, loading: sessionLoading, targetLevel: planTargetLevel, practiceFloorLevel, streakDays, initials, reload } =
    useStudentPracticeSession();

  const deckCefr = useMemo(() => {
    const allowed = ["A1", "A2", "B1", "B2"] as const;
    const fromUrl = urlCefrQ as (typeof allowed)[number];
    if ((allowed as readonly string[]).includes(urlCefrQ)) return fromUrl;
    return practiceFloorLevel;
  }, [practiceFloorLevel, urlCefrQ]);

  const shellTargetLevel = useMemo(() => {
    const allowed = ["A1", "A2", "B1", "B2"];
    return allowed.includes(urlCefrQ) ? urlCefrQ : planTargetLevel;
  }, [planTargetLevel, urlCefrQ]);

  const [deck, setDeck] = useState<SwipeCard[]>([]);
  const [deckLoading, setDeckLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [learnedIds, setLearnedIds] = useState<Set<number>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<number>>(new Set());
  const [showComplete, setShowComplete] = useState(false);
  const [mode, setMode] = useState<CardMode>("flip");

  const handleLogout = useCallback(() => {
    logout();
  }, []); // router is stable (Next.js guarantee) — not needed in deps

  useEffect(() => {
    primeGermanVoices();
  }, []);

  useEffect(() => {
    if (!me || sessionLoading) return;
    let cancelled = false;
    setDeckLoading(true);
    setLoadError("");
    (async () => {
      try {
        const wordsRes = await api.get<{ items: WordRow[]; total: number }>("/words", {
          params: {
            size: 20,
            page: 0,
            locale: uiLocale || "de",
            cefr: deckCefr,
            ...(urlTagQ ? { tag: urlTagQ } : {}),
          },
        });
        if (cancelled) return;
        const loc = uiLocale || "de";
        setPoolTotal(Number.isFinite(wordsRes.data.total) ? wordsRes.data.total : null);
        const cards = shuffle((wordsRes.data.items ?? []).map((w) => mapWordToSwipe(w, loc)));
        setDeck(cards);
      } catch {
        if (!cancelled) setLoadError(t("loadError"));
      } finally {
        if (!cancelled) setDeckLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckCefr, me, sessionLoading, t, uiLocale, urlTagQ]);

  const remaining = useMemo(
    () => deck.filter((c) => !learnedIds.has(c.id) && !reviewIds.has(c.id)),
    [deck, learnedIds, reviewIds],
  );

  const currentCard = remaining[0];
  const nextCard = remaining[1];
  const thirdCard = remaining[2];
  const total = deck.length;
  const done = learnedIds.size + reviewIds.size;

  const handleSwipe = useCallback(
    (dir: "learned" | "unlearned") => {
      if (!currentCard) return;
      if (dir === "learned") {
        setLearnedIds((s) => new Set(s).add(currentCard.id));
      } else {
        setReviewIds((s) => new Set(s).add(currentCard.id));
      }
      if (remaining.length <= 1) {
        setTimeout(() => setShowComplete(true), 200);
      }
    },
    [currentCard, remaining.length],
  );

  const restart = () => {
    setLearnedIds(new Set());
    setReviewIds(new Set());
    setShowComplete(false);
    setDeck((d) => shuffle([...d]));
  };

  if (sessionLoading) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <PracticeGlassSkeleton className="max-w-md" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
        <p className="max-w-md text-center text-sm text-[#64748B]">Could not load your profile.</p>
        <button
          type="button"
          className="rounded-[14px] bg-[#00305E] px-5 py-2.5 text-sm font-bold text-white shadow-md"
          onClick={() => void reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((learnedIds.size / total) * 100) : 0;
  const c = currentCard ? COLOR[currentCard.type] : COLOR.masculine;

  return (
    <StudentShell
      activeSection="swipe"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={shellTargetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t("title")}
      headerSubtitle={mode === "type" ? t("subtitleType") : t("subtitleFlip")}
      hideBottomNav={!showComplete && deck.length > 0 && !loadError}
    >
      <div className="max-w-md mx-auto w-full -mx-2 sm:mx-auto min-h-[70vh] flex flex-col df-glass-subtle rounded-[20px] overflow-hidden border border-slate-200/80 shadow-sm bg-[#F5F7FA]/95">
        {deckLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 gap-4">
            <PracticeGlassSkeleton className="max-w-[320px] border-white/60" blocks={4} />
            <p className="text-xs text-slate-500">{t("loading")}</p>
          </div>
        ) : (
          <>
        {poolTotal != null ? (
          <p className="text-[11px] text-center text-slate-500 px-3 pt-2 pb-1 bg-[#fafafa]">
            {t("wordsInPool", { count: poolTotal })}
          </p>
        ) : null}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <button type="button" onClick={() => router.push("/dashboard")} className="p-2 rounded-[10px] hover:bg-slate-50 text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: c.primary }}>
              {!showComplete && total ? `${Math.min(done + 1, total)} / ${total}` : showComplete ? t("done") : "—"}
            </p>
          </div>
          <div className="w-9" />
        </div>

        {!showComplete && deck.length > 0 && !loadError ? (
          <div className="flex gap-2 px-4 py-2.5 bg-white border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (mode === "flip") return;
                setMode("flip");
                restart();
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold border transition-all ${
                mode === "flip"
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
              style={
                mode === "flip"
                  ? { background: "linear-gradient(135deg, #00305E, #004080)", boxShadow: "0 2px 8px rgba(0,48,94,0.25)" }
                  : undefined
              }
            >
              {t("modeFlip")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === "type") return;
                setMode("type");
                restart();
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold border transition-all ${
                mode === "type"
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
              style={
                mode === "type"
                  ? { background: "linear-gradient(135deg, #00305E, #004080)", boxShadow: "0 2px 8px rgba(0,48,94,0.25)" }
                  : undefined
              }
            >
              {t("modeType")}
            </button>
          </div>
        ) : null}

        {loadError ? <p className="p-4 text-red-600 text-sm text-center">{loadError}</p> : null}

        {!deck.length && !loadError ? (
          <p className="p-8 text-center text-slate-500 text-sm">{t("noWords")}</p>
        ) : showComplete ? (
          <motion.div className="flex flex-col items-center gap-4 p-6 bg-white flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-5xl">🏆</div>
            <h2 className="font-extrabold text-xl text-[#00305E]">{t("sessionEnd")}</h2>
            <div className="grid grid-cols-3 gap-2 w-full text-center text-sm">
              <div className="rounded-xl p-2 bg-emerald-50 border border-emerald-100">
                <div className="font-black text-emerald-600">{learnedIds.size}</div>
                <div className="text-[10px] text-slate-500">{t("learned")}</div>
              </div>
              <div className="rounded-xl p-2 bg-sky-50 border border-sky-100">
                <div className="font-black text-sky-600">{pct}%</div>
                <div className="text-[10px] text-slate-500">{t("score")}</div>
              </div>
              <div className="rounded-xl p-2 bg-rose-50 border border-rose-100">
                <div className="font-black text-rose-600">{reviewIds.size}</div>
                <div className="text-[10px] text-slate-500">{t("review")}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={restart}
              className="w-full py-3 rounded-[14px] font-bold text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #00305E, #004080)" }}
            >
              <RotateCcw size={16} /> {t("again")}
            </button>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            <div className="relative w-full mx-auto" style={{ height: 420 }}>
              {[thirdCard, nextCard, currentCard].map((card, idx) => {
                if (!card) return null;
                const stackPos = (2 - idx) as 0 | 1 | 2;
                return (
                  <SwipeCardView
                    key={card.id + "-" + idx}
                    card={card}
                    stackIndex={stackPos}
                    onSwipe={handleSwipe}
                    mode={mode}
                    t={t}
                  />
                );
              })}
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-4 px-2">{mode === "type" ? t("typeHint") : t("swipeHint")}</p>
          </div>
        )}
          </>
        )}
      </div>
    </StudentShell>
  );
}
