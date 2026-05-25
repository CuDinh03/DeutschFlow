"use client";

import { VocabItem } from "@/stores/useNodeSessionStore";
import { useState, useCallback, useEffect, useRef } from "react";
import { playTTS } from "@/lib/tts";
import { motion } from "framer-motion";

// ── Gender Badge (Accessibility: color + letter) ──
export function GenderBadge({ gender, label }: { gender: string | null; label: string | null }) {
  if (!gender) return null;
  const colors: Record<string, string> = {
    DER: "#3B82F6", DIE: "#EF4444", DAS: "#22C55E",
  };
  const bg = colors[gender] ?? "#94A3B8";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
      style={{ backgroundColor: bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
      {label ?? gender.charAt(0).toLowerCase()}
    </span>
  );
}

// ── Vocab Tag (Pill badge, clickable) ──
export function VocabTag({
  tag, active, onClick,
}: { tag: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all duration-200
        ${active
          ? "bg-[#FFCD00] text-[#121212] border-[#FFCD00] shadow-sm"
          : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-[#FFCD00]/10 hover:border-[#FFCD00] hover:text-[#121212]"
        }`}
    >
      {tag}
    </button>
  );
}

// ── Audio Button with states ──
export function AudioButton({ text, compact }: { text: string; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");

  const play = useCallback(async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      await playTTS(text);
      setState("playing");
      // Reset sau 2s (không có callback chính xác từ shared util)
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  }, [text, state]);

  return (
    <button
      type="button"
      onClick={play}
      disabled={state === "loading"}
      className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
        compact ? "w-7 h-7" : "w-8 h-8"
      } ${state === "playing" ? "bg-[#FFCD00] text-[#121212]" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#FFCD00]/20"}`}
      title="Nghe phát âm"
    >
      {state === "loading" && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {state === "playing" && (
        <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      )}
      {state === "idle" && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z" />
        </svg>
      )}
    </button>
  );
}

// ── Vocabulary Card ──
export function VocabCard({ vocab, autoPlay = false }: { vocab: VocabItem; autoPlay?: boolean }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const hasAutoPlayed = useRef(false);

  // Auto-play TTS lần đầu khi card xuất hiện (chỉ khi autoPlay=true)
  useEffect(() => {
    if (!autoPlay || hasAutoPlayed.current || !vocab.speak_de) return;
    hasAutoPlayed.current = true;
    const timer = setTimeout(() => playTTS(vocab.speak_de), 400);
    return () => clearTimeout(timer);
  }, [autoPlay, vocab.speak_de]);

  const handleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTTS(vocab.speak_de);
  };

  return (
    <div className="w-full h-32 sm:h-36" style={{ perspective: '1000px' }}>
      <motion.div
        className="w-full h-full relative cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Mặt trước: Tiếng Đức */}
        <div className="absolute inset-0 bg-white rounded-xl border border-[#E2E8F0] p-4 flex flex-col justify-center items-center shadow-sm hover:border-[#CBD5E1] transition-colors"
             style={{ backfaceVisibility: 'hidden' }}>
          <div className="absolute top-3 left-3">
             <GenderBadge gender={vocab.gender} label={vocab.gender_label} />
          </div>
          <div className="absolute top-3 right-3">
            <button onClick={handleAudio} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#FFCD00]/20 hover:text-[#121212] transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
            </button>
          </div>
          <span className="font-bold text-[#0F172A] text-2xl mt-3 text-center">{vocab.german}</span>
          {vocab.ai_speech_hints?.ipa_target && (
            <span className="text-xs text-[#64748B] font-mono mt-1">{vocab.ai_speech_hints.ipa_target}</span>
          )}
          <div className="absolute bottom-2 text-[10px] text-slate-400 font-medium">Bấm để lật</div>
        </div>

        {/* Mặt sau: Nghĩa và ví dụ */}
        <div className="absolute inset-0 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 flex flex-col justify-center items-center shadow-sm text-center overflow-hidden"
             style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <p className="text-sm font-bold text-[#0F172A] mb-1 px-2 line-clamp-2">{vocab.meaning}</p>
          {vocab.example_de && (
            <p className="text-xs text-[#475569] italic line-clamp-2 px-2 mt-1">"{vocab.example_de}"</p>
          )}
          {vocab.example_vi && (
            <p className="text-[10px] text-[#94A3B8] line-clamp-2 mt-1 px-2">{vocab.example_vi}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
