"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TodayPlanDto } from "@/types/today-plan";
import { BookOpen, Mic, PenTool, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface TodayPlanBoardProps {
  plan: TodayPlanDto;
}

export function TodayPlanBoard({ plan }: TodayPlanBoardProps) {
  const router = useRouter();

  const getIcon = (type: string) => {
    switch (type) {
      case "vocabulary": return <BookOpen className="w-6 h-6 text-indigo-500" />;
      case "speaking": return <Mic className="w-6 h-6 text-blue-500" />;
      case "grammar": return <PenTool className="w-6 h-6 text-emerald-500" />;
      default: return <BookOpen className="w-6 h-6" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "vocabulary": return "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800";
      case "speaking": return "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800";
      case "grammar": return "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800";
      default: return "bg-slate-50 border-slate-100";
    }
  };

  const handleStartLesson = (type: string) => {
    if (type === "speaking") {
      router.push("/speaking");
    } else if (type === "vocabulary") {
      router.push("/vocabulary");
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Tiến độ hôm nay</h2>
          <span className="font-bold text-blue-600 dark:text-blue-400">{plan.dailyGoalProgress}%</span>
        </div>
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${plan.dailyGoalProgress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-blue-500 rounded-full"
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Bài học gợi ý</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {plan.suggestedLessons.map((lesson, idx) => (
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => handleStartLesson(lesson.type)}
            className={`cursor-pointer rounded-2xl p-5 border shadow-sm transition-all hover:scale-[1.02] ${getBgColor(lesson.type)}`}
          >
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm mb-4">
              {getIcon(lesson.type)}
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-1">{lesson.title}</h4>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span className="capitalize">{lesson.type}</span>
              <span>•</span>
              <span>~{lesson.estimatedMinutes} phút</span>
            </div>
          </motion.div>
        ))}
      </div>

      {plan.errorReviewList.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-500" />
            Lỗi cần ôn tập
          </h3>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {plan.errorReviewList.map((err, idx) => (
              <div 
                key={err.id} 
                className={`p-4 ${idx !== plan.errorReviewList.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
              >
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-md w-fit">
                    {err.category}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 line-through">
                      {err.mistake}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {err.correction}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
