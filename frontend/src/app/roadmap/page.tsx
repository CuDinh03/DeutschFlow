"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api, { httpStatus } from "@/lib/api";
import { getAccessToken, clearTokens, logout } from "@/lib/authSession";
import { StudentShell } from "@/components/layouts/StudentShell";
import {
  Lock,
  Check,
  Star,
  Flame,
  Trophy,
  ChevronLeft,
  Play,
  Zap,
  Map,
  Target,
  BarChart3,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type LevelState = "completed" | "current" | "locked";

interface Level {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  state: LevelState;
  xpReward: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  category: string;
  color: string;
  shadowColor: string;
  description: string;
}

type PlanSession = {
  index: number;
  type: string;
  minutes?: number;
  difficulty?: number;
  skills?: string[];
};

type PlanWeek = {
  week: number;
  objectives?: string[];
  sessions?: PlanSession[];
};

type Plan = {
  weeks?: PlanWeek[];
  weeklyMinutes?: number;
  targetLevel?: string;
  progress?: {
    currentWeek?: number;
    currentSessionIndex?: number;
    completedSessions?: number;
  };
};

type AuthUser = {
  userId: number;
  email: string;
  displayName: string;
  role: string;
  locale: string;
};

type DashboardStats = {
  streakDays?: number;
  planProgressPercent?: number;
};

const EMOJIS = ["📖", "🗣️", "💻", "🏸", "💼", "💬", "🏛️", "🏆", "🎯", "📚", "✨", "🎓"];

function weekState(week: number, currentWeek: number): LevelState {
  if (week < currentWeek) return "completed";
  if (week === currentWeek) return "current";
  return "locked";
}

function buildLevelsFromPlan(
  plan: Plan | null,
  tr: (key: string, values?: Record<string, string | number>) => string,
): Level[] {
  if (!plan?.weeks?.length) return [];
  const weeks = [...plan.weeks].sort((a, b) => Number(a.week) - Number(b.week));
  const cw = Number(plan.progress?.currentWeek ?? 1);
  const csi = Number(plan.progress?.currentSessionIndex ?? 1);

  return weeks.map((w, idx) => {
    const weekNum = Number(w.week);
    const state = weekState(weekNum, cw);
    const sessions = w.sessions ?? [];
    const lessonsTotal = Math.max(1, sessions.length);
    let lessonsCompleted = 0;
    if (state === "completed") {
      lessonsCompleted = lessonsTotal;
    } else if (state === "current") {
      lessonsCompleted = sessions.filter((s) => Number(s.index) < csi).length;
    }
    const objectives = w.objectives ?? [];
    const title = tr("weekTitle", { week: weekNum });
    const subtitle = objectives[0] ? String(objectives[0]) : tr("weekDefaultSubtitle");
    const description =
      objectives.length > 1 ? objectives.slice(0, 3).join(" · ") : objectives[0] ? String(objectives[0]) : tr("weekNoObjectives");
    const xpReward = 250 + lessonsTotal * 45 + weekNum * 30;
    const emoji = EMOJIS[idx % EMOJIS.length];
    const color = state === "completed" ? "#10B981" : state === "current" ? "#FFCE00" : "#94A3B8";
    const shadowColor = state === "completed" ? "#059669" : state === "current" ? "#C9A200" : "#64748B";
    const category = sessions[0]?.type ?? "LESSON";
    return {
      id: weekNum,
      title,
      subtitle,
      emoji,
      state,
      xpReward,
      lessonsTotal,
      lessonsCompleted,
      category,
      color,
      shadowColor,
      description,
    };
  });
}

// ─── Node Component ───────────────────────────────────────────────────────────

function LevelNode({
  level,
  index,
  isLeft,
  onClick,
  selected,
}: {
  level: Level;
  index: number;
  isLeft: boolean;
  onClick: () => void;
  selected: boolean;
}) {
  const isCompleted = level.state === "completed";
  const isCurrent = level.state === "current";
  const isLocked = level.state === "locked";

  const nodeSize = isCurrent ? 76 : isCompleted ? 68 : 64;

  return (
    <motion.div
      className="flex items-center w-full"
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex-1 flex justify-end pr-5">
        {isLeft && <InfoCard level={level} onClick={onClick} selected={selected} />}
      </div>

      <div className="flex flex-col items-center relative z-10">
        <motion.button
          type="button"
          onClick={!isLocked ? onClick : undefined}
          className="relative flex items-center justify-center rounded-full transition-all"
          style={{
            width: nodeSize,
            height: nodeSize,
            background: isCompleted
              ? "linear-gradient(145deg, #34D399, #10B981)"
              : isCurrent
                ? "linear-gradient(145deg, #FFD940, #FFCE00)"
                : "linear-gradient(145deg, #E2E8F0, #CBD5E1)",
            boxShadow: isCompleted
              ? `0 6px 0 0 ${level.shadowColor}, 0 10px 28px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.4)`
              : isCurrent
                ? `0 6px 0 0 ${level.shadowColor}, 0 10px 28px rgba(255,206,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)`
                : `0 4px 0 0 #94A3B8, 0 6px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)`,
            border: selected ? "3px solid white" : isCurrent ? "3px solid rgba(255,255,255,0.6)" : "3px solid rgba(255,255,255,0.3)",
            cursor: isLocked ? "not-allowed" : "pointer",
            filter: selected ? "brightness(1.08)" : "none",
          }}
          whileHover={!isLocked ? { scale: 1.06, y: -2 } : {}}
          whileTap={!isLocked ? { scale: 0.96, y: 4 } : {}}
          animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
          transition={isCurrent ? { repeat: Infinity, duration: 2.5, ease: "easeInOut" } : {}}
        >
          <div
            className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: "55%",
              height: 4,
              background: "rgba(255,255,255,0.35)",
            }}
          />

          {isCompleted && <Check size={28} className="text-white" strokeWidth={3} />}
          {isCurrent && <span className="text-2xl">{level.emoji}</span>}
          {isLocked && <Lock size={20} className="text-[#94A3B8]" />}

          {isCurrent && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: "3px solid rgba(255,206,0,0.5)" }}
              animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
          )}
        </motion.button>

        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{
            background: isCompleted ? "#059669" : isCurrent ? "#C9A200" : "#94A3B8",
            color: "white",
            border: "2px solid white",
          }}
        >
          {level.id}
        </div>
      </div>

      <div className="flex-1 pl-5">
        {!isLeft && <InfoCard level={level} onClick={onClick} selected={selected} />}
      </div>
    </motion.div>
  );
}

