"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface SessionRecapProps {
  xpEarned: number;
  vocabCount: number;
  streakDays: number;
  nextNodeTitle?: string;
  onNext?: () => void;
  onBack?: () => void;
}

/** Confetti particle (CSS-only, no lib) */
function ConfettiPiece({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <div
      className="absolute top-0 w-2 h-3 rounded-sm opacity-0"
      style={{
        left: `${x}%`,
        backgroundColor: color,
        animation: `confettiFall 1.8s ${delay}s ease-in forwards`,
      }}
    />
  );
}

const CONFETTI_COLORS = ["#FFCD00", "#121212", "#22C55E", "#3B82F6", "#EF4444", "#F97316"];
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  x: Math.round(Math.random() * 100),
  delay: Math.random() * 0.8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
}));

export default function SessionRecap({
  xpEarned,
  vocabCount,
  streakDays,
  nextNodeTitle,
  onNext,
  onBack,
}: SessionRecapProps) {
  const router = useRouter();
  const confettiStarted = useRef(false);

  useEffect(() => {
    confettiStarted.current = true;
  }, []);

  const handleBack = () => {
    if (onBack) onBack();
    else router.push("/student/roadmap");
  };

  const handleNext = () => {
    if (onNext) onNext();
    else router.push("/student/roadmap");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {CONFETTI.map((c, i) => (
            <ConfettiPiece key={i} x={c.x} delay={c.delay} color={c.color} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
          className="relative w-full max-w-sm mx-4 rounded-3xl bg-white shadow-2xl overflow-hidden"
        >
          {/* Header gradient */}
          <div
            className="px-6 pt-8 pb-6 text-center"
            style={{ background: "linear-gradient(135deg, #121212 0%, #1E293B 100%)" }}
          >
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-white text-xl font-bold">Hoàn thành!</h2>
            <p className="text-white/70 text-sm mt-1">Bạn đã học xong bài này</p>
          </div>

          {/* Stats */}
          <div className="px-6 py-5 space-y-3">
            {/* XP */}
            <div className="flex items-center justify-between rounded-2xl bg-[#FFFBEA] border border-[#FFCD00]/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <span className="text-sm font-medium text-[#92400E]">XP kiếm được</span>
              </div>
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-black text-[#92400E]"
              >
                +{xpEarned}
              </motion.span>
            </div>

            {/* Vocab */}
            <div className="flex items-center justify-between rounded-2xl bg-[#F0FDF4] border border-[#22C55E]/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📖</span>
                <span className="text-sm font-medium text-[#166534]">Từ vựng mới</span>
              </div>
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="text-2xl font-black text-[#166534]"
              >
                {vocabCount} từ
              </motion.span>
            </div>

            {/* Streak */}
            <div className="flex items-center justify-between rounded-2xl bg-[#FFF7ED] border border-[#F97316]/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <span className="text-sm font-medium text-[#9A3412]">Chuỗi ngày học</span>
              </div>
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="text-2xl font-black text-[#9A3412]"
              >
                {streakDays} ngày
              </motion.span>
            </div>

            {nextNodeTitle && (
              <p className="text-xs text-center text-[#64748B] pt-1">
                Bài tiếp theo: <span className="font-semibold text-[#121212]">{nextNodeTitle}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #121212 0%, #1E293B 100%)" }}
            >
              {nextNodeTitle ? "Học bài tiếp theo →" : "Về lộ trình"}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="w-full py-2.5 rounded-2xl font-medium text-sm text-[#64748B] hover:text-[#121212] hover:bg-[#F1F5F9] transition-colors"
            >
              Về lộ trình học
            </button>
          </div>
        </motion.div>
      </div>

      {/* CSS-only confetti animation */}
      <style jsx global>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </AnimatePresence>
  );
}
