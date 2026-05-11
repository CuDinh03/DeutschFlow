"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

interface AchievementDto {
  id: number;
  code: string;
  nameVi: string;
  descriptionVi: string;
  iconEmoji: string;
  xpReward: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  unlocked: boolean;
}

interface XpSummary {
  totalXp: number;
  level: number;
  progressInLevel: number;
  xpNeededForNext: number;
  allAchievements: AchievementDto[];
}

const RARITY_STYLE: Record<string, { bg: string; border: string; label: string }> = {
  COMMON:    { bg: "#F8FAFC", border: "#E2E8F0", label: "Phổ thông" },
  RARE:      { bg: "#EFF6FF", border: "#BFDBFE", label: "Hiếm" },
  EPIC:      { bg: "#F5F3FF", border: "#C4B5FD", label: "Sử thi" },
  LEGENDARY: { bg: "#FFFBEB", border: "#FCD34D", label: "Huyền thoại" },
};

export default function BadgesPage() {
  const router = useRouter();
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [summary, setSummary] = useState<XpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  useEffect(() => {
    if (!me) return;
    api.get<XpSummary>("/xp/me")
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [me]);

  if (meLoading || !me) return null;

  const achievements = summary?.allAchievements ?? [];
  const filtered = achievements.filter((a) =>
    filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const pct = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0;

  return (
    <StudentShell
      activeSection="leaderboard"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="Huy hiệu & Thành tích"
      headerSubtitle={`${unlockedCount}/${achievements.length} đã mở khóa`}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* XP Level Card */}
        {summary && (
          <div
            className="rounded-2xl p-5 text-white space-y-3"
            style={{ background: "linear-gradient(135deg,#121212 0%,#1E293B 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">Cấp độ</p>
                <p className="text-3xl font-black">Lv. {summary.level}</p>
              </div>
              <div className="text-right">
                <p className="text-[#FFCD00] font-black text-xl">{summary.totalXp.toLocaleString()} XP</p>
                <p className="text-white/60 text-xs">+{summary.xpNeededForNext - summary.progressInLevel} đến Lv.{summary.level + 1}</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${summary.xpNeededForNext > 0 ? Math.round((summary.progressInLevel / summary.xpNeededForNext) * 100) : 0}%`,
                  background: "linear-gradient(90deg,#FFCD00,#F59E0B)",
                }}
              />
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-[#0F172A]">Tiến độ thành tích</span>
            <span className="font-black text-[#121212]">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div className="h-full rounded-full bg-[#FFCD00]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-[#64748B]">{unlockedCount} / {achievements.length} huy hiệu đã đạt được</p>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                filter === f
                  ? "bg-[#121212] text-white border-[#121212]"
                  : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              {f === "all" ? "Tất cả" : f === "unlocked" ? "✅ Đã đạt" : "🔒 Chưa đạt"}
            </button>
          ))}
        </div>

        {/* Achievement grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a, i) => {
              const style = RARITY_STYLE[a.rarity] ?? RARITY_STYLE.COMMON!;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl border-2 p-4 space-y-2 transition-all ${
                    a.unlocked ? "opacity-100" : "opacity-50 grayscale"
                  }`}
                  style={{ background: style.bg, borderColor: style.border }}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{a.iconEmoji}</span>
                    <div className="text-right">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: style.border, color: "#121212" }}
                      >
                        {style.label}
                      </span>
                    </div>
                  </div>
                  <p className="font-bold text-xs text-[#0F172A] leading-tight">{a.nameVi}</p>
                  <p className="text-[10px] text-[#64748B] leading-relaxed">{a.descriptionVi}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold text-[#FFCD00]">+{a.xpReward} XP</span>
                    {a.unlocked
                      ? <span className="text-[10px] text-green-600 font-bold">✅ Đạt</span>
                      : <span className="text-[10px] text-[#94A3B8]">🔒</span>
                    }
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm text-[#64748B]">
              {filter === "unlocked" ? "Chưa có huy hiệu nào" : "Đã đạt tất cả!"}
            </p>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
