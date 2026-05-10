"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import ReviewCard from "@/components/learn/ReviewCard";
import api from "@/lib/api";

interface ReviewCardData {
  id: number;
  vocabId: string;
  german: string;
  meaning: string;
  exampleDe?: string;
  speakDe?: string;
  repetitions: number;
  nextReviewAt: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  const [cards, setCards] = useState<ReviewCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [sessionScore, setSessionScore] = useState({ reviewed: 0, good: 0 });

  useEffect(() => {
    if (!me) return;
    api.get<ReviewCardData[]>("/srs/due")
      .then((res) => {
        setCards(res.data ?? []);
        if ((res.data ?? []).length === 0) setDone(true);
      })
      .catch(() => setDone(true))
      .finally(() => setLoading(false));
  }, [me]);

  const handleRate = useCallback(async (vocabId: string, quality: number) => {
    try {
      await api.post("/srs/review", { vocabId, quality });
      setSessionScore((prev) => ({
        reviewed: prev.reviewed + 1,
        good: quality >= 3 ? prev.good + 1 : prev.good,
      }));
    } catch {
      // silent — still advance
    }

    // Advance after short delay
    setTimeout(() => {
      if (currentIndex + 1 >= cards.length) {
        setDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 600);
  }, [currentIndex, cards.length]);

  if (meLoading || !me) return null;

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? Math.round((currentIndex / cards.length) * 100) : 0;

  return (
    <StudentShell
      activeSection="roadmap"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="Ôn tập từ vựng"
      headerSubtitle="Spaced Repetition"
    >
      <div className="max-w-md mx-auto px-4 py-6 space-y-5">

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 space-y-5"
          >
            <div className="text-6xl">🎉</div>
            <h2 className="text-xl font-black text-[#0F172A]">Hoàn thành ôn tập!</h2>
            {sessionScore.reviewed > 0 && (
              <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 inline-block">
                <p className="text-sm text-[#64748B]">
                  Đã ôn <span className="font-black text-[#121212]">{sessionScore.reviewed}</span> từ ·{" "}
                  <span className="font-black text-green-600">{sessionScore.good}</span> từ nhớ tốt
                </p>
              </div>
            )}
            {cards.length === 0 && (
              <p className="text-sm text-[#64748B]">Không có từ nào cần ôn hôm nay 🌟</p>
            )}
            <button
              type="button"
              onClick={() => router.push("/student/roadmap")}
              className="px-6 py-3 rounded-2xl font-bold text-white text-sm"
              style={{ background: "linear-gradient(135deg,#121212,#1E293B)" }}
            >
              Về lộ trình
            </button>
          </motion.div>
        )}

        {!loading && !done && currentCard && (
          <>
            {/* Header progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="font-medium">📚 Ôn tập hôm nay</span>
                <span className="font-bold text-[#121212]">{currentIndex + 1}/{cards.length}</span>
              </div>
              <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#FFCD00]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <ReviewCard
                  id={currentCard.id}
                  vocabId={currentCard.vocabId}
                  german={currentCard.german}
                  meaning={currentCard.meaning}
                  exampleDe={currentCard.exampleDe}
                  speakDe={currentCard.speakDe}
                  onRate={handleRate}
                />
              </motion.div>
            </AnimatePresence>

            {/* Tips */}
            <div className="text-center">
              <p className="text-[10px] text-[#94A3B8]">
                😰 Quên = 1 ngày · 😅 Khó = 3 ngày · 😊 OK = 1 tuần · 🌟 Dễ = 2 tuần
              </p>
            </div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
