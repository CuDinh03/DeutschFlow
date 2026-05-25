"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Headphones,
  Mic,
  BookOpen,
  PenTool,
  ArrowLeft,
  RefreshCw,
  Trophy,
  Sparkles,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import api from "@/lib/api";
import { logout } from "@/lib/authSession";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PracticeSession {
  id: number;
  skill_type: string;
  generation: number;
  status: string;
  score_percent: number | null;
  xp_earned: number;
  exercise_count: number;
  totalSeenCount: number;
  created_at: string;
}

interface PracticeOverview {
  nodeTitle: string;
  nodeTitleVi: string;
  emoji: string;
  cefrLevel: string;
  sessions: PracticeSession[];
}

// ─── Skill Config ─────────────────────────────────────────────────────────────

const SKILL_CONFIG = {
  HOEREN: {
    icon: Headphones,
    label: "Nghe",
    labelDe: "Hören",
    gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)",
    shadow: "0 4px 0 #5B21B6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    text: "#7C3AED",
  },
  SPRECHEN: {
    icon: Mic,
    label: "Nói",
    labelDe: "Sprechen",
    gradient: "linear-gradient(135deg, #EC4899, #F472B6)",
    shadow: "0 4px 0 #BE185D",
    bg: "#FDF2F8",
    border: "#FBCFE8",
    text: "#EC4899",
  },
  LESEN: {
    icon: BookOpen,
    label: "Đọc",
    labelDe: "Lesen",
    gradient: "linear-gradient(135deg, #0EA5E9, #38BDF8)",
    shadow: "0 4px 0 #0369A1",
    bg: "#F0F9FF",
    border: "#BAE6FD",
    text: "#0EA5E9",
  },
  SCHREIBEN: {
    icon: PenTool,
    label: "Viết",
    labelDe: "Schreiben",
    gradient: "linear-gradient(135deg, #F59E0B, #FBBF24)",
    shadow: "0 4px 0 #B45309",
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#F59E0B",
  },
} as const;

