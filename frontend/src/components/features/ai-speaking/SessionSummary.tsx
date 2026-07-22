"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
import {
  Clock, TrendingUp, Check, AlertTriangle,
  BookOpen, RotateCcw, ArrowLeft, Star,
  Briefcase, Users, Heart, Zap, MessageSquare,
  ThumbsUp, ThumbsDown, Target, Lightbulb,
} from "lucide-react";
import type { ChatMessage } from "@/stores/useChatStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RubricScore {
  label: string; labelVi: string; score: number; icon: React.ElementType; color: string;
}

// AI-generated interview report shape
interface InterviewCategory {
  name_vi: string; score: number;
  green_flags_vi?: string[]; red_flags_vi?: string[]; comment_vi?: string;
}
interface GermanLanguage {
  grammar_accuracy_pct?: string; vocabulary_level?: string;
  fluency_vi?: string; common_errors_vi?: string[];
}
interface InterviewReport {
  overall_score?: string;
  verdict?: "PASS" | "CONDITIONAL_PASS" | "NOT_PASS";
  verdict_label_vi?: string;
  categories?: InterviewCategory[];
  german_language?: GermanLanguage;
  remediation_vi?: string[];
  encouragement_vi?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Galerie accents — the summary now renders on warm paper, so the neon trio is gone.
const CYAN = "#2F6FC9";   // --ga-blue
const PURPLE = "#7C56C8"; // --ga-violet
const MINT = "#11888A";   // --ga-teal
const AMBER = "#C79A00";  // --ga-gold
const CORAL = "#DA291C";  // --ga-red
const glass = {
  background: "var(--ga-card)",
  border: "1px solid var(--ga-line)",
  boxShadow: "var(--ga-shadow-card-hover)",
};

function computeScoresFromMessages(messages: ChatMessage[]) {
  const aiMessages = messages.filter((m) => m.role === "ai" && !m.isStreaming);
  const userMessages = messages.filter((m) => m.role === "user");
  const totalExchanges = userMessages.length;
  let totalErrors = 0, totalCorrections = 0;
  aiMessages.forEach((m) => {
    if (m.feedback?.errors && m.feedback.errors.length > 0) {
      totalErrors += m.feedback.errors.length; totalCorrections++;
    }
  });
  const totalPerfect = totalExchanges - totalCorrections;
  const errorRate = totalExchanges > 0 ? totalCorrections / totalExchanges : 0;
  const vocabScore = Math.min(10, Math.round((1 - errorRate * 0.4) * 10 * (totalExchanges > 0 ? 1 : 0)));
  const grammarScore = Math.min(10, Math.round((1 - errorRate * 0.8) * 10 * (totalExchanges > 0 ? 1 : 0)));
  const taskScore = Math.min(10, Math.round(Math.min(totalExchanges / 5, 1) * 8 + (totalPerfect > 0 ? 2 : 0)));
  const fluencyScore = Math.min(10, Math.round(totalExchanges >= 3 ? 7 + Math.min(totalPerfect, 3) : totalExchanges * 2.5));
  const rubric: RubricScore[] = [
    { label: "Vocabulary", labelVi: "Từ vựng", score: vocabScore, icon: BookOpen, color: CYAN },
    { label: "Grammar & Syntax", labelVi: "Ngữ pháp & Cú pháp", score: grammarScore, icon: Zap, color: PURPLE },
    { label: "Task Fulfillment", labelVi: "Hoàn thành nhiệm vụ", score: taskScore, icon: Check, color: MINT },
    { label: "Fluency", labelVi: "Độ trôi chảy", score: fluencyScore, icon: MessageSquare, color: AMBER },
  ];
  const overallScore = Math.round(rubric.reduce((s, r) => s + r.score, 0) / rubric.length * 10);
  return { rubric, overallScore, totalErrors, totalPerfect, totalExchanges };
}

function verdictColor(v?: string) {
  if (v === "PASS") return MINT;
  if (v === "CONDITIONAL_PASS") return "#C79A00";
  return "#DA291C";
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SessionSummaryProps {
  messages: ChatMessage[];
  duration: string;
  isInterviewMode: boolean;
  interviewReportJson?: string | null;
  onRestart: () => void;
  onExit: () => void;
  onReviewErrors?: (errors: string[]) => void;
  onViewHistory?: () => void;
}

export function SessionSummary({
  messages,
  duration,
  isInterviewMode,
  interviewReportJson,
  onRestart,
  onExit,
  onReviewErrors,
  onViewHistory,
}: SessionSummaryProps) {
  const tChat = useTranslations("speaking.chat");
  const { rubric, overallScore, totalErrors, totalPerfect, totalExchanges } = useMemo(
    () => computeScoresFromMessages(messages), [messages]
  );

  const speakingErrors = useMemo(() => {
    const seen = new Set<string>();
    const items: string[] = [];
    for (const msg of messages) {
      if (msg.role !== 'ai' || msg.isStreaming || !msg.feedback?.errors) continue;
      for (const err of msg.feedback.errors) {
        const label = err.ruleViShort || err.errorCode || err.wrongSpan || 'Lỗi ngữ pháp';
        if (!seen.has(label)) {
          seen.add(label);
          items.push(label);
        }
      }
    }
    return items.slice(0, 5);
  }, [messages]);

  // Parse AI report if available
  const aiReport = useMemo<InterviewReport | null>(() => {
    if (!interviewReportJson) return null;
    try { return JSON.parse(interviewReportJson) as InterviewReport; } catch { return null; }
  }, [interviewReportJson]);

  const hasAiReport = isInterviewMode && aiReport !== null;

  // Animated score counter
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const step = overallScore / 60; let current = 0;
      const interval = setInterval(() => {
        current = Math.min(current + step, overallScore);
        setAnimScore(Math.round(current));
        if (current >= overallScore) clearInterval(interval);
      }, 16);
      return () => clearInterval(interval);
    }, 400);
    return () => clearTimeout(timer);
  }, [overallScore]);

  const size = 148, radius = 56, circ = 2 * Math.PI * radius;
  const animOffset = circ - (animScore / 100) * circ;

  return (
    <motion.div className="flex flex-col gap-5 pb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <div className="text-center pt-2">
        <motion.div
          className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
          style={{ background: "var(--ga-yellow-soft)", border: "1px solid var(--ga-yellow)" }}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ ...spring.gentle, delay: 0.1 }}
        >
          {hasAiReport ? "📋" : "🎯"}
        </motion.div>
        <h2 className="font-ga-display text-ga-ink font-medium text-2xl">
          {isInterviewMode ? "Phỏng vấn kết thúc!" : "Buổi luyện nói kết thúc!"}
        </h2>
        {hasAiReport && aiReport?.verdict_label_vi && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold"
            style={{ background: `${verdictColor(aiReport.verdict)}22`, color: verdictColor(aiReport.verdict), border: `1px solid ${verdictColor(aiReport.verdict)}44` }}>
            {aiReport.verdict === "PASS" ? "✅" : aiReport.verdict === "CONDITIONAL_PASS" ? "⚠️" : "❌"} {aiReport.verdict_label_vi}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="rounded-[20px] p-4 sm:p-5" style={glass}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          {/* Circular */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={CYAN} /><stop offset="100%" stopColor={PURPLE} />
                </linearGradient>
              </defs>
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--ga-line)" strokeWidth={10} />
              <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="url(#scoreGrad)" strokeWidth={10}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={animOffset}
                 />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-ga-ink font-bold text-3xl leading-none">{animScore}</span>
              <span className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--ga-subtle)" }}>/ 100</span>
            </div>
          </div>
          {/* Stats grid */}
          <div className="w-full grid grid-cols-2 gap-2.5 sm:w-auto sm:flex-1">
            {[
              { icon: Clock, label: "Thời gian", value: duration, color: CYAN },
              { icon: TrendingUp, label: "Lượt nói", value: `${totalExchanges}`, color: PURPLE },
              { icon: Check, label: "Hoàn hảo", value: `${totalPerfect}`, color: MINT },
              { icon: AlertTriangle, label: "Lỗi", value: `${totalErrors}`, color: CORAL },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="min-w-0 rounded-[12px] p-2.5 flex flex-col gap-1" style={{ background: "var(--ga-surface)" }}>
                <Icon size={13} style={{ color }} />
                <span className="text-ga-ink font-bold text-base leading-none break-words">{value}</span>
                <span className="text-[10px]" style={{ color: "var(--ga-subtle)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        {hasAiReport && aiReport?.overall_score && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--ga-line)" }}>
            <span className="text-xs" style={{ color: "var(--ga-muted)" }}>Đánh giá AI: </span>
            <span className="text-sm font-bold" style={{ color: CYAN }}>{aiReport.overall_score}</span>
          </div>
        )}
      </div>

      {/* AI Interview Report — 4 categories */}
      {hasAiReport && aiReport?.categories && aiReport.categories.length > 0 && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--ga-line)" }}>
            <Target size={14} style={{ color: AMBER }} />
            <span className="text-ga-ink font-semibold text-sm">Đánh giá chi tiết (AI)</span>
          </div>
          {aiReport.categories.map((cat, i) => (
            <motion.div key={i} className="px-4 py-4" style={{ borderTop: i > 0 ? "1px solid var(--ga-line)" : "none" }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="min-w-0 break-words text-sm font-semibold text-ga-ink">{cat.name_vi}</span>
                <span className="text-sm font-bold" style={{ color: cat.score >= 7 ? MINT : cat.score >= 5 ? "#FBBF24" : "#F87171" }}>
                  {cat.score}/10
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--ga-surface)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: cat.score >= 7 ? MINT : cat.score >= 5 ? "#FBBF24" : "#F87171" }}
                  initial={{ width: 0 }} animate={{ width: `${cat.score * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.6 + i * 0.1, ease: "easeOut" }} />
              </div>
              {cat.green_flags_vi && cat.green_flags_vi.length > 0 && cat.green_flags_vi.map((f, j) => (
                <div key={j} className="flex items-start gap-1.5 mb-1">
                  <ThumbsUp size={11} style={{ color: MINT, flexShrink: 0, marginTop: 2 }} />
                  <span className="text-xs" style={{ color: "var(--ga-muted)" }}>{f}</span>
                </div>
              ))}
              {cat.red_flags_vi && cat.red_flags_vi.length > 0 && cat.red_flags_vi.map((f, j) => (
                <div key={j} className="flex items-start gap-1.5 mb-1">
                  <ThumbsDown size={11} style={{ color: "#F87171", flexShrink: 0, marginTop: 2 }} />
                  <span className="text-xs" style={{ color: "var(--ga-muted)" }}>{f}</span>
                </div>
              ))}
              {cat.comment_vi && (
                <p className="text-xs mt-1 italic" style={{ color: "var(--ga-subtle)" }}>{cat.comment_vi}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* German Language Assessment */}
      {hasAiReport && aiReport?.german_language && (
        <div className="rounded-[20px] p-4" style={glass}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} style={{ color: PURPLE }} />
            <span className="text-ga-ink font-semibold text-sm">Tiếng Đức trong phỏng vấn</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {aiReport.german_language.grammar_accuracy_pct && (
              <div className="rounded-xl p-3" style={{ background: "var(--ga-surface)" }}>
                <span className="text-[10px]" style={{ color: "var(--ga-subtle)" }}>Độ chính xác ngữ pháp</span>
                <p className="text-ga-ink font-bold text-sm mt-0.5">{aiReport.german_language.grammar_accuracy_pct}</p>
              </div>
            )}
            {aiReport.german_language.vocabulary_level && (
              <div className="rounded-xl p-3" style={{ background: "var(--ga-surface)" }}>
                <span className="text-[10px]" style={{ color: "var(--ga-subtle)" }}>Mức từ vựng</span>
                <p className="text-ga-ink font-bold text-sm mt-0.5">{aiReport.german_language.vocabulary_level}</p>
              </div>
            )}
          </div>
          {aiReport.german_language.fluency_vi && (
            <p className="text-xs mb-2" style={{ color: "var(--ga-muted)" }}>{aiReport.german_language.fluency_vi}</p>
          )}
          {aiReport.german_language.common_errors_vi && aiReport.german_language.common_errors_vi.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ga-subtle)" }}>Lỗi thường gặp</span>
              {aiReport.german_language.common_errors_vi.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 mt-1">
                  <AlertTriangle size={10} style={{ color: "#FBBF24", flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: "var(--ga-muted)" }}>{e}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remediation */}
      {hasAiReport && aiReport?.remediation_vi && aiReport.remediation_vi.length > 0 && (
        <div className="rounded-[20px] p-4" style={glass}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} style={{ color: AMBER }} />
            <span className="text-ga-ink font-semibold text-sm">Giải pháp khắc phục</span>
          </div>
          {aiReport.remediation_vi.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5"
                style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
                {i + 1}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: "var(--ga-muted)" }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Encouragement */}
      {hasAiReport && aiReport?.encouragement_vi && (
        <div className="rounded-[20px] p-4" style={{ ...glass, background: "rgba(34,211,238,0.06)", border: `1px solid ${CYAN}22` }}>
          <div className="flex items-start gap-2">
            <Star size={14} style={{ color: "#FBBF24", flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm leading-relaxed" style={{ color: "var(--ga-ink)" }}>{aiReport.encouragement_vi}</p>
          </div>
        </div>
      )}

      {/* Fallback rubric (non-interview or no AI report) */}
      {!hasAiReport && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--ga-line)" }}>
            <Star size={14} style={{ color: AMBER }} />
            <span className="text-ga-ink font-semibold text-sm">Rubric chấm điểm</span>
          </div>
          <div className="p-4 space-y-4">
            {rubric.map((r, i) => (
              <motion.div key={r.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <r.icon size={13} style={{ color: r.color }} />
                    <span className="text-sm font-semibold text-ga-ink">{r.label}</span>
                    <span className="text-[10px]" style={{ color: "var(--ga-subtle)" }}>({r.labelVi})</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: r.color }}>{r.score}/10</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ga-surface)" }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: r.color, boxShadow: `0 0 6px ${r.color}60` }}
                    initial={{ width: 0 }} animate={{ width: `${r.score * 10}%` }}
                    transition={{ duration: 0.8, delay: 0.8 + i * 0.1, ease: "easeOut" }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {speakingErrors.length > 0 && (
        <div className="rounded-[20px] p-4" style={glass}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: AMBER }} />
            <span className="text-ga-ink font-semibold text-sm">Lỗi cần ôn lại sau buổi nói</span>
          </div>
          <div className="space-y-2 mb-3">
            {speakingErrors.map((error) => (
              <div key={error} className="rounded-ga px-3 py-2 bg-ga-surface border border-ga-line text-sm text-ga-ink">
                {error}
              </div>
            ))}
          </div>
          <button
            onClick={() => onReviewErrors?.(speakingErrors)}
            className="w-full py-3 rounded-ga font-semibold text-sm transition-colors hover:bg-ga-side-active"
            style={{ background: "var(--ga-card)", color: "var(--ga-ink)", border: "1px solid var(--ga-line)" }}
          >
            Ôn lại các lỗi này
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 px-1 pb-2">
        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="w-full py-2.5 rounded-ga font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: "var(--ga-blue-soft)",
              color: CYAN,
              border: `1px solid ${CYAN}`,
            }}
          >
            {tChat("summaryViewHistory")}
          </button>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 flex-1 py-3 rounded-ga font-semibold text-sm transition-colors hover:bg-ga-side-active"
            style={{
              background: "var(--ga-card)",
              color: "var(--ga-ink)",
              border: "1px solid var(--ga-line)",
            }}
          >
            <RotateCcw size={14} /> Luyện lại
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center justify-center gap-2 flex-[2] py-3 rounded-ga font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--ga-ink)", color: "var(--ga-bg)" }}
          >
            <ArrowLeft size={14} /> Về trang chủ
          </button>
        </div>
      </div>
    </motion.div>
  );
}
