"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, TrendingUp, Check, AlertTriangle, RotateCcw, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { AiMessageBubble, Exchange, CYAN, PURPLE, MINT, glass } from "./types";


interface SessionSummaryProps {
  realMessages: AiMessageBubble[];
  mockExchanges: Exchange[];
  duration: string;
  onRestart: () => void;
  onExit: () => void;
}

export function SessionSummary({
  realMessages, mockExchanges, duration, onRestart, onExit,
}: SessionSummaryProps) {
  const t = useTranslations("speaking");

  // Derive vocabulary from actual messages (newWord fields)
  const learnedVocab = realMessages
    .filter((m) => m.role === "ASSISTANT" && m.newWord)
    .map((m) => m.newWord as string);

  // Derive common mistakes from actual messages (grammarPoint + correction)
  const mistakeMap = new Map<string, { label: string; detail: string; count: number; severity: string }>();
  realMessages
    .filter((m) => m.role === "ASSISTANT" && m.correction && m.grammarPoint)
    .forEach((m) => {
      const key = m.grammarPoint!;
      const existing = mistakeMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        mistakeMap.set(key, {
          label: key,
          detail: m.correction ?? "",
          count: 1,
          severity: "medium",
        });
      }
    });
  const commonMistakes = Array.from(mistakeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalExchanges = realMessages.filter((m) => m.role === "ASSISTANT").length || mockExchanges.length;
  const errorCount     = realMessages.filter((m) => m.role === "ASSISTANT" && m.correction).length
                         || mockExchanges.filter((e) => e.hasError).length;
  const perfectCount   = totalExchanges - errorCount;
  const fluencyScore   = totalExchanges > 0
    ? Math.round((perfectCount / totalExchanges) * 100)
    : Math.round(mockExchanges.reduce((s, e) => s + e.score, 0) / (mockExchanges.length || 1));

  const size   = 148;
  const radius = 56;
  const circ   = 2 * Math.PI * radius;
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = fluencyScore / 60;
      let current = 0;
      const interval = setInterval(() => {
        current = Math.min(current + step, fluencyScore);
        setAnimScore(Math.round(current));
        if (current >= fluencyScore) clearInterval(interval);
      }, 16);
      return () => clearInterval(interval);
    }, 400);
    return () => clearTimeout(timer);
  }, [fluencyScore]);

  const animOffset = circ - (animScore / 100) * circ;

  return (
    <motion.div className="flex flex-col gap-5 pb-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <div className="text-center pt-2">
        <motion.div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 6px 0 0 rgba(0,0,0,0.3), 0 10px 28px rgba(34,211,238,0.3)` }}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}>
          🎯
        </motion.div>
        <h2 className="text-white font-extrabold text-xl">{t("summaryTitle")}</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{t("summarySubtitle")}</p>
      </div>

      {/* Score card */}
      <div className="rounded-[20px] p-5" style={glass}>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor={CYAN}   />
                  <stop offset="100%" stopColor={PURPLE} />
                </linearGradient>
              </defs>
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
              <motion.circle cx={size/2} cy={size/2} r={radius} fill="none"
                stroke="url(#scoreGradient)" strokeWidth={10} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={animOffset}
                style={{ filter: `drop-shadow(0 0 8px ${CYAN}80)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-extrabold text-3xl leading-none">{animScore}</span>
              <span className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>/ 100</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2.5">
            {[
              { icon: Clock,         label: t("summaryDuration"),  value: duration,            color: CYAN      },
              { icon: TrendingUp,    label: t("summaryExchanges"), value: `${totalExchanges}`, color: PURPLE    },
              { icon: Check,         label: t("summaryPerfect"),   value: `${perfectCount}`,   color: MINT      },
              { icon: AlertTriangle, label: t("summaryErrors"),    value: `${errorCount}`,     color: "#F87171" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-[12px] p-2.5 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <Icon size={13} style={{ color }} />
                <span className="text-white font-bold text-base leading-none">{value}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{t("summaryFluency")}</span>
            <span className="text-xs font-bold" style={{ color: fluencyScore >= 85 ? MINT : fluencyScore >= 65 ? "#FBBF24" : "#F87171" }}>
              {fluencyScore >= 85 ? t("fluencyExcellent") : fluencyScore >= 65 ? t("fluencyGood") : t("fluencyPractice")}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 0 8px ${CYAN}60` }}
              initial={{ width: 0 }} animate={{ width: `${fluencyScore}%` }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }} />
          </div>
        </div>
      </div>

      {/* Vocabulary (from real messages) */}
      {learnedVocab.length > 0 && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <BookOpen size={14} style={{ color: CYAN }} />
            <span className="text-white font-semibold text-sm">{t("summaryNewVocab")}</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${CYAN}20`, color: CYAN }}>
              {t("summaryWordsCount", { n: learnedVocab.length })}
            </span>
          </div>
          {learnedVocab.map((word, i) => (
            <motion.div key={i} className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CYAN }} />
              <span className="font-bold text-sm text-white">{word}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Common mistakes (from real messages) */}
      {commonMistakes.length > 0 && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <AlertTriangle size={14} className="text-[#FBBF24]" />
            <span className="text-white font-semibold text-sm">{t("summaryCommonMistakes")}</span>
          </div>
          {commonMistakes.map((m, i) => {
            const sev = ({ high: "#F87171", medium: "#FB923C", low: "#FBBF24" } as Record<string, string>)[m.severity] ?? "#FB923C";
            return (
              <motion.div key={m.label} className="flex items-start gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.08 }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold mt-0.5"
                  style={{ background: `${sev}20`, color: sev, border: `1px solid ${sev}40` }}>
                  {m.count}×
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{m.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{m.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 px-1 pb-2">
        <button onClick={onRestart}
          className="flex items-center justify-center gap-2 flex-1 py-3 rounded-[14px] font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <RotateCcw size={14} /> {t("summaryRestart")}
        </button>
        <button onClick={onExit}
          className="flex items-center justify-center gap-2 flex-[2] py-3 rounded-[14px] font-bold text-sm transition-all"
          style={{ background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`, color: "white", boxShadow: `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 20px rgba(34,211,238,0.25)` }}>
          <Download size={14} /> {t("summarySave")}
        </button>
      </div>
    </motion.div>
  );
}
