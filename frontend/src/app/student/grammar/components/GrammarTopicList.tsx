"use client";

import { Loader2 } from "lucide-react";
const CEFR_LEVELS = ["A1", "A2", "B1", "B2"];
import type { GrammarTopic } from "../page";
import GrammarHeader from "./GrammarHeader";

export function GrammarTopicList({
  cefr,
  loading,
  topics,
  onChangeCefr,
  onOpenTopic,
}: {
  cefr: string;
  loading: boolean;
  topics: GrammarTopic[];
  onChangeCefr: (level: string) => void;
  onOpenTopic: (topic: GrammarTopic) => void;
}) {
  return (
    <div className="space-y-6">
      <GrammarHeader />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CEFR_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onChangeCefr(level)}
            className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border transition-all"
            style={{ background: level === cefr ? "#6366F1" : "#EEF2FF", color: level === cefr ? "white" : "#6366F1", borderColor: level === cefr ? "#6366F1" : "#E0E7FF" }}
          >
            {level}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#6366F1]" />
        </div>
      )}
    </div>
  );
}
