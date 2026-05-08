"use client";

import React, { useState } from "react";
import { VocabWord } from "@/types/vocabulary";
import { VocabCard } from "@/components/features/vocabulary/VocabCard";
import { ArrowLeft, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Mock Data
const mockVocabList: VocabWord[] = [
  {
    id: "v1",
    wordDe: "Kaffee",
    article: "der",
    plural: "Kaffees",
    meaningVi: "Cà phê",
    exampleSentenceDe: "Ich trinke jeden Morgen einen Kaffee.",
    exampleSentenceVi: "Tôi uống một ly cà phê mỗi buổi sáng.",
    partOfSpeech: "Noun",
    cefrLevel: "A1",
    masteryLevel: 20,
  },
  {
    id: "v2",
    wordDe: "schnell",
    article: null,
    plural: null,
    meaningVi: "Nhanh chóng",
    exampleSentenceDe: "Er fährt sehr schnell.",
    exampleSentenceVi: "Anh ấy lái xe rất nhanh.",
    partOfSpeech: "Adjective",
    cefrLevel: "A1",
    masteryLevel: 50,
  },
  {
    id: "v3",
    wordDe: "entscheiden",
    article: null,
    plural: null,
    meaningVi: "Quyết định",
    exampleSentenceDe: "Ich kann mich nicht entscheiden.",
    exampleSentenceVi: "Tôi không thể đưa ra quyết định.",
    partOfSpeech: "Verb",
    cefrLevel: "A2",
    masteryLevel: 10,
  }
];

export default function VocabularyPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const handleNext = (known: boolean) => {
    if (known) {
      setScore(s => s + 1);
    }
    
    if (currentIndex < mockVocabList.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      setCompleted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="flex items-center justify-between px-4 py-4 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Quay lại Dashboard</span>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold px-4 py-2 rounded-full text-sm">
            {currentIndex + 1} / {mockVocabList.length} Từ vựng
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {!completed ? (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50, rotate: 5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: -50, rotate: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-md"
            >
              <VocabCard 
                word={mockVocabList[currentIndex]} 
                onNext={handleNext}
              />
            </motion.div>
          ) : (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
                Tuyệt vời!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Bạn đã hoàn thành bộ từ vựng hôm nay. Bạn nhớ được <strong className="text-emerald-500">{score}/{mockVocabList.length}</strong> từ.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-4 bg-brand-black hover:bg-neutral-800 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-neutral-500/30"
              >
                Trở về Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}