import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  X,
  Check,
  ChevronLeft,
  Settings,
  RotateCcw,
  Share2,
  BookOpen,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  Volume2,
  ChevronDown,
  ChevronRight,
  Star,
  Download,
} from "lucide-react";
import { BottomNav } from "../components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "listening" | "processing" | "ai-speaking" | "summary";

interface ErrorSegment {
  text: string;
  isError: boolean;
  correction?: string;
  errorType?: "auxiliary" | "preposition" | "grammar" | "vocab";
}

interface Exchange {
  id: number;
  segments: ErrorSegment[];
  corrected?: string;
  hasError: boolean;
  aiResponse: string;
  timestamp: string;
  score: number;
}

// ─── Color constants ─────────────────────────────────────────────────────────

const CYAN = "#22D3EE";
const PURPLE = "#A78BFA";
const MINT = "#2DD4BF";
const glass = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.11)",
};

// ─── Bar colours (cyan → violet → cyan) ──────────────────────────────────────

const BAR_COLORS = ["#22D3EE", "#38BDF8", "#818CF8", "#A78BFA", "#818CF8", "#38BDF8", "#22D3EE"];
const BASE_AMPLITUDES = [0.32, 0.54, 0.72, 1.0, 0.72, 0.54, 0.32];

// ─── Mock exchanges ───────────────────────────────────────────────────────────

const INITIAL_EXCHANGES: Exchange[] = [
  {
    id: 1,
    segments: [
      { text: "Ich ", isError: false },
      { text: "habe", isError: true, correction: "bin", errorType: "auxiliary" },
      { text: " gestern ", isError: false },
      { text: "in das", isError: true, correction: "ins", errorType: "preposition" },
      { text: " Kino gegangen.", isError: false },
    ],
    corrected: "Ich bin gestern ins Kino gegangen.",
    hasError: true,
    aiResponse: "Fast perfekt! Bewegungsverben brauchen das Hilfsverb 'sein'. Ausserdem: 'in das' kontrahiert zu 'ins'. Toller Versuch!",
    timestamp: "02:14",
    score: 78,
  },
  {
    id: 2,
    segments: [
      { text: "Der Film war sehr interessant und wir haben viel gelacht.", isError: false },
    ],
    hasError: false,
    aiResponse: "Wunderbar! Ein perfekter Satz. Deine Grammatik verbessert sich wirklich schnell. Weiter so!",
    timestamp: "03:41",
    score: 100,
  },
];

const SIMULATED_NEXT: Exchange = {
  id: 3,
  segments: [
    { text: "Wir ", isError: false },
    { text: "muss", isError: true, correction: "muessen", errorType: "grammar" },
    { text: " morgen die Praesentation ", isError: false },
    { text: "vorbereiten", isError: false },
    { text: ".", isError: false },
  ],
  corrected: "Wir muessen morgen die Praesentation vorbereiten.",
  hasError: true,
  aiResponse: "Guter Versuch! 'Muessen' als Modalverb konjugiert mit 'wir' bleibt 'muessen'. Beachte die Verbkonjugation!",
  timestamp: "04:52",
  score: 85,
};

// ─── Vocabulary & mistakes (for summary) ─────────────────────────────────────

const LEARNED_VOCAB = [
  { german: "das Hilfsverb", phonetic: "/ˈhɪlfsˌvɛʁp/", vietnamese: "dong tu tro giup", level: "B1" },
  { german: "die Kontraktion", phonetic: "/kɔntʁakˈtsi̯oːn/", vietnamese: "su rut gon", level: "A2" },
  { german: "das Bewegungsverb", phonetic: "/bəˈveːɡʊŋsˌvɛʁp/", vietnamese: "dong tu chuyen dong", level: "B1" },
  { german: "die Wortstellung", phonetic: "/ˈvɔʁtˌʃtɛlʊŋ/", vietnamese: "trat tu tu trong cau", level: "B2" },
];

const COMMON_MISTAKES = [
  { label: "'haben' vs 'sein' als Hilfsverb", detail: "Bewegungsverben → immer 'sein' verwenden", count: 3, severity: "high" },
  { label: "Kontraktion 'in das' → 'ins'", detail: "Praeposition + bestimmter Artikel zusammenziehen", count: 2, severity: "medium" },
  { label: "Modalverb-Konjugation", detail: "'wir muessen' nicht 'wir muss'", count: 1, severity: "low" },
];

