"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
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

const CYAN = "#22D3EE";
const PURPLE = "#A78BFA";
const MINT = "#2DD4BF";
const glass = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.11)",
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
    { label: "Fluency", labelVi: "Độ trôi chảy", score: fluencyScore, icon: MessageSquare, color: "#F59E0B" },
  ];
  const overallScore = Math.round(rubric.reduce((s, r) => s + r.score, 0) / rubric.length * 10);
  return { rubric, overallScore, totalErrors, totalPerfect, totalExchanges };
}

function verdictColor(v?: string) {
  if (v === "PASS") return MINT;
  if (v === "CONDITIONAL_PASS") return "#FBBF24";
  return "#F87171";
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SessionSummaryProps {
  messages: ChatMessage[];
  duration: string;
  isInterviewMode: boolean;
  interviewReportJson?: string | null;
  onRestart: () => void;
  onExit: () => void;
}

export function SessionSummary({ messages, duration, isInterviewMode, interviewReportJson, onRestart, onExit }: SessionSummaryProps) {
  const { rubric, overallScore, totalErrors, totalPerfect, totalExchanges } = useMemo(
    () => computeScoresFromMessages(messages), [messages]
  );

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
          style={{ background: `linear-gradient(145deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 6px 0 0 rgba(0,0,0,0.3), 0 10px 28px rgba(34,211,238,0.3)` }}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        >
          {hasAiReport ? "📋" : "🎯"}
        </motion.div>
        <h2 className="text-white font-extrabold text-xl">
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
      <div className="rounded-[20px] p-5" style={glass}>
        <div className="flex items-center gap-5">
          {/* Circular */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={CYAN} /><stop offset="100%" stopColor={PURPLE} />
                </linearGradient>
              </defs>
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} />
              <motion.circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="url(#scoreGrad)" strokeWidth={10}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={animOffset}
                style={{ filter: `drop-shadow(0 0 8px ${CYAN}80)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-extrabold text-3xl leading-none">{animScore}</span>
              <span className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>/ 100</span>
            </div>
          </div>
          {/* Stats grid */}
          <div className="flex-1 grid grid-cols-2 gap-2.5">
            {[
              { icon: Clock, label: "Thời gian", value: duration, color: CYAN },
              { icon: TrendingUp, label: "Lượt nói", value: `${totalExchanges}`, color: PURPLE },
              { icon: Check, label: "Hoàn hảo", value: `${totalPerfect}`, color: MINT },
              { icon: AlertTriangle, label: "Lỗi", value: `${totalErrors}`, color: "#F87171" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-[12px] p-2.5 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <Icon size={13} style={{ color }} />
                <span className="text-white font-bold text-base leading-none">{value}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        {hasAiReport && aiReport?.overall_score && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Đánh giá AI: </span>
            <span className="text-sm font-bold" style={{ color: CYAN }}>{aiReport.overall_score}</span>
          </div>
        )}
      </div>

      {/* AI Interview Report — 4 categories */}
      {hasAiReport && aiReport?.categories && aiReport.categories.length > 0 && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Target size={14} style={{ color: "#FBBF24" }} />
            <span className="text-white font-semibold text-sm">Đánh giá chi tiết (AI)</span>
          </div>
          {aiReport.categories.map((cat, i) => (
            <motion.div key={i} className="px-4 py-4" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{cat.name_vi}</span>
                <span className="text-sm font-bold" style={{ color: cat.score >= 7 ? MINT : cat.score >= 5 ? "#FBBF24" : "#F87171" }}>
                  {cat.score}/10
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.1)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: cat.score >= 7 ? MINT : cat.score >= 5 ? "#FBBF24" : "#F87171" }}
                  initial={{ width: 0 }} animate={{ width: `${cat.score * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.6 + i * 0.1, ease: "easeOut" }} />
              </div>
              {cat.green_flags_vi && cat.green_flags_vi.length > 0 && cat.green_flags_vi.map((f, j) => (
                <div key={j} className="flex items-start gap-1.5 mb-1">
                  <ThumbsUp size={11} style={{ color: MINT, flexShrink: 0, marginTop: 2 }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{f}</span>
                </div>
              ))}
              {cat.red_flags_vi && cat.red_flags_vi.length > 0 && cat.red_flags_vi.map((f, j) => (
                <div key={j} className="flex items-start gap-1.5 mb-1">
                  <ThumbsDown size={11} style={{ color: "#F87171", flexShrink: 0, marginTop: 2 }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{f}</span>
                </div>
              ))}
              {cat.comment_vi && (
                <p className="text-xs mt-1 italic" style={{ color: "rgba(255,255,255,0.4)" }}>{cat.comment_vi}</p>
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
            <span className="text-white font-semibold text-sm">Tiếng Đức trong phỏng vấn</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {aiReport.german_language.grammar_accuracy_pct && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Độ chính xác ngữ pháp</span>
                <p className="text-white font-bold text-sm mt-0.5">{aiReport.german_language.grammar_accuracy_pct}</p>
              </div>
            )}
            {aiReport.german_language.vocabulary_level && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Mức từ vựng</span>
                <p className="text-white font-bold text-sm mt-0.5">{aiReport.german_language.vocabulary_level}</p>
              </div>
            )}
          </div>
          {aiReport.german_language.fluency_vi && (
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>{aiReport.german_language.fluency_vi}</p>
          )}
          {aiReport.german_language.common_errors_vi && aiReport.german_language.common_errors_vi.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Lỗi thường gặp</span>
              {aiReport.german_language.common_errors_vi.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 mt-1">
                  <AlertTriangle size={10} style={{ color: "#FBBF24", flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{e}</span>
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
            <Lightbulb size={14} style={{ color: "#FBBF24" }} />
            <span className="text-white font-semibold text-sm">Giải pháp khắc phục</span>
          </div>
          {aiReport.remediation_vi.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5"
                style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
                {i + 1}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Encouragement */}
      {hasAiReport && aiReport?.encouragement_vi && (
        <div className="rounded-[20px] p-4" style={{ ...glass, background: "rgba(34,211,238,0.06)", border: `1px solid ${CYAN}22` }}>
          <div className="flex items-start gap-2">
            <Star size={14} style={{ color: "#FBBF24", flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{aiReport.encouragement_vi}</p>
          </div>
        </div>
      )}

      {/* Fallback rubric (non-interview or no AI report) */}
      {!hasAiReport && (
        <div className="rounded-[20px] overflow-hidden" style={glass}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Star size={14} style={{ color: "#FBBF24" }} />
            <span className="text-white font-semibold text-sm">Rubric chấm điểm</span>
          </div>
          <div className="p-4 space-y-4">
            {rubric.map((r, i) => (
              <motion.div key={r.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <r.icon size={13} style={{ color: r.color }} />
                    <span className="text-sm font-semibold text-white">{r.label}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>({r.labelVi})</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: r.color }}>{r.score}/10</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
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

      {/* Action Buttons */}
      <div className="flex gap-3 px-1 pb-2">
        <button onClick={onRestart} className="flex items-center justify-center gap-2 flex-1 py-3 rounded-[14px] font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <RotateCcw size={14} /> Luyện lại
        </button>
        <button onClick={onExit} className="flex items-center justify-center gap-2 flex-[2] py-3 rounded-[14px] font-bold text-sm transition-all"
          style={{ background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`, color: "white", boxShadow: `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 20px rgba(34,211,238,0.25)` }}>
          <ArrowLeft size={14} /> Về trang chủ
        </button>
      </div>
    </motion.div>
  );
}
