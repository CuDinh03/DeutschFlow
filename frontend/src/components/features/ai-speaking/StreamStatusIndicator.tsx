"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StreamStatus } from "@/types/ai-speaking";
import { Loader2, Zap, AlertTriangle, Mic, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

interface StreamStatusIndicatorProps {
  status: StreamStatus;
  onRetry?: () => void;
  /** Match immersive speaking chat (dark gradient shell). */
  immersive?: boolean;
}

export function StreamStatusIndicator({ status, onRetry, immersive }: StreamStatusIndicatorProps) {
  const t = useTranslations("speaking.chat");

  if (status === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex flex-col items-center justify-center my-4 gap-2"
      >
        <div
          className={
            immersive
              ? "flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.08] border border-white/12"
              : "flex items-center gap-3 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700"
          }
        >
          {status === "listening" && (
            <>
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-red-400 animate-ping" />
                <Mic className="relative w-4 h-4 text-red-500" />
              </div>
              <span
                className={`text-sm font-medium ${immersive ? "text-white/75" : "text-slate-700 dark:text-slate-300"}`}
              >
                {t("statusListening")}
              </span>
            </>
          )}

          {status === "processing" && (
            <>
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span
                className={`text-sm font-medium ${immersive ? "text-white/75" : "text-slate-700 dark:text-slate-300"}`}
              >
                {t("statusProcessing")}
              </span>
            </>
          )}

          {status === "streaming" && (
            <>
              <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
              <span
                className={`text-sm font-medium ${immersive ? "text-white/75" : "text-slate-700 dark:text-slate-300"}`}
              >
                {t("statusStreaming")}
              </span>
            </>
          )}

          {status === "fallback" && (
            <>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                {t("statusFallback")}
              </span>
            </>
          )}

          {status === "error" && (
            <>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {t("statusError")}
              </span>
            </>
          )}

          {status === "stalled" && (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t("statusStalled")}
              </span>
            </>
          )}
        </div>

        {status === "stalled" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <RefreshCw size={14} />
            {t("retryStream")}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