// ─── A. Voice Visualizer ──────────────────────────────────────────────────────

function VoiceVisualizer({ state }: { state: SessionState }) {
  const isActive = state === "listening" || state === "ai-speaking";
  const isAI = state === "ai-speaking";
  const isProcessing = state === "processing";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center">
        {/* Ambient glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 80,
            background: isActive
              ? `radial-gradient(ellipse, ${isAI ? "rgba(167,139,250,0.35)" : "rgba(34,211,238,0.35)"} 0%, transparent 70%)`
              : "transparent",
            filter: "blur(20px)",
          }}
          animate={{ opacity: isActive ? [0.5, 1, 0.5] : 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Bars */}
        <div className="flex items-end justify-center gap-[5px] relative z-10" style={{ height: 80 }}>
          {BAR_COLORS.map((color, i) => {
            const baseH = BASE_AMPLITUDES[i] * 32;

            const listeningAnim = { height: [baseH, baseH * 3.2, baseH * 1.4, baseH * 2.6, baseH] };
            const aiAnim = { height: [baseH * 0.9, baseH * 2.2, baseH * 1.2, baseH * 2.8, baseH * 0.9] };
            const idleAnim = { height: [baseH * 0.4, baseH * 0.7, baseH * 0.4] };
            const processingAnim = { height: [baseH * 0.3, baseH * 0.5, baseH * 0.3] };

            return (
              <motion.div
                key={i}
                className="rounded-full flex-shrink-0"
                style={{
                  width: 6,
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  boxShadow: isActive ? `0 0 10px ${color}90, 0 0 20px ${color}50` : "none",
                  originY: 1,
                }}
                animate={
                  isProcessing
                    ? processingAnim
                    : isActive
                    ? isAI
                      ? aiAnim
                      : listeningAnim
                    : idleAnim
                }
                transition={{
                  duration: isActive ? (isAI ? 1.1 : 0.65) : 1.8,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: i * (isActive ? 0.06 : 0.15),
                }}
              />
            );
          })}
        </div>
      </div>

      {/* State label */}
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <motion.div
            className="w-3 h-3 rounded-full border-2 border-t-transparent"
            style={{ borderColor: CYAN, borderTopColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? (isAI ? PURPLE : CYAN) : "rgba(255,255,255,0.3)" }}
            animate={{ opacity: isActive ? [1, 0.3, 1] : 1 }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
        <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
          {state === "idle" && "Bereit zum Sprechen"}
          {state === "listening" && "Aufnahme laeuft..."}
          {state === "processing" && "KI analysiert..."}
          {state === "ai-speaking" && "KI antwortet..."}
        </span>
      </motion.div>
    </div>
  );
}

// ─── B. Correction Card ───────────────────────────────────────────────────────

