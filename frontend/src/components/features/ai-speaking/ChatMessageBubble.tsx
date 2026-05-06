"use client";

import React, { useState } from "react";
import { ChatMessage } from "@/store/useChatStore";
import { AlertCircle, CheckCircle2, Volume2, VolumeX, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSpeak?: (text: string) => void;
  isSpeakingThis?: boolean;
}

export function ChatMessageBubble({ message, onSpeak, isSpeakingThis }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col mb-6 ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      {/* ── Main Bubble ──────────────────────────────────────────── */}
      <div className="flex items-end gap-2 w-full" style={{ justifyContent: isUser ? "flex-end" : "flex-start" }}>
        <div
          className={`relative px-4 py-3 rounded-2xl max-w-[85%] overflow-hidden ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-sm"
          }`}
        >
          {/* Shimmer overlay when streaming */}
          {message.isStreaming && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.12) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s ease-in-out infinite",
              }}
            />
          )}

          <p className="text-[15px] leading-relaxed whitespace-pre-wrap relative z-10">
            {message.contentDe}
            {message.isStreaming && (
              <motion.span
                className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom rounded-full"
                style={{ background: isUser ? "white" : "#22d3ee" }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </p>
        </div>

        {/* 🔊 Speaker icon — only for AI messages, after streaming is done */}
        {!isUser && !message.isStreaming && message.contentDe && onSpeak && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => onSpeak(message.contentDe)}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isSpeakingThis
                ? "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-500"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
            }`}
            title="Nghe lại"
          >
            {isSpeakingThis ? (
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <Volume2 size={15} />
              </motion.div>
            ) : (
              <Volume2 size={15} />
            )}
          </motion.button>
        )}
      </div>

      {/* ── Feedback Panel ───────────────────────────────────────── */}
      {!isUser && message.feedback && (
        <div className="mt-3 w-full max-w-[90%]">
          {message.feedback.errors && message.feedback.errors.length > 0 ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold mb-3">
                <AlertCircle className="w-5 h-5" />
                <span>AI nhận thấy một số lỗi cần sửa:</span>
              </div>
              <ul className="space-y-3">
                {message.feedback.errors.map((err, idx) => (
                  <li key={idx} className="text-sm bg-white dark:bg-slate-800 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                    <div className="text-red-500 font-medium line-through decoration-red-500/50 mb-1">
                      &quot;{err.wrongSpan}&quot;
                    </div>
                    {err.correctedSpan && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                        → &quot;{err.correctedSpan}&quot;
                      </div>
                    )}
                    <div className="text-slate-700 dark:text-slate-300">
                      {err.ruleViShort}
                    </div>
                  </li>
                ))}
              </ul>
              {message.feedback.explanationVi && (
                <div className="mt-3 pt-3 border-t border-red-200/50 dark:border-red-800/50 text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold block mb-1">Giải thích chi tiết:</span>
                  {message.feedback.explanationVi}
                </div>
              )}
            </div>
          ) : (
            message.feedback.explanationVi && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {message.feedback.explanationVi}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </motion.div>
  );
}
