"use client";

import React, { useState } from "react";
import { VocabWord } from "@/types/vocabulary";
import { Volume2, Mic, RotateCw, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { useSpeech } from "@/hooks/useSpeech";

interface VocabCardProps {
  word: VocabWord;
  onNext?: (known: boolean) => void;
}

export function VocabCard({ word, onNext }: VocabCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [userPronunciation, setUserPronunciation] = useState<string | null>(null);
  
  const { speak, startListening, stopListening, isListening } = useSpeech({
    lang: "de-DE",
  });

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speak(`${word.article ? word.article + " " : ""}${word.wordDe}`);
  };

  const handleMicrophone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      setUserPronunciation(null);
      startListening((text, isFinal) => {
        if (isFinal) {
          setUserPronunciation(text);
          // Very basic validation logic
          if (text.toLowerCase().includes(word.wordDe.toLowerCase())) {
            // Give some positive feedback
          }
        }
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto aspect-[3/4] perspective-1000">
      <motion.div
        className="w-full h-full relative preserve-3d cursor-pointer"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front of Card (German) */}
        <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col p-8">
          <div className="flex justify-between items-start mb-auto">
            <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              {word.cefrLevel}
            </span>
            <span className="text-sm font-medium text-slate-400">
              {word.partOfSpeech}
            </span>
          </div>

          <div className="text-center my-auto">
            {word.article && (
              <span className="text-lg md:text-xl text-slate-500 font-medium block mb-2">
                {word.article}
              </span>
            )}
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              {word.wordDe}
            </h2>
            {word.plural && (
              <span className="text-sm text-slate-400 font-medium">
                pl: {word.plural}
              </span>
            )}
          </div>

          <div className="flex justify-center gap-4 mt-auto">
            <button
              onClick={handleSpeak}
              className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400 transition-colors"
              title="Phát âm (TTS)"
            >
              <Volume2 className="w-6 h-6" />
            </button>
            <button
              onClick={handleMicrophone}
              className={`p-4 rounded-full transition-colors ${
                isListening
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-400"
              }`}
              title="Luyện phát âm (STT)"
            >
              <Mic className="w-6 h-6" />
            </button>
          </div>
          
          {userPronunciation && (
             <div className="absolute bottom-24 left-0 right-0 text-center px-4">
               <div className="inline-block bg-slate-800/80 backdrop-blur text-white text-sm px-4 py-2 rounded-2xl">
                 Bạn nói: "{userPronunciation}"
               </div>
             </div>
          )}

          <div className="absolute bottom-4 left-0 right-0 flex justify-center text-slate-400">
            <div className="flex items-center gap-2 text-xs">
              <RotateCw className="w-3 h-3" /> Chạm để lật
            </div>
          </div>
        </div>

        {/* Back of Card (Vietnamese Meaning & Examples) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-50 dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col p-8 overflow-y-auto">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {word.meaningVi}
            </h3>
            <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full" />
          </div>

          <div className="flex-1">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mb-4">
              <p className="text-slate-700 dark:text-slate-300 font-medium mb-2 leading-relaxed">
                "{word.exampleSentenceDe}"
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {word.exampleSentenceVi}
              </p>
            </div>
          </div>

          {onNext && (
            <div className="flex justify-between gap-4 mt-auto pt-4">
              <button
                onClick={(e) => { e.stopPropagation(); onNext(false); }}
                className="flex-1 py-4 flex justify-center items-center gap-2 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 transition-colors"
              >
                <X className="w-5 h-5" /> Chưa thuộc
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNext(true); }}
                className="flex-1 py-4 flex justify-center items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-100 transition-colors"
              >
                <Check className="w-5 h-5" /> Đã thuộc
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
