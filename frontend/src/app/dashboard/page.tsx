"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Mic, PenTool, CheckCircle2, Flame, ArrowRight,
  AlertTriangle, Loader2, RefreshCw, Target, TrendingUp, Repeat2,
} from "lucide-react";
import api from "@/lib/api";
import { TodayPlanDto } from "@/types/today-plan";
import { StudentShell } from "@/components/layouts/StudentShell";
import { clearTokens } from "@/lib/authSession";

interface UserProfile {
  displayName: string;
  role: string;
  targetLevel: string;
  streakDays: number;
  initials: string;
}

function buildSuggestedLessons(plan: TodayPlanDto) {
  const lessons = [...(plan.suggestedLessons ?? [])];
  if (lessons.length === 0) {
    // Build from adaptive suggestions if no explicit list
    if (plan.suggestedTopic || plan.suggestedCefr) {
      lessons.push({
        id: "adaptive-speaking",
        title: `Luyện nói: ${plan.suggestedTopic ?? "Tự do"} (${plan.suggestedCefr ?? "B1"})`,
        type: "speaking",
        estimatedMinutes: 15,
        href: `/speaking?topic=${plan.suggestedTopic ?? ""}&cefr=${plan.suggestedCefr ?? "B1"}`,
      });
    }
    lessons.push(
      { id: "vocab-daily", title: "Ôn từ vựng hàng ngày", type: "vocabulary", estimatedMinutes: 10, href: "/student/vocab-practice" },
      { id: "swipe-daily", title: "Swipe Cards — ôn nhanh", type: "review", estimatedMinutes: 5, href: "/student/swipe-cards" },
    );
  }
  return lessons;
}

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; accent: string; label: string }> = {
  vocabulary: { icon: <BookOpen size={20} />, bg: "bg-indigo-50 border-indigo-100", accent: "#6366f1", label: "Từ vựng" },
  speaking: { icon: <Mic size={20} />, bg: "bg-cyan-50 border-cyan-100", accent: "#06b6d4", label: "Luyện nói" },
  grammar: { icon: <PenTool size={20} />, bg: "bg-emerald-50 border-emerald-100", accent: "#10b981", label: "Ngữ pháp" },
  review: { icon: <Repeat2 size={20} />, bg: "bg-amber-50 border-amber-100", accent: "#f59e0b", label: "Ôn tập" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<TodayPlanDto | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [meRes, todayRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/today/me").catch(() => ({ data: null })),
      ]);
      const me = meRes.data;
      const nameParts = (me.displayName ?? me.email ?? "").split(" ");
      setProfile({
        displayName: me.displayName ?? me.email ?? "Học viên",
        role: me.role ?? "STUDENT",
        targetLevel: me.targetLevel ?? "B1",
        streakDays: me.streakDays ?? 0,
        initials: nameParts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DF",
      });

      const todayData = todayRes.data;
      if (todayData) {
        setPlan(todayData);
      } else {
        // Fallback mock when API not yet fully mapped
        setPlan({
          userId: me.id,
          date: new Date().toISOString(),
          dailyGoalProgress: 0,
          streakDays: me.streakDays ?? 0,
          suggestedLessons: [],
          errorReviewList: [],
        });
      }
    } catch {
      setError("Không thể tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleLogout = () => {
    clearTokens();
    router.push("/login");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F4F9]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#00305E]" />
          <p className="text-[#64748B] text-sm">Đang tải dữ liệu hôm nay...</p>
        </div>
      </div>
    );
  }

  const lessons = plan ? buildSuggestedLessons(plan) : [];
  const progress = plan?.dailyGoalProgress ?? 0;
  const streak = plan?.streakDays ?? profile.streakDays;
  const repairCount = plan?.repairTasksDue?.length ?? plan?.errorReviewList?.length ?? 0;

  return (
    <StudentShell
      activeSection="dashboard"
      user={{ displayName: profile.displayName, role: profile.role }}
      targetLevel={profile.targetLevel}
      streakDays={streak}
      initials={profile.initials}
      onLogout={handleLogout}
      headerTitle="Dashboard"
      headerSubtitle="Hôm nay bạn nên học gì?"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => load()} className="text-red-500 hover:text-red-700 text-sm font-medium">Thử lại</button>
          </div>
        )}

        {/* Header cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Streak", value: `${streak} ngày`, icon: <Flame size={18} className="text-orange-500" />, color: "#f97316" },
            { label: "Tiến độ hôm nay", value: `${progress}%`, icon: <Target size={18} className="text-blue-500" />, color: "#3b82f6" },
            { label: "Lỗi cần ôn", value: String(repairCount), icon: <AlertTriangle size={18} className="text-amber-500" />, color: "#f59e0b" },
            { label: "Chính xác", value: plan?.rollingAccuracy ? `${Math.round(plan.rollingAccuracy)}%` : "—", icon: <TrendingUp size={18} className="text-emerald-500" />, color: "#10b981" },
          ].map(({ label, value, icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-[16px] p-4 border border-[#E2E8F0] shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                  {icon}
                </div>
              </div>
              <p className="text-2xl font-extrabold text-[#0F172A]">{value}</p>
              <p className="text-[#94A3B8] text-xs mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-[16px] p-5 border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-[#0F172A] text-sm">Tiến độ mục tiêu hôm nay</p>
            <span className="text-sm font-bold" style={{ color: progress >= 80 ? "#10b981" : progress >= 50 ? "#f59e0b" : "#3b82f6" }}>
              {progress}%
            </span>
          </div>
          <div className="h-3 bg-[#F1F4F9] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: progress >= 80 ? "#10b981" : progress >= 50 ? "#f59e0b" : "#3b82f6" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Suggested lessons */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0F172A] text-base">📋 Hôm nay nên làm</h2>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#00305E] transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {lessons.map((lesson, i) => {
                const cfg = typeConfig[lesson.type] ?? typeConfig.vocabulary;
                return (
                  <motion.button
                    key={lesson.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    onClick={() => router.push(lesson.href ?? (lesson.type === "speaking" ? "/speaking" : "/student/vocab-practice"))}
                    className={`text-left rounded-[16px] p-5 border transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.99] ${cfg.bg}`}
                  >
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3" style={{ backgroundColor: cfg.accent + "20" }}>
                      <span style={{ color: cfg.accent }}>{cfg.icon}</span>
                    </div>
                    <p className="font-semibold text-[#0F172A] text-sm leading-snug mb-1">{lesson.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.accent + "15", color: cfg.accent }}>
                        {cfg.label}
                      </span>
                      <span className="text-[#94A3B8] text-xs">~{lesson.estimatedMinutes} phút</span>
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color: cfg.accent }}>
                      Bắt đầu <ArrowRight size={12} />
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Error review */}
        {(plan?.errorReviewList?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={18} className="text-amber-500" />
              <h2 className="font-bold text-[#0F172A] text-base">Lỗi cần ôn tập</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {plan!.errorReviewList.length}
              </span>
            </div>
            <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
              {plan!.errorReviewList.map((err, i) => (
                <div key={err.id} className={`p-4 ${i < plan!.errorReviewList.length - 1 ? "border-b border-[#F1F4F9]" : ""}`}>
                  <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">{err.category}</span>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                      <p className="text-xs text-red-500 line-through">{err.mistake}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <p className="text-xs text-emerald-600 font-semibold">{err.correction}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 border-t border-[#F1F4F9]">
                <button
                  onClick={() => router.push("/student/errors")}
                  className="text-xs font-semibold text-[#00305E] hover:underline flex items-center gap-1"
                >
                  Xem toàn bộ lỗi <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
