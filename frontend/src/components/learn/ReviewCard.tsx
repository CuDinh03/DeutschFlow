"use client";

import { useState, useCallback } from "react";
import { playTTS } from "@/lib/tts";
import { lightImpact, mediumImpact, heavyImpact } from "@/lib/haptics";
import { QUALITY_LEVELS } from "@/lib/srsGrading";

interface ReviewCardProps {
  id: number;
  vocabId: string;
  german: string;
  meaning: string;
  exampleDe?: string;
  speakDe?: string;
  onRate: (vocabId: string, quality: number) => void;
}

export default function ReviewCard({
  vocabId, german, meaning, exampleDe, speakDe, onRate,
}: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(false);

  const handleRate = useCallback((quality: number) => {
    if (rated) return;
    setRated(true);
    // Low recall (forgot/hard) → strong tap; good recall → firm tap.
    if (quality <= 2) heavyImpact();
    else mediumImpact();
    onRate(vocabId, quality);
  }, [vocabId, rated, onRate]);

  const handleFlip = useCallback(() => {
    if (flipped) return;
    mediumImpact();
    setFlipped(true);
  }, [flipped]);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Card with 3D flip */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: "1200px" }}
        onClick={handleFlip}
      >
        <div
          className="relative transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: 220,
          }}
        >
          {/* Front — tiếng Đức */}
          <div
            className="absolute inset-0 rounded-3xl border-2 border-[#E2E8F0] bg-white shadow-lg flex flex-col items-center justify-center p-6 gap-4"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Tiếng Đức</p>
            <p className="text-3xl font-black text-[#0F172A] text-center">{german}</p>
            {speakDe && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); lightImpact(); playTTS(speakDe); }}
                className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#121212] transition-colors bg-[#F1F5F9] hover:bg-[#E2E8F0] px-3 py-1.5 rounded-full"
              >
                🔊 Nghe phát âm
              </button>
            )}
            <p className="text-xs text-[#94A3B8] mt-2 animate-pulse">Nhấn để xem nghĩa →</p>
          </div>

          {/* Back — nghĩa + example */}
          <div
            className="absolute inset-0 rounded-3xl border-2 border-[#FFCD00] bg-[#FFFBEA] shadow-lg flex flex-col items-center justify-center p-6 gap-3"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#92400E]">Tiếng Việt</p>
            <p className="text-2xl font-black text-[#0F172A] text-center">{meaning}</p>
            {exampleDe && (
              <p className="text-xs text-[#64748B] italic text-center border-t border-[#FDE68A] pt-2 mt-1">
                &ldquo;{exampleDe}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons (appear after flip) — shared SRS quality scale */}
      {flipped && !rated && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {QUALITY_LEVELS.map(({ q, emoji, label, color, bg }) => (
            <button
              key={q}
              type="button"
              onClick={() => handleRate(q)}
              className="flex flex-col items-center gap-1 text-[9px] font-bold py-2.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
              style={{ background: bg, borderColor: color, color }}
            >
              <span className="text-base">{emoji}</span>
              <span className="leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      )}

      {rated && (
        <div className="mt-4 text-center">
          <p className="text-sm text-[#10B981] font-bold animate-pulse">✓ Đã ghi nhận</p>
        </div>
      )}
    </div>
  );
}
