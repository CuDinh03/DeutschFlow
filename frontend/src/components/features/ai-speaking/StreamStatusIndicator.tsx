"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StreamStatus } from "@/types/ai-speaking";
import { Loader2, Zap, AlertTriangle, Mic, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

interface StreamStatusIndicatorProps {
  status: StreamStatus;
  onRetry?: () => void;
}

/** Live pill under the transcript. Single (warm-paper) appearance — the speaking
 *  flow no longer has a dark shell, so the old `immersive` variant is gone. */
export function StreamStatusIndicator({ status, onRetry }: StreamStatusIndicatorProps) {
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
        <div className="ga-ui flex items-center gap-3 px-4 py-2 rounded-ga-pill border border-ga-line bg-ga-card">
          {status === "listening" && (
            <>
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 bg-ga-red-soft animate-ping" />
                <Mic className="relative w-4 h-4 text-ga-red" />
              </div>
              <span className="text-sm font-medium text-ga-muted">{t("statusListening")}</span>
            </>
          )}

          {status === "processing" && (
            <>
              <Loader2 className="w-4 h-4 text-ga-gold animate-spin" />
              <span className="text-sm font-medium text-ga-muted">{t("statusProcessing")}</span>
            </>
          )}

          {status === "streaming" && (
            <>
              <Zap className="w-4 h-4 text-ga-gold animate-pulse" />
              <span className="text-sm font-medium text-ga-muted">{t("statusStreaming")}</span>
            </>
          )}

          {status === "fallback" && (
            <>
              <AlertTriangle className="w-4 h-4 text-ga-orange" />
              <span className="text-sm font-medium text-ga-orange">{t("statusFallback")}</span>
            </>
          )}

          {status === "error" && (
            <>
              <AlertTriangle className="w-4 h-4 text-ga-red" />
              <span className="text-sm font-medium text-ga-red">{t("statusError")}</span>
            </>
          )}

          {status === "stalled" && (
            <>
              <AlertTriangle className="w-4 h-4 text-ga-gold" />
              <span className="text-sm font-medium text-ga-gold">{t("statusStalled")}</span>
            </>
          )}
        </div>

        {status === "stalled" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ga-ui flex items-center gap-2 px-4 py-2 rounded-ga-pill text-sm font-semibold bg-ga-ink text-ga-bg hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} />
            {t("retryStream")}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
