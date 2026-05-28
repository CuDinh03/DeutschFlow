"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Mic,
  PenTool,
  CheckCircle2,
  Flame,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Target,
  TrendingUp,
  Repeat2,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import { phaseApi, type PhaseStateResponse } from "@/lib/phaseApi";
import { TodayPlanDto } from "@/types/today-plan";
import { PhaseIndicator } from "@/components/journey/PhaseIndicator";
import { GraduationBanner } from "@/components/journey/GraduationBanner";
import { StudentShell } from "@/components/layouts/StudentShell";
import { logout } from "@/lib/authSession";
import { DeutschFlowLoader } from "@/components/ui/DeutschFlowLogo";
import { useTranslations } from "next-intl";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";

interface UserProfile {
  displayName: string;
  role: string;
  targetLevel: string;
  streakDays: number;
  initials: string;
}

type RoadmapMeta = {
  roadmapVersion?: string;
  roadmapType?: string;
  entryNodeCode?: string;
  currentLevel?: string;
  targetLevel?: string;
  currentNodeCode?: string;
  completedNodes?: number;
  totalNodes?: number;
  progressPercent?: number;
  progressModel?: string;
};

const typeStyles = {
  vocabulary: { icon: <BookOpen size={18} />, bg: "bg-slate-50 border-slate-100", accent: "#121212", labelKey: "typeVocab" },
  speaking: { icon: <Mic size={18} />, bg: "bg-amber-50 border-amber-100", accent: "#FFCD00", labelKey: "typeSpeaking" },
  grammar: { icon: <PenTool size={18} />, bg: "bg-emerald-50 border-emerald-100", accent: "#10b981", labelKey: "typeGrammar" },
  review: { icon: <Repeat2 size={18} />, bg: "bg-amber-50 border-amber-100", accent: "#f59e0b", labelKey: "typeReview" },
} as const;

function buildSuggestedLessons(plan: TodayPlanDto, t: any, roadmapMeta: RoadmapMeta | null) {
  const roadmapLevel = roadmapMeta?.currentLevel ?? roadmapMeta?.targetLevel ?? "A1";
  const roadmapStep = roadmapMeta?.currentNodeCode ?? roadmapLevel;
  const lessons = [...(plan.suggestedLessons ?? [])].slice(0, 2);

  const roadmapLesson = {
    id: "roadmap-next-step",
    title: t("lessonSpeaking", { topic: roadmapStep, cefr: roadmapMeta?.targetLevel ?? "A1" }),
    type: "grammar" as const,
    estimatedMinutes: 12,
    href: "/roadmap",
  };

  const supportingLessons = [
    ...(plan.recommendedSpeaking?.href
      ? [{
          id: "adaptive-speaking",
          title: plan.recommendedSpeaking.title ?? t("lessonSpeaking", { topic: plan.recommendedSpeaking.topic ?? t("lessonFree"), cefr: plan.recommendedSpeaking.cefr ?? roadmapMeta?.targetLevel ?? "A1" }),
          type: "speaking" as const,
          estimatedMinutes: 15,
          href: plan.recommendedSpeaking.href,
        }]
      : []),
    ...(plan.repairTasksDue?.length
      ? [{ id: "repair-review", title: t("lessonSwipe"), type: "review" as const, estimatedMinutes: 8, href: "/student/review" }]
      : []),
    ...(plan.recommendedVocabPractice?.href
      ? [{ id: "vocab-daily", title: plan.recommendedVocabPractice.title ?? t("lessonVocab"), type: "vocabulary" as const, estimatedMinutes: 10, href: plan.recommendedVocabPractice.href }]
      : []),
  ];

  return [roadmapLesson, ...supportingLessons, ...lessons]
    .filter((lesson, index, array) => array.findIndex((item) => item.id === lesson.id) === index)
    .slice(0, 4);
}

