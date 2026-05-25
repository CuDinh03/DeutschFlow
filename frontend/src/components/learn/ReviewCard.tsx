"use client";

import { useState, useCallback } from "react";
import { playTTS } from "@/lib/tts";

interface ReviewCardProps {
  id: number;
  vocabId: string;
  german: string;
  meaning: string;
  exampleDe?: string;
  speakDe?: string;
  onRate: (vocabId: string, quality: number) => void;
}

const RATINGS = [
  { quality: 1, label: "😰 Quên", color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
  { quality: 2, label: "😅 Khó", color: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" },
  { quality: 3, label: "😊 Nhớ", color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" },
  { quality: 4, label: "🌟 Dễ", color: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" },
];

export default function ReviewCard({
  vocabId, german, meaning, exampleDe, speakDe, onRate,
}: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(false);

  const handleRate = useCallback((quality: number) => {
    if (rated) return;
    setRated(true);
    onRate(vocabId, quality);
  }, [vocabId, rated, onRate]);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Card with 3D flip */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: "1200px" }}
        onClick={() => !flipped && setFlipped(true)}
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
                onClick={(e) => { e.stopPropagation(); playTTS(speakDe); }}
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

      {/* Rating buttons (appear after flip) */}
      {flipped && !rated && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map(({ quality, label, color }) => (
            <button
              key={quality}
              type="button"
              onClick={() => handleRate(quality)}
              className={`text-xs font-bold py-2.5 rounded-xl border transition-all active:scale-95 ${color}`}
            >
              {label}
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