function CorrectionCard({ exchange }: { exchange: Exchange }) {
  const [view, setView] = useState<"original" | "corrected">("original");
  const [isPlayingOrig, setIsPlayingOrig] = useState(false);
  const [isPlayingCorr, setIsPlayingCorr] = useState(false);

  const simulatePlay = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
    setTimeout(() => setter(false), 2200);
  };

  const errorTypeLabel: Record<string, { label: string; color: string }> = {
    auxiliary: { label: "Hilfsverb", color: "#F87171" },
    preposition: { label: "Praeposition", color: "#FB923C" },
    grammar: { label: "Grammatik", color: "#FBBF24" },
    vocab: { label: "Vokabular", color: "#A78BFA" },
  };

  return (
    <motion.div
      className="rounded-[16px] overflow-hidden"
      style={{
        ...glass,
        border: "1px solid rgba(255,75,75,0.25)",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Toggle header */}
      <div
        className="flex border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        {(["original", "corrected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="flex-1 py-2.5 text-xs font-semibold transition-all relative"
            style={{ color: view === tab ? "white" : "rgba(255,255,255,0.4)" }}
          >
            {tab === "original" ? "Deine Aussprache" : "KI-Korrektur"}
            {view === tab && (
              <motion.div
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ background: tab === "original" ? "#F87171" : MINT }}
                layoutId="correctionTab"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {view === "original" ? (
            <motion.div
              key="original"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 leading-relaxed">
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {exchange.segments.map((seg, i) =>
                      seg.isError ? (
                        <span
                          key={i}
                          className="relative inline-block mx-0.5"
                          style={{
                            textDecoration: "line-through",
                            textDecorationColor: "#F87171",
                            textDecorationThickness: 2,
                            color: "#FCA5A5",
                            background: "rgba(248,113,113,0.1)",
                            borderRadius: 4,
                            padding: "0 3px",
                          }}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </p>
                </div>

                <button
                  onClick={() => simulatePlay(setIsPlayingOrig)}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isPlayingOrig ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {isPlayingOrig
                    ? <Pause size={11} className="text-red-300" />
                    : <Play size={11} className="text-white/60" fill="rgba(255,255,255,0.6)" />
                  }
                </button>
              </div>

              {/* Error badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {exchange.segments
                  .filter((s) => s.isError && s.errorType)
                  .map((s, i) => {
                    const conf = errorTypeLabel[s.errorType!];
                    return (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${conf.color}20`, color: conf.color, border: `1px solid ${conf.color}40` }}
                      >
                        {conf.label}: "{s.text}" → "{s.correction}"
                      </span>
                    );
                  })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="corrected"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p
                    className="text-[13px] font-semibold leading-relaxed"
                    style={{ color: MINT }}
                  >
                    {exchange.corrected}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Check size={11} style={{ color: MINT }} />
                    <span className="text-[10px]" style={{ color: MINT }}>
                      Grammatisch korrekt
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => simulatePlay(setIsPlayingCorr)}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isPlayingCorr ? `${MINT}30` : "rgba(255,255,255,0.08)",
                    border: `1px solid ${isPlayingCorr ? MINT + "60" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {isPlayingCorr
                    ? <Pause size={11} style={{ color: MINT }} />
                    : <Play size={11} style={{ color: MINT }} fill={MINT} />
                  }
                </button>
              </div>

              {/* Playing waveform */}
              {isPlayingCorr && (
                <motion.div
                  className="flex items-end gap-0.5 mt-2"
                  style={{ height: 16 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[4, 7, 12, 9, 14, 10, 6, 9, 13, 8, 5].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-1 rounded-full"
                      style={{ background: MINT }}
                      animate={{ height: [h, h * 1.8, h] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                  <span className="ml-1.5 text-[10px] self-center" style={{ color: MINT }}>
                    Aussprache...
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ exchange, isUser }: { exchange: Exchange; isUser: boolean }) {
  if (!isUser) {
    return (
      <motion.div
        className="flex items-start gap-2.5"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {/* AI avatar */}
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
          style={{
            background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})`,
            boxShadow: `0 4px 12px rgba(34,211,238,0.3)`,
          }}
        >
          🤖
        </div>
        <div className="flex-1 max-w-[82%]">
          <p className="text-[10px] mb-1.5 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
            KI-Tutor
          </p>
          <div
            className="rounded-[14px] rounded-tl-[4px] px-4 py-3"
            style={{
              background: "rgba(34,211,238,0.09)",
              border: `1px solid rgba(34,211,238,0.2)`,
            }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
              {exchange.aiResponse}
            </p>
          </div>
          <p className="text-[9px] mt-1 ml-1" style={{ color: "rgba(255,255,255,0.25)" }}>
            {exchange.timestamp}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-end"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <p className="text-[10px] mb-1.5 mr-1 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
        Du
      </p>
      {exchange.hasError ? (
        <div className="w-full">
          <CorrectionCard exchange={exchange} />
        </div>
      ) : (
        <div
          className="rounded-[14px] rounded-tr-[4px] px-4 py-3 self-end"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            maxWidth: "82%",
          }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
            {exchange.segments.map((s) => s.text).join("")}
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            <Check size={10} style={{ color: MINT }} />
            <span className="text-[9px]" style={{ color: MINT }}>
              Kein Fehler
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mt-1 mr-1">
        <div
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: exchange.score >= 90 ? `${MINT}20` : exchange.score >= 75 ? "rgba(251,191,36,0.2)" : "rgba(248,113,113,0.2)",
            color: exchange.score >= 90 ? MINT : exchange.score >= 75 ? "#FBBF24" : "#F87171",
          }}
        >
          {exchange.score}%
        </div>
        <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          {exchange.timestamp}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Mic Button ───────────────────────────────────────────────────────────────

function MicButton({ state, onToggle }: { state: SessionState; onToggle: () => void }) {
  const isListening = state === "listening";
  const isDisabled = state === "processing" || state === "ai-speaking";

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings */}
      {isListening && [0, 0.25, 0.55].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 88,
            height: 88,
            border: "2px solid rgba(239,68,68,0.5)",
          }}
          animate={{ scale: [1, 2.8], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }}
        />
      ))}

      {/* Idle glow ring */}
      {!isListening && !isDisabled && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 88,
            height: 88,
            background: `radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      )}

      <motion.button
        onClick={() => !isDisabled && onToggle()}
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          background: isDisabled
            ? "rgba(255,255,255,0.08)"
            : isListening
            ? "linear-gradient(145deg, #F87171, #EF4444)"
            : `linear-gradient(145deg, ${CYAN}, ${PURPLE})`,
          boxShadow: isDisabled
            ? "none"
            : isListening
            ? "0 0 32px rgba(239,68,68,0.5), 0 8px 24px rgba(0,0,0,0.4)"
            : `0 0 32px rgba(34,211,238,0.4), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.5 : 1,
        }}
        whileHover={!isDisabled ? { scale: 1.05 } : {}}
        whileTap={!isDisabled ? { scale: 0.92, y: 3 } : {}}
      >
        {/* Inner shine */}
        <div
          className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: "55%", height: 4, background: "rgba(255,255,255,0.3)" }}
        />
        {isListening
          ? <MicOff size={28} className="text-white" strokeWidth={2} />
          : <Mic size={28} className="text-white" strokeWidth={2} />
        }
      </motion.button>
    </div>
  );
}

// ─── C. Session Summary ───────────────────────────────────────────────────────

function SessionSummary({
  exchanges,
  duration,
  onRestart,
  onExit,
}: {
  exchanges: Exchange[];
  duration: string;
  onRestart: () => void;
  onExit: () => void;
}) {
  const fluencyScore = Math.round(
    exchanges.reduce((s, e) => s + e.score, 0) / exchanges.length
  );
  const errorCount = exchanges.filter((e) => e.hasError).length;
  const perfectCount = exchanges.filter((e) => !e.hasError).length;

  // SVG circular progress
  const size = 148;
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (fluencyScore / 100) * circ;

  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = fluencyScore / 60;
      let current = 0;
      const interval = setInterval(() => {
        current = Math.min(current + step, fluencyScore);
        setAnimScore(Math.round(current));
        if (current >= fluencyScore) clearInterval(interval);
      }, 16);
      return () => clearInterval(interval);
    }, 400);
    return () => clearTimeout(timer);
  }, [fluencyScore]);

  const animOffset = circ - (animScore / 100) * circ;

  return (
    <motion.div
      className="flex flex-col gap-5 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="text-center pt-2">
        <motion.div
          className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
          style={{
            background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})`,
            boxShadow: `0 6px 0 0 rgba(0,0,0,0.3), 0 10px 28px rgba(34,211,238,0.3)`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        >
          🎯
        </motion.div>
        <h2 className="text-white font-extrabold text-xl">Sitzung beendet!</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          Klasse Arbeit, du machst grosse Fortschritte!
        </p>
      </div>

      {/* Fluency Score + stats */}
      <div
        className="rounded-[20px] p-5"
        style={glass}
      >
        <div className="flex items-center gap-5">
          {/* Circular progress */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={CYAN} />
                  <stop offset="100%" stopColor={PURPLE} />
                </linearGradient>
              </defs>
              {/* Track */}
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10}
              />
              {/* Progress */}
              <motion.circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={animOffset}
                style={{ filter: `drop-shadow(0 0 8px ${CYAN}80)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-extrabold text-3xl leading-none">{animScore}</span>
              <span className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                / 100
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="flex-1 grid grid-cols-2 gap-2.5">
            {[
              { icon: Clock, label: "Dauer", value: duration, color: CYAN },
              { icon: TrendingUp, label: "Austausche", value: `${exchanges.length}`, color: PURPLE },
              { icon: Check, label: "Perfekt", value: `${perfectCount}`, color: MINT },
              { icon: AlertTriangle, label: "Fehler", value: `${errorCount}`, color: "#F87171" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-[12px] p-2.5 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <Icon size={13} style={{ color }} />
                <span className="text-white font-bold text-base leading-none">{value}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Fluency Score</span>
            <span
              className="text-xs font-bold"
              style={{ color: fluencyScore >= 85 ? MINT : fluencyScore >= 65 ? "#FBBF24" : "#F87171" }}
            >
              {fluencyScore >= 85 ? "Ausgezeichnet" : fluencyScore >= 65 ? "Gut" : "Ueben"}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 0 8px ${CYAN}60` }}
              initial={{ width: 0 }}
              animate={{ width: `${fluencyScore}%` }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* New Vocabulary */}
      <div className="rounded-[20px] overflow-hidden" style={glass}>
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <BookOpen size={14} style={{ color: CYAN }} />
          <span className="text-white font-semibold text-sm">Neues Vokabular</span>
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${CYAN}20`, color: CYAN }}
          >
            {LEARNED_VOCAB.length} Woerter
          </span>
        </div>
        <div className="divide-y" style={{ "--tw-divide-opacity": 1, borderColor: "transparent" }}>
          {LEARNED_VOCAB.map((v, i) => (
            <motion.div
              key={v.german}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: CYAN }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">{v.german}</span>
                  <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{v.phonetic}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {v.level}
                  </span>
                </div>
                <p className="text-xs mt-0.5 italic" style={{ color: MINT }}>
                  {v.vietnamese}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="rounded-[20px] overflow-hidden" style={glass}>
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <AlertTriangle size={14} className="text-[#FBBF24]" />
          <span className="text-white font-semibold text-sm">Haeufige Fehler</span>
        </div>
        {COMMON_MISTAKES.map((m, i) => {
          const sev = { high: "#F87171", medium: "#FB923C", low: "#FBBF24" }[m.severity];
          return (
            <motion.div
              key={m.label}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.08 }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold mt-0.5"
                style={{ background: `${sev}20`, color: sev, border: `1px solid ${sev}40` }}
              >
                {m.count}×
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{m.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {m.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 px-1 pb-2">
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 flex-1 py-3 rounded-[14px] font-semibold text-sm transition-all"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <RotateCcw size={14} /> Neu starten
        </button>
        <button
          onClick={onExit}
          className="flex items-center justify-center gap-2 flex-[2] py-3 rounded-[14px] font-bold text-sm transition-all"
          style={{
            background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
            color: "white",
            boxShadow: `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 20px rgba(34,211,238,0.25)`,
          }}
        >
          <Download size={14} /> Sitzung speichern
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Speaking Page ───────────────────────────────────────────────────────

export default function Speaking() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [exchanges, setExchanges] = useState<Exchange[]>(INITIAL_EXCHANGES);
  const [seconds, setSeconds] = useState(224); // start at 03:44
  const chatRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer
  useEffect(() => {
    if (sessionState === "summary") {
      clearInterval(timerRef.current!);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current!);
  }, [sessionState]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [exchanges, sessionState]);

  const handleMicToggle = useCallback(() => {
    if (sessionState === "idle") {
      setSessionState("listening");
      // Auto-transition
      stateRef.current = setTimeout(() => {
        setSessionState("processing");
        setTimeout(() => {
          setSessionState("ai-speaking");
          // Add new exchange
          setExchanges((prev) => {
            if (prev.find((e) => e.id === SIMULATED_NEXT.id)) return prev;
            return [...prev, SIMULATED_NEXT];
          });
          setTimeout(() => setSessionState("idle"), 2800);
        }, 1400);
      }, 2800);
    } else if (sessionState === "listening") {
      clearTimeout(stateRef.current!);
      setSessionState("processing");
      setTimeout(() => {
        setSessionState("ai-speaking");
        setExchanges((prev) => {
          if (prev.find((e) => e.id === SIMULATED_NEXT.id)) return prev;
          return [...prev, SIMULATED_NEXT];
        });
        setTimeout(() => setSessionState("idle"), 2800);
      }, 1400);
    }
  }, [sessionState]);

  const handleEnd = () => {
    clearTimeout(stateRef.current!);
    setSessionState("summary");
  };

  const handleRestart = () => {
    setExchanges(INITIAL_EXCHANGES);
    setSeconds(224);
    setSessionState("idle");
  };

  return (
    <div
      className="min-h-screen flex flex-col pb-24"
      style={{ background: "linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)" }}
    >
      <div className="max-w-[430px] mx-auto w-full flex flex-col flex-1">
        {/* Floating glow orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute rounded-full"
            style={{
              top: "10%", left: "5%", width: 320, height: 320,
              background: `radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              top: "50%", right: "5%", width: 380, height: 380,
              background: `radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)`,
              filter: "blur(50px)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              bottom: "10%", left: "30%", width: 260, height: 260,
              background: `radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)`,
              filter: "blur(35px)",
            }}
          />
        </div>

        {/* Phone frame */}
        <div
          className="relative w-full sm:max-w-[420px] min-h-screen sm:min-h-0 flex flex-col"
          style={{
            background: "rgba(10,22,40,0.6)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "0 0 0 0",
            ...(typeof window !== "undefined" && window.innerWidth >= 640
              ? { borderRadius: 40, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }
              : {}),
          }}
        >
          {/* ── Top Bar ─────────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 py-1.5 px-2 rounded-[10px] transition-colors"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <ChevronLeft size={16} />
              <span className="text-xs">Zurueck</span>
            </button>

            {/* Level badge */}
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: `linear-gradient(135deg, ${CYAN}25, ${PURPLE}25)`,
                  border: `1px solid ${CYAN}40`,
                  color: CYAN,
                }}
              >
                B1
              </span>

              {/* Timer */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Clock size={11} style={{ color: "rgba(255,255,255,0.45)" }} />
                <span
                  className="font-mono font-bold text-sm tracking-widest"
                  style={{ color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatTime(seconds)}
                </span>
              </div>
            </div>

            <button
              className="p-2 rounded-[10px] transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <Settings size={16} />
            </button>
          </div>

          {sessionState === "summary" ? (
            /* ── SUMMARY VIEW ─────────────────────────────────────────────── */
            <div className="flex-1 overflow-y-auto px-4 pt-4" ref={chatRef}>
              <SessionSummary
                exchanges={exchanges}
                duration={formatTime(seconds)}
                onRestart={handleRestart}
                onExit={() => navigate("/")}
              />
            </div>
          ) : (
            <>
              {/* ── Chat History ────────────────────────────────────────────── */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
                style={{ minHeight: 0, maxHeight: "calc(100vh - 340px)", scrollbarWidth: "none" }}
              >
                {exchanges.map((ex, i) => (
                  <div key={ex.id} className="flex flex-col gap-2.5">
                    <ChatBubble exchange={ex} isUser={true} />
                    <ChatBubble exchange={ex} isUser={false} />
                  </div>
                ))}

                {/* Processing indicator */}
                {sessionState === "processing" && (
                  <motion.div
                    className="flex items-center gap-2.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})` }}
                    >
                      🤖
                    </div>
                    <div
                      className="rounded-[14px] rounded-tl-[4px] px-4 py-3 flex items-center gap-1.5"
                      style={{ background: "rgba(34,211,238,0.09)", border: `1px solid rgba(34,211,238,0.2)` }}
                    >
                      {[0, 0.2, 0.4].map((d) => (
                        <motion.div
                          key={d}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: CYAN }}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: d }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── Voice Visualizer + Controls ─────────────────────────────── */}
              <div
                className="flex-shrink-0 px-4 pb-4 pt-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Visualizer */}
                <div
                  className="rounded-[20px] p-5 mb-4 flex flex-col items-center gap-1"
                  style={glass}
                >
                  <VoiceVisualizer state={sessionState} />

                  {/* Prompt text */}
                  <AnimatePresence mode="wait">
                    {sessionState === "idle" && (
                      <motion.div
                        key="prompt"
                        className="mt-3 rounded-[12px] px-4 py-2.5 text-center max-w-[280px]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                      >
                        <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                          <span style={{ color: CYAN }}>Thema:</span> Beschreibe deinen letzten Urlaub auf Deutsch.
                        </p>
                      </motion.div>
                    )}
                    {sessionState === "listening" && (
                      <motion.p
                        key="listen"
                        className="text-xs mt-3 font-semibold"
                        style={{ color: "#F87171" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [1, 0.5, 1] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        Spreche jetzt auf Deutsch...
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mic + controls row */}
                <div className="flex items-center justify-between px-2">
                  <button
                    onClick={handleEnd}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-sm font-medium transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <X size={14} /> Beenden
                  </button>

                  <MicButton state={sessionState} onToggle={handleMicToggle} />

                  <div
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-sm font-medium"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Zap size={13} style={{ color: CYAN }} />
                    <span className="text-xs" style={{ color: CYAN }}>
                      {exchanges.filter((e) => !e.hasError).length}/{exchanges.length}
                    </span>
                  </div>
                </div>

                <p className="text-center text-[10px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {sessionState === "idle"
                    ? "Druecke den Knopf und sprich frei"
                    : sessionState === "listening"
                    ? "Druecke erneut zum Stoppen"
                    : "KI verarbeitet deine Eingabe..."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}