type SkillType = keyof typeof SKILL_CONFIG;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PracticeNodePage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = Number(params?.nodeId);
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();

  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PracticeOverview>(`/skill-tree/${nodeId}/practice`);
      setOverview(data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // No practice sessions yet — trigger generation
        setError(null);
        setOverview(null);
      } else {
        setError("Không thể tải bài tập. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    if (me && nodeId) void fetchOverview();
  }, [me, nodeId, fetchOverview]);

  const handleStartSkill = async (skillType: SkillType) => {
    // Check if session already exists for this skill
    const existing = overview?.sessions.find((s) => s.skill_type === skillType);
    if (existing && existing.status === "ACTIVE") {
      router.push(`/student/practice-session/${nodeId}/${skillType.toLowerCase()}`);
      return;
    }

    // Generate new session
    setGenerating(skillType);
    try {
      await api.post(`/skill-tree/${nodeId}/practice/${skillType}/start`);
      await fetchOverview();
      router.push(`/student/practice-session/${nodeId}/${skillType.toLowerCase()}`);
    } catch {
      setError("Không thể tạo bài tập.");
    } finally {
      setGenerating(null);
    }
  };

  const handleTriggerAll = async () => {
    setGenerating("ALL");
    try {
      await api.post(`/skill-tree/${nodeId}/practice/trigger-all`);
      // Wait a bit for async generation
      setTimeout(() => void fetchOverview(), 3000);
    } catch {
      setError("Không thể sinh bài tập.");
    } finally {
      setTimeout(() => setGenerating(null), 3000);
    }
  };

  const getSessionForSkill = (skillType: string): PracticeSession | undefined => {
    return overview?.sessions.find((s) => s.skill_type === skillType);
  };

  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="roadmap"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout(); }}
      headerTitle="Luyện tập kỹ năng"
      headerSubtitle={overview ? `${overview.emoji} ${overview.nodeTitleVi}` : "Đang tải..."}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.push("/student/roadmap")}
          className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft size={16} />
          Quay lại lộ trình
        </button>

        {/* Header card */}
        {overview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 border-2 border-[#E2E8F0] bg-white"
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{overview.emoji}</span>
              <div>
                <h1 className="text-xl font-bold text-[#0F172A]">{overview.nodeTitleVi}</h1>
                <p className="text-sm text-[#64748B] italic">{overview.nodeTitle}</p>
                <span
                  className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#EEF2FF", color: "#4338CA" }}
                >
                  {overview.cefrLevel}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#475569] leading-relaxed">
              Chọn kỹ năng bạn muốn luyện tập. Mỗi bài gồm <strong>6 câu hỏi</strong> được AI sinh riêng,
              không trùng lặp với phần lý thuyết. Hoàn thành để nhận <strong>30 XP</strong>.
            </p>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#64748B]" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={() => void fetchOverview()}
              className="ml-2 underline font-semibold"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* No sessions yet — trigger */}
        {!loading && !overview?.sessions?.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-8 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center"
          >
            <Sparkles size={40} className="mx-auto mb-4 text-[#F59E0B]" />
            <h2 className="text-lg font-bold text-[#0F172A] mb-2">
              Sinh bài tập luyện kỹ năng
            </h2>
            <p className="text-sm text-[#64748B] mb-6 max-w-sm mx-auto">
              AI sẽ tạo 4 bộ bài tập riêng biệt cho Nghe, Nói, Đọc, Viết —
              tất cả dựa trên nội dung bài học bạn vừa hoàn thành.
            </p>
            <button
              type="button"
              onClick={() => void handleTriggerAll()}
              disabled={generating === "ALL"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ background: "#121212", boxShadow: "0 4px 0 #000" }}
            >
              {generating === "ALL" ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generating === "ALL" ? "Đang sinh bài tập..." : "Bắt đầu sinh bài"}
            </button>
          </motion.div>
        )}

        {/* 4 Skill Cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {(Object.keys(SKILL_CONFIG) as SkillType[]).map((skillType, idx) => {
                const config = SKILL_CONFIG[skillType];
                const session = getSessionForSkill(skillType);
                const Icon = config.icon;
                const isCompleted = session?.status === "COMPLETED";
                const isActive = session?.status === "ACTIVE";
                const isGenerating = generating === skillType;
                const totalSeen = session?.totalSeenCount ?? 0;

                return (
                  <motion.div
                    key={skillType}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="rounded-2xl border-2 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                    style={{
                      borderColor: isCompleted ? "#BBF7D0" : config.border,
                      background: isCompleted ? "#F0FDF4" : config.bg,
                    }}
                    onClick={() => !isGenerating && void handleStartSkill(skillType)}
                  >
                    {/* Skill header */}
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                          style={{ background: config.gradient, boxShadow: config.shadow }}
                        >
                          {isCompleted ? (
                            <Check size={22} strokeWidth={3} />
                          ) : isGenerating ? (
                            <RefreshCw size={20} className="animate-spin" />
                          ) : (
                            <Icon size={22} />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-base text-[#0F172A]">
                            {config.label}
                          </h3>
                          <p className="text-xs text-[#64748B] italic">{config.labelDe}</p>
                        </div>
                        <ChevronRight size={16} className="text-[#CBD5E1]" />
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {session && (
                          <>
                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: config.text }}>
                              <Trophy size={12} />
                              {session.score_percent ?? "—"}%
                            </span>
                            <span className="text-xs text-[#94A3B8]">
                              Gen {session.generation}
                            </span>
                            <span className="text-xs text-[#94A3B8]">
                              {totalSeen} câu đã luyện
                            </span>
                          </>
                        )}
                        {!session && !isGenerating && (
                          <span className="text-xs text-[#94A3B8]">Chưa bắt đầu</span>
                        )}
                        {isGenerating && (
                          <span className="text-xs text-[#94A3B8] animate-pulse">
                            AI đang sinh bài tập...
                          </span>
                        )}
                      </div>

                      {/* XP badge */}
                      {isCompleted && session && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          <Check size={10} /> +{session.xp_earned} XP
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {session && (
                      <div className="h-1.5" style={{ background: config.border }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${session.score_percent ?? 0}%`,
                            background: isCompleted ? "#10B981" : config.text,
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Summary */}
        {overview && overview.sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-4 bg-white border border-[#E2E8F0] text-center"
          >
            <p className="text-sm text-[#64748B]">
              Tổng điểm:{" "}
              <span className="font-bold text-[#0F172A]">
                {overview.sessions.reduce((sum, s) => sum + (s.xp_earned ?? 0), 0)} XP
              </span>
              {" · "}
              Đã luyện:{" "}
              <span className="font-bold text-[#0F172A]">
                {overview.sessions.reduce((sum, s) => sum + (s.totalSeenCount ?? 0), 0)} câu
              </span>
            </p>
          </motion.div>
        )}
      </div>
    </StudentShell>
  );
}
