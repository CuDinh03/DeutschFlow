"use client";

import { motion } from "framer-motion";
import { ChevronRight, Trophy } from "lucide-react";
import type { GrammarTopic } from "../page";

function MasteryBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? "#22c55e" : percent >= 50 ? "#f59e0b" : "#6366f1";
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export default function TopicCard({ topic, onOpen }: { topic: GrammarTopic; onOpen: (topic: GrammarTopic) => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(topic)}
      className="w-full text-left bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">{topic.title_de}</p>
            {topic.mastery_percent >= 80 && <Trophy size={14} className="text-yellow-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 mb-3">{topic.title_vi}</p>
          <MasteryBar percent={topic.mastery_percent} />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-extrabold" style={{ color: topic.mastery_percent >= 80 ? "#22c55e" : "#6366F1" }}>{Math.round(topic.mastery_percent)}%</p>
          <p className="text-xs text-slate-400">{topic.exercises_done} bài</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">{topic.total_exercises ?? 0} bài tập có sẵn</span>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </div>
    </motion.button>
  );
}
