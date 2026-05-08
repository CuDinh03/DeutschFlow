import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StreamStatus } from "@/types/ai-speaking";
import { Loader2, Zap, AlertTriangle, Mic } from "lucide-react";

interface StreamStatusIndicatorProps {
  status: StreamStatus;
}

export function StreamStatusIndicator({ status }: StreamStatusIndicatorProps) {
  if (status === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex items-center justify-center my-4"
      >
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          {status === "listening" && (
            <>
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-red-400 animate-ping"></span>
                <Mic className="relative w-4 h-4 text-red-500" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Đang nghe bạn nói...
              </span>
            </>
          )}

          {status === "processing" && (
            <>
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                AI đang phân tích câu của bạn...
              </span>
            </>
          )}

          {status === "streaming" && (
            <>
              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Đang nhận phản hồi...
              </span>
            </>
          )}

          {status === "fallback" && (
            <>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                Đang xử lý JSON / Fallback...
              </span>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
