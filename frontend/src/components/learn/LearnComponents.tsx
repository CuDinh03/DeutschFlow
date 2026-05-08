"use client";

import { VocabItem } from "@/stores/useNodeSessionStore";
import { useState, useCallback } from "react";

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
      // Edge TTS via backend
      const resp = await fetch(`/api/tts/speak?text=${encodeURIComponent(text)}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setState("idle"); URL.revokeObjectURL(url); };
      audio.onerror = () => setState("idle");
      setState("playing");
      await audio.play();
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
export function VocabCard({ vocab }: { vocab: VocabItem }) {
  const [showMeaning, setShowMeaning] = useState(false);

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GenderBadge gender={vocab.gender} label={vocab.gender_label} />
        <span className="font-bold text-[#0F172A] text-sm">{vocab.german}</span>
        <AudioButton text={vocab.speak_de} compact />
      </div>

      <button
        type="button"
        onClick={() => setShowMeaning(!showMeaning)}
        className="text-xs text-[#64748B] hover:text-[#121212] transition-colors flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          {showMeaning
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          }
        </svg>
        {showMeaning ? "Ẩn nghĩa" : "Hiện nghĩa"}
      </button>

      {showMeaning && (
        <div className="space-y-1 animate-in fade-in duration-200">
          <p className="text-sm text-[#475569]">{vocab.meaning}</p>
          <p className="text-xs text-[#94A3B8] italic">"{vocab.example_de}"</p>
          <p className="text-xs text-[#94A3B8]">→ {vocab.example_vi}</p>
          {vocab.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {vocab.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
