"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api, { apiMessage, httpStatus } from "@/lib/api";
import { getAccessToken, clearTokens } from "@/lib/authSession";
import { errorSkillsApi, type ErrorSkillDto } from "@/lib/errors/drillApi";
import { reviewTasksApi, type ErrorReviewTaskDto } from "@/lib/reviewTasksApi";
import { todayApi, type TodayPlan } from "@/lib/todayApi";
import { planApi } from "@/lib/planApi";
import {
  BookOpen,
  Mic2,
  ChevronRight,
  Play,
  Clock,
  Target,
  Trophy,
  Zap,
  Flame,
  TrendingUp,
  Headphones,
  Sparkles,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AuthUser = {
  userId: number;
  email: string;
  displayName: string;
  role: string;
  locale: string;
};

type DashboardStats = {
  streakDays: number;
  weeklyXp: number;
  completedSessionsTotal: number;
  completedSessionsThisWeek: number;
  weeklyMinutesByDay: number[];
  weeklyMinutesStudied: number;
  avgMinutesPerDayThisWeek: number;
  planProgressPercent: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  weeklyTargetMinutes: number;
  weeksTotal: number;
  totalSessionsInPlan: number;
};

type PlanSession = {
  index: number;
  type: string;
  minutes?: number;
  difficulty?: number;
  skills?: string[];
  title?: string;
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

function sessionTypeLabel(t: (key: string) => string, type?: string) {
  switch (type) {
    case "GRAMMAR":
      return t("sessionTypeGRAMMAR");
    case "PRACTICE":
      return t("sessionTypePRACTICE");
    case "SPEAKING":
      return t("sessionTypeSPEAKING");
    case "REVIEW":
      return t("sessionTypeREVIEW");
    default:
      return type ?? "—";
  }
}

function sessionTypeVisual(type?: string) {
  switch (type) {
    case "SPEAKING":
      return {
        icon: Mic2,
        gradient: "from-[#8B5CF6] to-[#6D28D9]",
        tagBg: "bg-[#8B5CF6] text-white",
      };
    case "GRAMMAR":
      return {
        icon: BookOpen,
        gradient: "from-[#3B82F6] to-[#1D4ED8]",
        tagBg: "bg-[#3B82F6] text-white",
      };
    case "REVIEW":
      return {
        icon: Sparkles,
        gradient: "from-[#10B981] to-[#047857]",
        tagBg: "bg-[#10B981] text-white",
      };
    case "PRACTICE":
      return {
        icon: Trophy,
        gradient: "from-[#F59E0B] to-[#B45309]",
        tagBg: "bg-[#FFCE00] text-[#00305E]",
      };
    default:
      return {
        icon: GraduationCap,
        gradient: "from-[#00305E] to-[#004080]",
        tagBg: "bg-[#00305E] text-white",
      };
  }
}

const WEEK_DAY_KEYS = ["chartMon", "chartTue", "chartWed", "chartThu", "chartFri", "chartSat", "chartSun"] as const;

export default function Dashboard() {
  const t = useTranslations("student");
  const tErr = useTranslations("errors");
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [topErrors, setTopErrors] = useState<ErrorSkillDto[]>([]);
  const [reviewTasksToday, setReviewTasksToday] = useState<ErrorReviewTaskDto[]>([]);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [adaptiveRefreshing, setAdaptiveRefreshing] = useState(false);
  const [adaptiveFeedback, setAdaptiveFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string>("");
  const [reviewCompletingId, setReviewCompletingId] = useState<number | null>(null);
  const [reviewCompleteErr, setReviewCompleteErr] = useState<string>("");

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
        return Promise.all([
          api.get("/plan/me"),
          api.get("/student/dashboard"),
          errorSkillsApi.getMine(30).catch(() => ({ data: [] as ErrorSkillDto[] })),
          reviewTasksApi.getToday().catch(() => ({ data: [] as ErrorReviewTaskDto[] })),
          todayApi.getMe().catch(() => ({ data: null as TodayPlan | null })),
        ]);
      })
      .then((res) => {
        if (!res) return;
        const [planRes, dashRes, skillsRes, reviewRes, todayRes] = res;
        if (planRes?.data?.plan) setPlan(planRes.data.plan);
        if (dashRes?.data) setDashboard(dashRes.data);
        const skills = Array.isArray(skillsRes?.data) ? skillsRes.data : [];
        setTopErrors(skills.slice(0, 3));
        const tasks = Array.isArray(reviewRes?.data) ? reviewRes.data : [];
        setReviewTasksToday(tasks);
        setTodayPlan(todayRes?.data ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "redirect") return;
        const status = httpStatus(err);
        if (status === 404) {
          router.push("/onboarding");
          return;
        }
        if (status === 401 || status === 403) {
          clearTokens();
          router.push("/login");
          return;
        }
        setApiError(tErr("backendUnreachable"));
      })
      .finally(() => setLoading(false));
  }, [router, tErr]);

  const handleReviewTaskComplete = useCallback(
    async (taskId: number, passed: boolean) => {
      setReviewCompleteErr("");
      setReviewCompletingId(taskId);
      try {
        await reviewTasksApi.complete(taskId, passed);
        setReviewTasksToday((prev) => prev.filter((x) => x.id !== taskId));
      } catch (e: unknown) {
        setReviewCompleteErr(apiMessage(e));
      } finally {
        setReviewCompletingId(null);
      }
    },
    [],
  );

  const handleAdaptiveRefresh = useCallback(async () => {
    setAdaptiveRefreshing(true);
    setAdaptiveFeedback(null);
    try {
      const { data } = await planApi.refreshAdaptive();
      if (data.injected) {
        setAdaptiveFeedback(t("todayHeroAdaptiveInjected"));
      } else if (data.reason === "COOLDOWN_24H") {
        setAdaptiveFeedback(t("todayHeroAdaptiveCooldown"));
      } else if (data.reason === "DEDUP_WEEK_CODE") {
        setAdaptiveFeedback(t("todayHeroAdaptiveDedup"));
      } else if (data.reason === "NO_SKILLS") {
        setAdaptiveFeedback(t("todayHeroAdaptiveNoSkills"));
      } else {
        setAdaptiveFeedback(t("todayHeroAdaptiveNoop", { reason: data.reason }));
      }
      const planRes = await api.get<{ plan?: Plan }>("/plan/me");
      if (planRes?.data?.plan) setPlan(planRes.data.plan);
    } catch {
      setAdaptiveFeedback(tErr("backendUnreachable"));
    } finally {
      setAdaptiveRefreshing(false);
    }
  }, [t, tErr]);

  const handleLogout = () => {
    clearTokens();
    router.push("/");
  };

  const progress = plan?.progress ?? {};
  const currentWeek = Number(progress.currentWeek ?? 1);
  const currentSessionIndex = Number(progress.currentSessionIndex ?? 1);
  const targetLevel = plan?.targetLevel ?? "A1";

  const currentWeekBlock = useMemo<PlanWeek | undefined>(() => {
    return plan?.weeks?.find?.((w) => Number(w.week) === currentWeek) ?? plan?.weeks?.[0];
  }, [plan, currentWeek]);

  const nextSession = useMemo<PlanSession | null>(() => {
    const sessions = currentWeekBlock?.sessions;
    if (!Array.isArray(sessions)) return null;
    return sessions.find((s) => Number(s.index) === currentSessionIndex) ?? null;
  }, [currentWeekBlock, currentSessionIndex]);

  const recommendedSessions = useMemo<PlanSession[]>(() => {
    const sessions = currentWeekBlock?.sessions ?? [];
    // Keep "learning path" recommendations separate from "topic practice".
    return sessions.filter((s) => s.type !== "PRACTICE").slice(0, 4);
  }, [currentWeekBlock]);

  const weeklyChartData = useMemo(() => {
    const mins = dashboard?.weeklyMinutesByDay ?? [0, 0, 0, 0, 0, 0, 0];
    return WEEK_DAY_KEYS.map((key, i) => ({
      day: t(key),
      minutes: mins[i] ?? 0,
    }));
  }, [dashboard?.weeklyMinutesByDay, t]);

  const todayMinutes = useMemo(() => {
    const mins = dashboard?.weeklyMinutesByDay ?? [];
    const jsDay = new Date().getDay();
    const idx = (jsDay + 6) % 7; // Monday = 0
    return mins[idx] ?? 0;
  }, [dashboard?.weeklyMinutesByDay]);

  const dailyGoals = useMemo(() => {
    const sessionTarget = Math.max(1, dashboard?.sessionsPerWeek ?? 0);
    const sessionsToday = Math.min(1, dashboard?.completedSessionsThisWeek ?? 0);
    const minutesPerSession = Math.max(1, dashboard?.minutesPerSession ?? 25);
    const speakingTarget = Math.max(1, Math.round(minutesPerSession * 0.4));
    const listeningTarget = Math.max(1, Math.round(minutesPerSession * 0.3));
    const speakingDone = Math.min(speakingTarget, Math.round(todayMinutes * 0.5));
    const listeningDone = Math.min(listeningTarget, Math.round(todayMinutes * 0.3));

    return [
      {
        key: "vocab",
        label: t("dailyGoalVocab"),
        current: Math.min(20, Math.round(todayMinutes * 0.8)),
        total: 20,
        color: "#FFCE00",
        bg: "#FFF8E1",
      },
      {
        key: "lesson",
        label: t("dailyGoalLesson"),
        current: sessionsToday,
        total: 1,
        color: "#10B981",
        bg: "#ECFDF5",
      },
      {
        key: "speaking",
        label: t("dailyGoalSpeaking"),
        current: speakingDone,
        total: speakingTarget,
        color: "#8B5CF6",
        bg: "#F5F3FF",
      },
      {
        key: "listening",
        label: t("dailyGoalListening"),
        current: listeningDone,
        total: listeningTarget,
        color: "#3B82F6",
        bg: "#EFF6FF",
      },
    ];
  }, [dashboard, todayMinutes, t]);

  const dailyDoneCount = dailyGoals.filter((g) => g.current >= g.total).length;
  const dailyScorePct = Math.round((dailyDoneCount / dailyGoals.length) * 100);

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

  const firstName = user.displayName.split(" ")[0];
  const initials = user.displayName
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const d = dashboard;
  const streak = d?.streakDays ?? 0;
  const weeklyXp = d?.weeklyXp ?? 0;
  const completedTotal = d?.completedSessionsTotal ?? 0;
  const avgDay = d?.avgMinutesPerDayThisWeek ?? 0;
  const planPct = d?.planProgressPercent ?? 0;
  const weeklyStudied = d?.weeklyMinutesStudied ?? 0;
  const weeklyTarget = d?.weeklyTargetMinutes ?? (Number(plan?.weeklyMinutes) || 0);

  return (
    <StudentShell
      activeSection="dashboard"
      user={{ displayName: user.displayName, role: user.role }}
      targetLevel={targetLevel}
      streakDays={streak}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={
        <>
          {t("greeting", { name: firstName })} <span aria-hidden>👋</span>
        </>
      }
      headerSubtitle={t("subtitle")}
    >
          {apiError && (
            <div className="mb-6 p-4 rounded-[12px] border border-red-200 bg-red-50 text-red-700 text-sm">
              {apiError}
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                key: "streak",
                icon: Flame,
                label: t("statsStreak"),
                value: t("streakDays", { n: streak }),
                color: "text-orange-500",
                bg: "bg-orange-50",
                fill: "#f97316",
              },
              {
                key: "xp",
                icon: Trophy,
                label: t("statsWeekXp"),
                value: `${weeklyXp} XP`,
                color: "text-[#FFCE00]",
                bg: "bg-yellow-50",
                fill: "#FFCE00",
              },
              {
                key: "sessions",
                icon: Target,
                label: t("statsSessions"),
                value: String(completedTotal),
                color: "text-[#10B981]",
                bg: "bg-emerald-50",
                fill: undefined,
              },
              {
                key: "avg",
                icon: Zap,
                label: t("statsAvgDay"),
                value: t("minutesShort", { n: avgDay }),
                color: "text-[#3B82F6]",
                bg: "bg-blue-50",
                fill: undefined,
              },
            ].map(({ key, icon: Icon, label, value, color, bg, fill }) => (
              <div
                key={key}
                className="bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]"
              >
                <div
                  className={`w-9 h-9 rounded-[10px] ${bg} flex items-center justify-center mb-3`}
                >
                  <Icon size={18} className={color} fill={fill} />
                </div>
                <p className="text-[#64748B] text-xs mb-0.5">{label}</p>
                <p className="font-bold text-[#1A1A1A] text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Continue Learning Card */}
            <div className="xl:col-span-2">
              <div className="bg-gradient-to-br from-[#00305E] to-[#004080] rounded-[16px] p-6 text-white shadow-[0_8px_24px_rgba(0,48,94,0.18)] relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -right-4 w-36 h-36 rounded-full bg-[#FFCE00]/10" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-[#FFCE00] text-[#00305E] text-xs font-semibold px-3 py-1 rounded-full mb-3">
                        <TrendingUp size={12} />
                        {t("continueBadge")}
                      </div>
                      <h2 className="text-xl text-white mb-1">
                        {nextSession
                          ? t("continueTitle", { week: currentWeek, session: currentSessionIndex })
                          : t("continueNoPlan")}
                      </h2>
                      <p className="text-white/90 text-sm font-medium">
                        {nextSession ? sessionTypeLabel(t, nextSession.type) : ""}
                      </p>
                      <p className="text-white/70 text-sm mt-1">
                        {nextSession
                          ? t("continueMeta", {
                              minutes: nextSession.minutes ?? d?.minutesPerSession ?? 25,
                              skills: Array.isArray(nextSession.skills)
                                ? nextSession.skills.join(", ")
                                : "—",
                              difficulty: nextSession.difficulty ?? "—",
                            })
                          : t("continueOnboardingHint")}
                      </p>
                    </div>
                  </div>
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80 text-sm">{t("progressPlan")}</span>
                      <span className="text-[#FFCE00] font-semibold text-sm">{planPct}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FFCE00] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, planPct))}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {nextSession
                          ? t("minutesLeft", {
                              n: nextSession.minutes ?? d?.minutesPerSession ?? 25,
                            })
                          : "—"}
                      </span>
                      <span>
                        {dashboard?.totalSessionsInPlan
                          ? t("sessionXofY", {
                              n: completedTotal,
                              total: dashboard.totalSessionsInPlan,
                            })
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!nextSession) {
                        router.push("/onboarding");
                        return;
                      }
                      router.push(
                        `/student/plan/week/${currentWeek}/session/${currentSessionIndex}`,
                      );
                    }}
                    className="flex items-center gap-2 bg-[#FFCE00] hover:bg-[#E6B900] text-[#00305E] font-semibold px-5 py-2.5 rounded-[12px] transition-colors shadow-md text-sm"
                  >
                    <Play size={16} fill="#00305E" />
                    {nextSession ? t("continueLessonBtn") : t("goToPlan")}
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Goals (real-data driven) */}
            <div className="bg-white rounded-[16px] p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]">
              <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Target size={16} className="text-[#00305E]" />
                {t("dailyGoalsTitle")}
              </h3>
              <div className="space-y-4">
                {dailyGoals.map(({ key, label, current, total, color, bg }) => {
                  const pct = Math.round((current / total) * 100);
                  const done = current >= total;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[#1A1A1A] text-sm">{label}</span>
                        <span
                          className={`text-xs font-semibold ${done ? "text-[#10B981]" : "text-[#64748B]"}`}
                        >
                          {done ? t("dailyGoalDone") : `${current}/${total}`}
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: bg }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] text-xs">{t("dailyGoalsScore")}</span>
                  <span className="text-[#00305E] font-bold text-sm">
                    {t("dailyGoalsScoreCount", {
                      done: dailyDoneCount,
                      total: dailyGoals.length,
                    })}
                  </span>
                </div>
                <div className="h-2 bg-[#F5F7FA] rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#00305E] rounded-full"
                    style={{ width: `${dailyScorePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-[#1A1A1A]">{t("chartTitle")}</h3>
                <p className="text-[#64748B] text-sm mt-0.5">
                  {t("chartSubtitle", { total: weeklyStudied, target: weeklyTarget })}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-[10px] px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#00305E]" />
                <span className="text-[#64748B] text-xs">{t("chartLegend")}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={weeklyChartData}
                barSize={36}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "#F0F4F8", radius: 8 }}
                  contentStyle={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 4px 12px rgba(0,48,94,0.08)",
                  }}
                  formatter={(value: number) => [t("minutesShort", { n: value }), ""]}
                  labelFormatter={(label: string) => label}
                />
                <Bar dataKey="minutes" fill="#00305E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {todayPlan && (
            <div className="mb-6 rounded-[16px] border border-[#00305E]/15 bg-gradient-to-br from-[#00305E] to-[#0a4d8c] p-5 shadow-[0_8px_24px_rgba(0,48,94,0.15)] text-white">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[#FFCE00] text-xs font-semibold uppercase tracking-wide mb-1">
                    {t("todayHeroBadge")}
                  </p>
                  <h3 className="text-lg font-bold">{t("todayHeroTitle")}</h3>
                  <p className="text-white/75 text-sm mt-1">
                    {t("todayHeroMeta", {
                      roll: todayPlan.progress.rollingAccuracyPercent,
                      streak: todayPlan.progress.streakDays,
                      weak: todayPlan.progress.topWeakErrorCode ?? "—",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdaptiveRefresh()}
                  disabled={adaptiveRefreshing}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={adaptiveRefreshing ? "animate-spin" : ""} aria-hidden />
                  {t("todayHeroAdaptiveSave")}
                </button>
              </div>
              {adaptiveFeedback && (
                <p className="text-xs text-[#FFCE00]/95 mb-3 leading-snug">{adaptiveFeedback}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[12px] bg-white/10 border border-white/15 p-4">
                  <p className="text-white/70 text-xs font-semibold mb-2">{t("todayHeroRepair")}</p>
                  {todayPlan.dueRepairTasks.length === 0 ? (
                    <p className="text-sm text-white/60">{t("todayHeroRepairEmpty")}</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {todayPlan.dueRepairTasks.slice(0, 5).map((task) => (
                        <li key={task.id} className="font-mono text-[#FFCE00]/95 truncate" title={task.errorCode}>
                          {task.errorCode}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-[12px] bg-white/10 border border-white/15 p-4 flex flex-col">
                  <p className="text-white/70 text-xs font-semibold mb-2">{t("todayHeroSpeaking")}</p>
                  <p className="text-xs text-white/55 mb-1">{t("todayHeroSpeakingHint")}</p>
                  <p className="text-sm font-medium line-clamp-2">
                    {todayPlan.recommendedSpeaking.topic ?? "—"}
                  </p>
                  <p className="text-xs text-white/55 mt-1">
                    {todayPlan.recommendedSpeaking.cefrLevel ?? ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(todayPlan.recommendedSpeaking.href)}
                    className="mt-auto pt-3 text-left text-sm font-semibold text-[#FFCE00] flex items-center gap-1"
                  >
                    {t("todayHeroOpen")} <ChevronRight size={14} />
                  </button>
                </div>
                <div className="rounded-[12px] bg-white/10 border border-[#22D3EE]/25 p-4 flex flex-col">
                  <p className="text-white/70 text-xs font-semibold mb-2">{t("todayHeroWeekly")}</p>
                  <p className="text-xs text-white/55 mb-1">{t("todayHeroWeeklyHint")}</p>
                  <p className="text-sm font-medium line-clamp-2">
                    {todayPlan.recommendedWeeklySpeaking?.cefrLevel
                      ? `CEFR ${todayPlan.recommendedWeeklySpeaking.cefrLevel}`
                      : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(todayPlan.recommendedWeeklySpeaking?.href ?? "/student/weekly-speaking")
                    }
                    className="mt-auto pt-3 text-left text-sm font-semibold text-[#FFCE00] flex items-center gap-1"
                  >
                    {t("todayHeroOpen")} <ChevronRight size={14} />
                  </button>
                </div>
                <div className="rounded-[12px] bg-white/10 border border-white/15 p-4 flex flex-col">
                  <p className="text-white/70 text-xs font-semibold mb-2">{t("todayHeroVocab")}</p>
                  <p className="text-sm font-medium line-clamp-2">
                    {todayPlan.recommendedVocabPractice.topic ?? "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push(todayPlan.recommendedVocabPractice.href)}
                    className="mt-auto pt-3 text-left text-sm font-semibold text-[#FFCE00] flex items-center gap-1"
                  >
                    {t("todayHeroOpen")} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#1A1A1A]">{t("reviewTasksTitle")}</h3>
              <button
                type="button"
                onClick={() => router.push("/speaking")}
                className="text-[#00305E] text-sm font-medium hover:text-[#004080] flex items-center gap-1"
              >
                {t("reviewTasksOpenSpeaking")}
                <ChevronRight size={14} />
              </button>
            </div>
            {reviewCompleteErr && (
              <p className="text-sm text-red-600 mb-3">{reviewCompleteErr}</p>
            )}
            {reviewTasksToday.length === 0 ? (
              <p className="text-sm text-[#64748B]">{t("reviewTasksEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {reviewTasksToday.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-medium text-[#00305E]">{task.errorCode}</span>
                      <span className="text-[#64748B] text-xs">
                        {task.taskType === "REWRITE"
                          ? t("reviewTaskTypeRewrite")
                          : task.taskType}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        disabled={reviewCompletingId === task.id}
                        onClick={() => void handleReviewTaskComplete(task.id, true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-[8px] bg-[#00305E] text-white hover:bg-[#004080] disabled:opacity-50"
                      >
                        {reviewCompletingId === task.id ? t("reviewTaskSaving") : t("reviewTaskPassed")}
                      </button>
                      <button
                        type="button"
                        disabled={reviewCompletingId === task.id}
                        onClick={() => void handleReviewTaskComplete(task.id, false)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#CBD5E1] text-[#475569] hover:bg-white disabled:opacity-50"
                      >
                        {t("reviewTaskNotYet")}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/student/errors`)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-[#00305E]/20 text-[#00305E] hover:bg-[#00305E]/5"
                      >
                        {t("reviewTaskOpenDrill")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {topErrors.length > 0 && (
            <div className="mb-6 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#1A1A1A]">{t("topErrorsTitle")}</h3>
                <button
                  type="button"
                  onClick={() => router.push("/student/errors")}
                  className="text-[#00305E] text-sm font-medium hover:text-[#004080] flex items-center gap-1"
                >
                  {t("topErrorsViewAll")}
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {topErrors.map((e) => (
                  <button
                    key={e.errorCode}
                    type="button"
                    onClick={() => router.push("/student/errors")}
                    className="rounded-full border border-[#E2E8F0] bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-[#00305E] hover:bg-[#E2E8F0]"
                  >
                    {e.errorCode}
                    <span className="text-[#64748B]"> · {e.count}×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended (real plan sessions) */}
          {recommendedSessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#1A1A1A]">{t("recommendationsTitle")}</h3>
                <button
                  type="button"
                  onClick={() => router.push("/student/plan")}
                  className="text-[#00305E] text-sm font-medium hover:text-[#004080] flex items-center gap-1 transition-colors"
                >
                  {t("viewAll")} <ChevronRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {recommendedSessions.map((session) => {
                  const visual = sessionTypeVisual(session.type);
                  const Icon = visual.icon;
                  const isCurrent = session.index === currentSessionIndex;
                  const tagLabel = isCurrent
                    ? t("recTagRecommended")
                    : session.index < currentSessionIndex
                      ? t("recTagPopular")
                      : t("recTagNew");

                  return (
                    <button
                      key={session.index}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/student/plan/week/${currentWeek}/session/${session.index}`,
                        )
                      }
                      className="text-left bg-white rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] hover:shadow-[0_6px_18px_rgba(0,48,94,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                    >
                      <div
                        className={`relative h-32 bg-gradient-to-br ${visual.gradient} flex items-center justify-center overflow-hidden`}
                      >
                        <Icon className="text-white/95" size={48} strokeWidth={1.5} />
                        <span
                          className={`absolute top-2.5 left-2.5 text-xs font-semibold px-2 py-0.5 rounded-full ${visual.tagBg}`}
                        >
                          {tagLabel}
                        </span>
                        <span className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur text-[#00305E] text-xs font-bold px-2 py-0.5 rounded-full">
                          {targetLevel}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <h4 className="font-semibold text-[#1A1A1A] text-sm mb-2 line-clamp-2 leading-snug">
                          {session.title || sessionTypeLabel(t, session.type)}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-[#64748B]">
                          <div className="flex items-center gap-1">
                            <Clock size={11} />
                            <span>
                              {t("minutesShort", {
                                n: session.minutes ?? d?.minutesPerSession ?? 25,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Headphones size={11} className="text-[#64748B]" />
                            <span className="font-medium text-[#1A1A1A]">
                              {Array.isArray(session.skills) && session.skills.length > 0
                                ? session.skills[0]
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topic practice (separate from learning path) */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1A1A1A]">{t("topicPracticeTitle")}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => router.push("/student/vocab-practice")}
                className="text-left bg-white rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] hover:shadow-[0_6px_18px_rgba(0,48,94,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
              >
                <div className="relative h-32 bg-gradient-to-br from-[#F59E0B] to-[#B45309] flex items-center justify-center overflow-hidden">
                  <Trophy className="text-white/95" size={48} strokeWidth={1.5} />
                  <span className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur text-[#00305E] text-xs font-bold px-2 py-0.5 rounded-full">
                    {targetLevel}
                  </span>
                </div>
                <div className="p-3.5">
                  <h4 className="font-semibold text-[#1A1A1A] text-sm mb-1 leading-snug">
                    {t("topicPracticeVocabTitle")}
                  </h4>
                  <p className="text-xs text-[#64748B] line-clamp-2">{t("topicPracticeVocabDesc")}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/speaking")}
                className="text-left bg-white rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0] hover:shadow-[0_6px_18px_rgba(0,48,94,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
              >
                <div className="relative h-32 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center overflow-hidden">
                  <Mic2 className="text-white/95" size={48} strokeWidth={1.5} />
                  <span className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur text-[#00305E] text-xs font-bold px-2 py-0.5 rounded-full">
                    {targetLevel}
                  </span>
                </div>
                <div className="p-3.5">
                  <h4 className="font-semibold text-[#1A1A1A] text-sm mb-1 leading-snug">
                    {t("topicPracticeSpeakingTitle")}
                  </h4>
                  <p className="text-xs text-[#64748B] line-clamp-2">{t("topicPracticeSpeakingDesc")}</p>
                </div>
              </button>
            </div>
          </div>
    </StudentShell>
  );
}
