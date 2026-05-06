"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import type { Suggestion } from "@/lib/aiSpeakingApi";

interface SuggestionBarProps {
  suggestions: Suggestion[];
  onSelect: (text: string) => void;
}

export function SuggestionBar({ suggestions, onSelect }: SuggestionBarProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35 }}
      className="mt-3 mb-2"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Lightbulb size={13} className="text-amber-400" />
        </motion.div>
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          Gợi ý trả lời:
        </span>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2">
        {suggestions.slice(0, 3).map((sug, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelect(sug.german_text)}
            className="group relative rounded-2xl text-left transition-all"
            style={{
              background: "rgba(34,211,238,0.06)",
              border: "1px solid rgba(34,211,238,0.15)",
            }}
          >
            <div className="px-3.5 py-2.5">
              {/* German text */}
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-snug">
                {sug.german_text}
              </p>
              {/* Vietnamese translation */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 italic">
                {sug.vietnamese_translation}
              </p>
              {/* CEFR level tag */}
              {sug.level && (
                <span
                  className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1"
                  style={{
                    background: "rgba(34,211,238,0.12)",
                    color: "#22d3ee",
                  }}
                >
                  {sug.level}
                </span>
              )}
            </div>
            {/* Hover glow */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))",
                boxShadow: "0 0 16px rgba(34,211,238,0.15)",
              }}
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