function InfoCard({
  level,
  onClick,
  selected,
}: {
  level: Level;
  onClick: () => void;
  selected: boolean;
}) {
  const t = useTranslations("roadmap");
  const isLocked = level.state === "locked";
  const isCurrent = level.state === "current";
  const isCompleted = level.state === "completed";
  const pct = Math.round((level.lessonsCompleted / Math.max(1, level.lessonsTotal)) * 100);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!isLocked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      onClick={!isLocked ? onClick : undefined}
      className="rounded-[16px] p-4 max-w-[210px] w-full transition-all duration-200"
      style={{
        background: selected ? (isCurrent ? "#FFF8E1" : isCompleted ? "#ECFDF5" : "white") : "white",
        border: selected ? `2px solid ${level.color}` : "2px solid #E2E8F0",
        boxShadow: selected ? `0 6px 20px rgba(0,48,94,0.12), 0 0 0 1px ${level.color}30` : "0 2px 10px rgba(0,48,94,0.06)",
        cursor: isLocked ? "default" : "pointer",
        opacity: isLocked ? 0.6 : 1,
      }}
      whileHover={!isLocked ? { y: -2, boxShadow: "0 8px 24px rgba(0,48,94,0.14)" } : {}}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{level.emoji}</span>
        <div>
          <p className="font-bold text-sm leading-tight" style={{ color: isLocked ? "#94A3B8" : "#0F172A" }}>
            {level.title}
          </p>
          <p className="text-[10px]" style={{ color: "#94A3B8" }}>
            {level.subtitle}
          </p>
        </div>
      </div>

      <p className="text-xs mb-3" style={{ color: "#64748B" }}>
        {level.description}
      </p>

      {isLocked ? (
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-[#94A3B8]" />
          <span className="text-[11px] text-[#94A3B8]">{t("lockedBadge")}</span>
        </div>
      ) : isCompleted ? (
        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#D1FAE5] overflow-hidden">
            <div className="h-full bg-[#10B981] rounded-full" style={{ width: "100%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#10B981] font-semibold">{t("completedBadge")}</span>
            <span className="text-[11px] font-bold" style={{ color: "#FFCE00" }}>
              +{level.xpReward} XP
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#FEF9C3] overflow-hidden">
            <div className="h-full bg-[#FFCE00] rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#92400E]">
              {t("lessonsProgress", { done: level.lessonsCompleted, total: level.lessonsTotal })}
            </span>
            <span className="text-[11px] text-[#94A3B8]">+{level.xpReward} XP</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Connector({ fromState, toState }: { fromState: LevelState; toState: LevelState }) {
  const bothDone = fromState === "completed" && toState === "completed";
  const toCurrent = fromState === "completed" && toState === "current";

  return (
    <div className="flex flex-col items-center" style={{ height: 36, position: "relative", zIndex: 1 }}>
      <div
        className="w-0.5 h-full"
        style={{
          background: bothDone ? "#10B981" : toCurrent ? "linear-gradient(180deg, #10B981 0%, #FFCE00 100%)" : "#E2E8F0",
          boxShadow: bothDone ? "0 0 6px rgba(16,185,129,0.4)" : toCurrent ? "0 0 6px rgba(255,206,0,0.3)" : "none",
        }}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  delay: number;
}) {
  return (
    <motion.div
      className="bg-white rounded-[16px] p-4"
      style={{ border: "2px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,48,94,0.06)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ background: iconBg }}>
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-[#64748B] text-xs mb-0.5">{label}</p>
      <p className="text-[#0F172A] font-extrabold text-xl">{value}</p>
      <p className="text-[#94A3B8] text-xs mt-0.5">{sub}</p>
    </motion.div>
  );
}

function RotateCcwIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.8" />
    </svg>
  );
}

// ─── Main Roadmap Page ───────────────────────────────────────────────────────

export default function RoadmapPage() {
  const router = useRouter();
  const t = useTranslations("roadmap");
  const tStudent = useTranslations("student");
  const tErr = useTranslations("errors");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const levels = useMemo(() => buildLevelsFromPlan(plan, t), [plan, t]);

  const totalXP = useMemo(() => levels.filter((l) => l.state === "completed").reduce((s, l) => s + l.xpReward, 0), [levels]);

  const totalLessonsDone = useMemo(() => levels.reduce((s, l) => s + l.lessonsCompleted, 0), [levels]);
  const totalLessonsAll = useMemo(() => levels.reduce((s, l) => s + l.lessonsTotal, 0), [levels]);

  const currentWeek = Number(plan?.progress?.currentWeek ?? 1);
  const currentSessionIndex = Number(plan?.progress?.currentSessionIndex ?? 1);
  const targetLevel = plan?.targetLevel ?? "A1";

  const streak = dashboard?.streakDays ?? 0;
  const planPct = Math.round(Number(dashboard?.planProgressPercent ?? 0));

  const lessonsPct = totalLessonsAll > 0 ? Math.round((totalLessonsDone / totalLessonsAll) * 100) : 0;

  const selected = levels.find((l) => l.id === selectedLevel) ?? null;

  const currentLevelMeta = useMemo(() => levels.find((l) => l.state === "current"), [levels]);

  const handleLogout = useCallback(() => {
    clearTokens();
    router.push("/");
  }, [router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        const userData: AuthUser = res.data;
        if (userData.role !== "STUDENT") {
          router.push(`/${userData.role.toLowerCase()}`);
          return Promise.reject(new Error("redirect"));
        }
        setUser(userData);
        return Promise.all([api.get("/plan/me"), api.get("/student/dashboard").catch(() => ({ data: null }))]);
      })
      .then((res) => {
        if (!res) return;
        const [planRes, dashRes] = res;
        if (planRes?.data?.plan) setPlan(planRes.data.plan);
        if (dashRes?.data) setDashboard(dashRes.data);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "redirect") return;
        const status = httpStatus(err);
        if (status === 404) {
          router.push("/onboarding");
          return;
        }
        if (status === 401 || status === 403) {
          logout();
          return;
        }
        setApiError(tErr("backendUnreachable"));
      })
      .finally(() => setLoading(false));
  }, [router, tErr]);

  useEffect(() => {
    if (!levels.length) return;
    setSelectedLevel((prev) => {
      if (prev != null && levels.some((l) => l.id === prev)) return prev;
      return currentLevelMeta?.id ?? levels[0].id;
    });
  }, [levels, currentLevelMeta]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-12 w-12 text-[#00305E]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-[#64748B]">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = user.displayName
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const completedWeeks = levels.filter((l) => l.state === "completed").length;
  const firstWeek = levels[0]?.id ?? 1;
  const lastWeek = levels[levels.length - 1]?.id ?? 1;

  const heroRight = (
    <div className="flex items-center gap-3 flex-shrink-0">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[12px]"
        style={{
          background: "rgba(255,206,0,0.15)",
          border: "1.5px solid rgba(255,206,0,0.4)",
        }}
      >
        <Star size={16} fill="#FFCE00" className="text-[#FFCE00]" />
        <span className="font-extrabold text-[#00305E] text-sm">{totalXP.toLocaleString()}</span>
        <span className="text-[#64748B] text-xs">{t("xpShort")}</span>
      </div>
    </div>
  );

  const inner = !levels.length ? (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_2px_8px_rgba(0,48,94,0.06)]">
      <p className="font-semibold text-[#0F172A] mb-2">{t("emptyTitle")}</p>
      <p className="text-sm text-[#64748B] mb-4">{t("emptyHint")}</p>
      <button
        type="button"
        onClick={() => router.push("/onboarding")}
        className="px-4 py-2 rounded-[12px] bg-[#00305E] text-white text-sm font-semibold"
      >
        {t("emptyCta")}
      </button>
    </div>
  ) : (
    <>
      <motion.div
        className="relative overflow-hidden flex-shrink-0 rounded-[16px] mb-6"
        style={{
          background: "linear-gradient(135deg, #00305E 0%, #004080 60%, #0052A3 100%)",
          border: "2px solid rgba(255,206,0,0.25)",
        }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-32 w-40 h-40 rounded-full bg-[#FFCE00]/8" />

        <div className="relative px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium flex-shrink-0"
            >
              <ChevronLeft size={16} /> {t("heroBack")}
            </button>
            <div className="w-px h-8 bg-white/20 flex-shrink-0" />
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
                style={{
                  background: "linear-gradient(145deg, #FFD940, #FFCE00)",
                  boxShadow: "0 4px 0 0 #C9A200, 0 6px 14px rgba(255,206,0,0.3)",
                }}
              >
                🗺️
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-extrabold text-lg sm:text-xl tracking-tight truncate">{t("heroTitle")}</h2>
                <p className="text-white/60 text-xs truncate">{t("heroTagline")}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px]"
              style={{
                background: "rgba(255,206,0,0.15)",
                border: "1.5px solid rgba(255,206,0,0.4)",
              }}
            >
              <Star size={16} fill="#FFCE00" className="text-[#FFCE00]" />
              <span className="font-extrabold text-white">{totalXP.toLocaleString()}</span>
              <span className="text-white/60 text-xs">{t("xpShort")}</span>
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-[14px]"
              style={{
                background: "rgba(249,115,22,0.15)",
                border: "1.5px solid rgba(249,115,22,0.4)",
              }}
            >
              <Flame size={16} fill="#F97316" className="text-orange-400" />
              <span className="font-extrabold text-white">{streak}</span>
              <span className="text-white/60 text-xs">{t("streakShort")}</span>
            </div>
          </div>
        </div>

        <div className="relative max-w-5xl mx-auto px-5 pb-4">
          <div className="flex gap-1.5">
            {levels.map((l) => (
              <div
                key={l.id}
                className="flex-1 h-1.5 rounded-full"
                style={{
                  background:
                    l.state === "completed" ? "#FFCE00" : l.state === "current" ? "rgba(255,206,0,0.4)" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white/40 text-[10px]">{t("weekStripStart", { week: firstWeek })}</span>
            <span className="text-white/40 text-[10px] hidden sm:inline">···</span>
            <span className="text-white/40 text-[10px]">{t("weekStripEnd", { week: lastWeek })}</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="hidden lg:flex flex-col gap-4 order-last lg:order-first">
          <StatCard
            icon={Trophy}
            label={t("statStage")}
            value={targetLevel}
            sub={t("statStageSub", { week: currentLevelMeta?.id ?? currentWeek })}
            iconBg="#FFF8E1"
            iconColor="#D97706"
            delay={0.1}
          />
          <StatCard
            icon={Star}
            label={t("statTotalXp")}
            value={`${totalXP}`}
            sub={t("statTotalXpSub")}
            iconBg="#EEF4FF"
            iconColor="#00305E"
            delay={0.17}
          />
          <StatCard
            icon={Flame}
            label={t("statStreak")}
            value={tStudent("streakDays", { n: streak })}
            sub={t("statStreakSub")}
            iconBg="#FFF4EC"
            iconColor="#F97316"
            delay={0.24}
          />
          <StatCard
            icon={Target}
            label={t("statLessons")}
            value={`${totalLessonsDone} / ${totalLessonsAll}`}
            sub={t("statLessonsSub", { done: totalLessonsDone, total: totalLessonsAll, pct: lessonsPct })}
            iconBg="#F0FDF4"
            iconColor="#10B981"
            delay={0.31}
          />
          <StatCard
            icon={BarChart3}
            label={t("statPlanProgress")}
            value={`${planPct}%`}
            sub={t("statPlanProgressSub", { pct: planPct })}
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            delay={0.38}
          />
        </div>

        <div className="lg:col-span-2 order-first lg:order-none">
          <motion.div
            className="rounded-[20px] p-5 sm:p-6"
            style={{
              background: "white",
              border: "2px solid #E2E8F0",
              boxShadow: "0 4px 24px rgba(0,48,94,0.07)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-[#0F172A]">{t("pathTitle")}</h2>
                <p className="text-[#94A3B8] text-xs mt-0.5">
                  {t("levelsSummary", { done: completedWeeks, total: levels.length })}
                </p>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-semibold"
                style={{
                  background: "#EEF4FF",
                  color: "#00305E",
                  border: "1.5px solid rgba(0,48,94,0.12)",
                }}
              >
                <Map size={12} />
                {t("rangeBadge", { from: "A1", to: targetLevel })}
              </div>
            </div>

            <div className="flex flex-col items-stretch">
              {levels.map((level, i) => (
                <div key={level.id}>
                  <LevelNode
                    level={level}
                    index={i}
                    isLeft={i % 2 === 0}
                    onClick={() => setSelectedLevel(level.id === selectedLevel ? null : level.id)}
                    selected={selectedLevel === level.id}
                  />
                  {i < levels.length - 1 && <Connector fromState={level.state} toState={levels[i + 1].state} />}
                </div>
              ))}
            </div>

            {selected && (
              <motion.div
                className="mt-6 rounded-[16px] p-4"
                style={{
                  background:
                    selected.state === "completed" ? "#F0FDF4" : selected.state === "current" ? "#FFF8E1" : "#F8FAFC",
                  border: `2px solid ${
                    selected.state === "completed" ? "#BBF7D0" : selected.state === "current" ? "#FDE68A" : "#E2E8F0"
                  }`,
                }}
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{selected.emoji}</span>
                  <div className="flex-1">
                    <h3
                      className="font-bold text-base"
                      style={{
                        color: selected.state === "locked" ? "#94A3B8" : "#0F172A",
                      }}
                    >
                      {selected.title}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">{selected.description}</p>
                  </div>
                  <div
                    className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: selected.state === "completed" ? "#10B981" : selected.state === "current" ? "#FFCE00" : "#E2E8F0",
                      color: selected.state === "completed" ? "white" : selected.state === "current" ? "#00305E" : "#94A3B8",
                    }}
                  >
                    +{selected.xpReward} XP
                  </div>
                </div>

                {selected.state !== "locked" && (
                  <div className="mb-4">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-[#64748B]">
                        {t("lessonsProgress", { done: selected.lessonsCompleted, total: selected.lessonsTotal })}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: selected.color }}>
                        {Math.round((selected.lessonsCompleted / Math.max(1, selected.lessonsTotal)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-white/60">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: selected.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round((selected.lessonsCompleted / Math.max(1, selected.lessonsTotal)) * 100)}%`,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}

                {selected.state === "current" && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/student/plan/week/${selected.id}/session/${selected.id === currentWeek ? currentSessionIndex : 1}`)
                    }
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-sm transition-all"
                    style={{
                      background: "#00305E",
                      color: "white",
                      boxShadow: "0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)",
                    }}
                  >
                    <Play size={16} fill="white" /> {t("continueLesson")}
                  </button>
                )}
                {selected.state === "completed" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/student/plan/week/${selected.id}/session/1`)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-sm transition-all"
                    style={{
                      background: "#10B981",
                      color: "white",
                      boxShadow: "0 5px 0 0 #059669, 0 8px 20px rgba(16,185,129,0.25)",
                    }}
                  >
                    <RotateCcwIcon /> {t("repeatLesson")}
                  </button>
                )}
                {selected.state === "locked" && (
                  <div
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-semibold"
                    style={{ background: "#F5F7FA", color: "#94A3B8", border: "2px solid #E2E8F0" }}
                  >
                    <Lock size={14} /> {t("lockedCta")}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 lg:hidden">
            <StatCard
              icon={Trophy}
              label={t("mobileStatStage")}
              value={targetLevel}
              sub={t("mobileStatStageSub")}
              iconBg="#FFF8E1"
              iconColor="#D97706"
              delay={0}
            />
            <StatCard
              icon={Star}
              label={t("statTotalXp")}
              value={`${totalXP}`}
              sub={t("mobileStatXpSub")}
              iconBg="#EEF4FF"
              iconColor="#00305E"
              delay={0.05}
            />
            <StatCard
              icon={Flame}
              label={t("statStreak")}
              value={`${streak} 🔥`}
              sub={t("mobileStatStreakSub")}
              iconBg="#FFF4EC"
              iconColor="#F97316"
              delay={0.1}
            />
            <StatCard
              icon={Zap}
              label={t("statLessons")}
              value={`${totalLessonsDone}`}
              sub={t("mobileStatLessonsSub")}
              iconBg="#F0FDF4"
              iconColor="#10B981"
              delay={0.15}
            />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <StudentShell
      activeSection="roadmap"
      user={{ displayName: user.displayName, role: user.role }}
      targetLevel={targetLevel}
      streakDays={streak}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t("pageTitle")}
      headerSubtitle={t("pageSubtitle")}
      headerRight={levels.length ? heroRight : undefined}
    >
      {apiError && (
        <div className="mb-6 p-4 rounded-[12px] border border-red-200 bg-red-50 text-red-700 text-sm">{apiError}</div>
      )}
      <div
        className="min-h-0 flex flex-col"
        style={{
          background: "#F1F4F9",
          backgroundImage: "radial-gradient(circle, rgba(0,48,94,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          margin: "-24px -24px 0",
          padding: "24px",
        }}
      >
        {inner}
      </div>
    </StudentShell>
  );
}