function buildNextBestAction(plan: TodayPlanDto, roadmapMeta: RoadmapMeta | null, t: any) {
  const lessons = buildSuggestedLessons(plan, t, roadmapMeta);
  const nextLesson = lessons[0];
  const roadmapLevel = roadmapMeta?.currentLevel ?? roadmapMeta?.targetLevel ?? "A1";

  if (!nextLesson) {
    return { title: t("loading"), description: "Đang chuẩn bị gợi ý học phù hợp nhất cho bạn.", href: "/dashboard", cta: "Làm mới" };
  }

  const reasonParts: string[] = [];
  if (roadmapMeta?.currentNodeCode) reasonParts.push(`Đang ở node ${roadmapMeta.currentNodeCode}`);
  if (roadmapMeta?.progressPercent != null) reasonParts.push(`Tiến độ roadmap ${Math.round(roadmapMeta.progressPercent)}%`);
  if (nextLesson.href === "/roadmap") reasonParts.push("Đi đúng bước tiếp theo trong lộ trình");
  if (nextLesson.type === "speaking" && plan.recommendedSpeaking?.title) reasonParts.push(`Theo gợi ý nói: ${plan.recommendedSpeaking.title}`);
  if (nextLesson.type === "review" && (plan.repairTasksDue?.length ?? 0) > 0) reasonParts.push("Bạn đang có lỗi cần ôn");
  if (reasonParts.length === 0) reasonParts.push(`Bước tiếp theo cho level ${roadmapLevel}`);

  return {
    title: nextLesson.title,
    description: reasonParts.join(" • "),
    href: nextLesson.href ?? "/roadmap",
    cta: nextLesson.href === "/roadmap" ? "Xem roadmap" : nextLesson.type === "speaking" ? "Bắt đầu nói" : nextLesson.type === "review" ? "Ôn ngay" : "Học ngay",
  };
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[18px] p-4 border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>{icon}</div>
      </div>
      <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
      <p className="text-[#94A3B8] text-xs mt-0.5">{label}</p>
    </motion.div>
  );
}

function LessonCard({ lesson, label, onOpen }: { lesson: any; label: string; onOpen: () => void }) {
  const cfg = typeStyles[lesson.type as keyof typeof typeStyles] ?? typeStyles.vocabulary;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className={`text-left rounded-[18px] p-5 border transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${cfg.bg}`}
    >
      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ backgroundColor: `${cfg.accent}20` }}>
        <span style={{ color: cfg.accent }}>{cfg.icon}</span>
      </div>
      <p className="font-semibold text-[#0F172A] text-sm leading-snug mb-1">{lesson.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${cfg.accent}15`, color: cfg.accent }}>{label}</span>
        <span className="text-[#94A3B8] text-xs">{lesson.estimatedMinutes} phút</span>
      </div>
      <div className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color: cfg.accent }}>
        {"Bắt đầu"} <ArrowRight size={12} />
      </div>
    </motion.button>
  );
}

export default function DashboardPage() {
  usePageTimeTracker('dashboard');
  const router = useRouter();
  const t = useTranslations("dashboard");
  const [plan, setPlan] = useState<TodayPlanDto | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roadmapMeta, setRoadmapMeta] = useState<RoadmapMeta | null>(null);
  const [phaseState, setPhaseState] = useState<PhaseStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [meRes, todayRes, dashRes, errRes, roadmapMetaRes, phaseRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/today/me").catch(() => ({ data: null })),
        api.get("/student/dashboard").catch(() => ({ data: null })),
        api.get("/error-skills/me").catch(() => ({ data: [] })),
        api.get("/roadmap/me/meta").catch(() => ({ data: null })),
        phaseApi.getCurrent().catch(() => ({ data: null })),
      ]);
      const me = meRes.data;
      const roadmapMetaData = roadmapMetaRes.data as RoadmapMeta | null;
      if (phaseRes.data) setPhaseState(phaseRes.data as PhaseStateResponse);
      const nameParts = (me.displayName ?? me.email ?? "").split(" ");
      const dashData = dashRes.data;
      const todayData = todayRes.data;
      const errorsData = errRes.data || [];
      const currentStreak = dashData?.streakDays ?? todayData?.progress?.streakDays ?? me.currentStreak ?? 0;

      setProfile({
        displayName: me.displayName ?? me.email ?? t("student"),
        role: me.role ?? "STUDENT",
        targetLevel: roadmapMetaData?.targetLevel ?? me.learningTargetLevel ?? "A1",
        streakDays: currentStreak,
        initials: nameParts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DF",
      });

      setRoadmapMeta(roadmapMetaData);

      const errorReviewList = (Array.isArray(errorsData) ? errorsData : []).slice(0, 3).map((err: any) => ({
        id: err.errorCode,
        category: err.errorCode,
        mistake: err.sampleWrong || "Lỗi ngữ pháp",
        correction: err.sampleCorrected || "Cần ôn tập",
      }));

      setPlan({
        userId: me.id,
        date: new Date().toISOString(),
        streakDays: currentStreak,
        suggestedLessons: [],
        errorReviewList,
        repairTasksDue: todayData?.dueRepairTasks || [],
        suggestedTopic: roadmapMetaData?.currentLevel ?? todayData?.recommendedSpeaking?.topic,
        suggestedCefr: roadmapMetaData?.targetLevel ?? todayData?.recommendedSpeaking?.cefr,
      });
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => logout();
  const handleOpenLesson = (lesson: any) => router.push(lesson.href ?? "/student/vocab-practice");

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]"><DeutschFlowLoader label={t("loading")} /></div>;
  }

  const lessons = plan ? buildSuggestedLessons(plan, t, roadmapMeta) : [];
  const nextBestAction = plan ? buildNextBestAction(plan, roadmapMeta, t) : null;
  const progress = roadmapMeta?.progressPercent ?? 0;
  const streak = plan?.streakDays ?? profile.streakDays;
  const repairCount = plan?.repairTasksDue?.length ?? plan?.errorReviewList?.length ?? 0;

  return (
    <StudentShell activeSection="dashboard" user={{ displayName: profile.displayName, role: profile.role }} targetLevel={profile.targetLevel} streakDays={streak} initials={profile.initials} onLogout={handleLogout} headerTitle="Dashboard" headerSubtitle={t("subtitle")} roadmapMeta={roadmapMeta}>
      <div className="max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => load()} className="text-red-500 hover:text-red-700 text-sm font-medium">{t("retry")}</button>
          </div>
        )}

        {nextBestAction && (
          <div className="relative overflow-hidden rounded-[24px] p-6 shadow-lg bg-gradient-to-br from-[#121212] via-[#0F172A] to-[#1F2937] text-white">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute left-10 bottom-0 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-semibold mb-2">Next Best Action</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">{nextBestAction.title}</h2>
                <p className="text-white/72 text-sm leading-6">{nextBestAction.description}</p>
              </div>
              <div className="flex flex-col sm:items-end gap-3">
                <Link href={nextBestAction.href} className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#121212] font-bold px-5 py-3 hover:bg-gray-100 transition-colors whitespace-nowrap shadow-[0_12px_30px_rgba(255,255,255,0.12)]">
                  {nextBestAction.cta}
                  <ArrowRight size={16} />
                </Link>
                <Link href="/speaking" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFCD00] text-[#121212] font-extrabold px-5 py-3 hover:bg-[#ffd633] transition-colors whitespace-nowrap shadow-[0_12px_30px_rgba(255,205,0,0.35)] border border-[#ffe066]">
                  <Mic size={16} />
                  Nói với AI
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-100 rounded-[20px] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
              <Sparkles size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-[#0F172A] text-base">Tham gia lớp học của giáo viên</h2>
              <p className="text-sm text-indigo-700 mt-1">Nhập mã lớp để tham gia và nhận bài tập từ giáo viên của bạn.</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <input type="text" id="joinCode" placeholder="Nhập mã lớp..." className="px-4 py-3 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm w-full sm:w-52 uppercase font-medium" onKeyDown={async (e) => { if (e.key === 'Enter') { const code = e.currentTarget.value; if (!code) return; try { await api.post('/v2/student/classes/join', { inviteCode: code }); alert('Đã gửi yêu cầu tham gia lớp. Vui lòng chờ giáo viên duyệt.'); e.currentTarget.value = ''; } catch (err: any) { alert(err.response?.data?.error || 'Không thể gửi yêu cầu tham gia lớp.'); } } }} />
            <button onClick={async () => { const code = (document.getElementById('joinCode') as HTMLInputElement)?.value; if (!code) return; try { await api.post('/v2/student/classes/join', { inviteCode: code }); alert('Đã gửi yêu cầu tham gia lớp. Vui lòng chờ giáo viên duyệt.'); (document.getElementById('joinCode') as HTMLInputElement).value = ''; } catch (err: any) { alert(err.response?.data?.error || 'Không thể gửi yêu cầu tham gia lớp.'); } }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors whitespace-nowrap shadow-sm">Xin vào lớp</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("statStreak"), value: `${streak} ${t("days")}`, icon: <Flame size={18} className="text-orange-500" />, color: "#f97316" },
            { label: t("statProgress"), value: `${progress}%`, icon: <Target size={18} className="text-amber-500" />, color: "#121212" },
            { label: t("statErrors"), value: String(repairCount), icon: <AlertTriangle size={18} className="text-amber-500" />, color: "#f59e0b" },
            { label: t("statAccuracy"), value: repairCount > 0 ? `${Math.max(50, 100 - repairCount * 10)}%` : "100%", icon: <TrendingUp size={18} className="text-emerald-500" />, color: "#10b981" },
          ].map(({ label, value, icon, color }) => <StatCard key={label} label={label} value={value} icon={icon} color={color} />)}
        </div>

        <div className="bg-white rounded-[20px] p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-[#0F172A] text-sm">{t("progressTitle")}</p>
            <span className="text-sm font-bold" style={{ color: progress >= 80 ? "#10b981" : progress >= 50 ? "#f59e0b" : "#121212" }}>{progress}%</span>
          </div>
          <div className="h-3 bg-[#F1F4F9] rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: progress >= 80 ? "#10b981" : progress >= 50 ? "#f59e0b" : "#121212" }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
          </div>
        </div>

        {phaseState && (
          phaseState.currentPhase === 'GRADUATED'
            ? <GraduationBanner phase={phaseState} />
            : <PhaseIndicator phase={phaseState} />
        )}

        {phaseState && phaseState.sessionsCompleted === 0 && (
          <Link
            href="/student/beginner"
            className="flex items-center justify-between bg-[#121212] text-white rounded-[20px] px-5 py-4 hover:bg-[#1e1e1e] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFCD00] flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} className="text-[#121212]" />
              </div>
              <div>
                <p className="font-extrabold text-sm">Bắt đầu buổi học đầu tiên</p>
                <p className="text-xs text-white/60">10 từ tiếng Đức cơ bản + nói chuyện với AI</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-white/60 flex-shrink-0" />
          </Link>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0F172A] text-base">{t("suggestedTitle")}</h2>
            <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#121212] transition-colors">
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              {t("refresh")}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {lessons.map((lesson) => {
                const cfg = typeStyles[lesson.type as keyof typeof typeStyles] ?? typeStyles.vocabulary;
                const label = t(cfg.labelKey);
                return <LessonCard key={lesson.id} lesson={lesson} label={label} onOpen={() => handleOpenLesson(lesson)} />;
              })}
            </AnimatePresence>
          </div>
        </div>

        {(plan?.errorReviewList?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={18} className="text-amber-500" />
              <h2 className="font-bold text-[#0F172A] text-base">{t("reviewTitle")}</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{plan!.errorReviewList.length}</span>
            </div>
            <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm overflow-hidden">
              {plan!.errorReviewList.map((err, i) => (
                <div key={err.id} className={`p-4 ${i < plan!.errorReviewList.length - 1 ? "border-b border-[#F1F4F9]" : ""}`}>
                  <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">{err.category}</span>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3"><p className="text-xs text-red-500 line-through">{err.mistake}</p></div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3"><p className="text-xs text-emerald-600 font-semibold">{err.correction}</p></div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 border-t border-[#F1F4F9]"><button onClick={() => router.push("/student/errors")} className="text-xs font-semibold text-[#121212] hover:underline flex items-center gap-1">Xem toàn bộ lỗi <ArrowRight size={11} /></button></div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
