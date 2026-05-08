"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Zap, Trophy, Lock } from "lucide-react";
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

interface XpSummaryDto {
  userId: number;
  totalXp: number;
  level: number;
  progressInLevel: number;
  xpNeededForNext: number;
  allAchievements: AchievementDto[];
  pendingBadges: AchievementDto[];
}

const rarityConfig = {
  COMMON:    { color: "#94A3B8", bg: "bg-slate-50   border-slate-200",   glow: "",                         label: "Phổ thông" },
  RARE:      { color: "#121212", bg: "bg-slate-50    border-slate-200",    glow: "shadow-slate-200",           label: "Hiếm" },
  EPIC:      { color: "#8B5CF6", bg: "bg-purple-50  border-purple-200",  glow: "shadow-purple-200",         label: "Sử thi" },
  LEGENDARY: { color: "#F59E0B", bg: "bg-amber-50   border-amber-200",   glow: "shadow-amber-200 shadow-lg", label: "Huyền thoại" },
};

function AchievementCard({ a }: { a: AchievementDto }) {
  const cfg = rarityConfig[a.rarity] ?? rarityConfig.COMMON;
  return (
    <div className={`rounded-[14px] border p-4 flex items-start gap-3 transition-all ${cfg.bg} ${a.unlocked ? cfg.glow : "opacity-50 grayscale"}`}>
      <div className="text-3xl leading-none flex-shrink-0">{a.iconEmoji}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-[#0F172A] text-sm truncate">{a.nameVi}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
            {cfg.label}
          </span>
          {a.unlocked && <span className="text-[9px] text-emerald-600 font-bold">✓ Đã mở</span>}
          {!a.unlocked && <Lock size={10} className="text-slate-400" />}
        </div>
        <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{a.descriptionVi}</p>
        <p className="text-[10px] font-bold mt-1" style={{ color: cfg.color }}>+{a.xpReward} XP</p>
      </div>
    </div>
  );
}

/** Toast shown when user unlocks a new badge. Auto-dismisses after 4s. */
function BadgeToast({ badge, onDismiss }: { badge: AchievementDto; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const cfg = rarityConfig[badge.rarity] ?? rarityConfig.COMMON;
  return (
    <motion.div
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 120, opacity: 0 }}
      className={`fixed bottom-24 right-4 z-50 flex items-center gap-3 bg-white rounded-[16px] border shadow-xl px-4 py-3 max-w-[280px] ${cfg.glow}`}
      style={{ borderColor: cfg.color + "60" }}
    >
      <div className="text-3xl">{badge.iconEmoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>Achievement Mở Khóa! 🎉</p>
        <p className="font-bold text-sm text-[#0F172A] truncate">{badge.nameVi}</p>
        <p className="text-[10px] text-[#64748B]">+{badge.xpReward} XP thưởng</p>
      </div>
      <button onClick={onDismiss} className="text-[#94A3B8] hover:text-[#0F172A]">
        <X size={14} />
      </button>
    </motion.div>
  );
}

/** XP Level bar shown in header / dashboard. */
export function XpLevelPill({ userId }: { userId?: number }) {
  const [summary, setSummary] = useState<XpSummaryDto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toastQueue, setToastQueue] = useState<AchievementDto[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/xp/me");
      const data: XpSummaryDto = res.data;
      setSummary(data);

      if (data.pendingBadges.length > 0) {
        setToastQueue(data.pendingBadges);
        // Acknowledge so we don't show again
        await api.post("/xp/me/badges/ack");
      }
    } catch {
      // silently skip — XP is non-critical
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 60s for new achievements
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (!summary) return null;

  const pct = summary.xpNeededForNext > 0
    ? Math.round((summary.progressInLevel / summary.xpNeededForNext) * 100)
    : 100;

  return (
    <>
      {/* XP Pill */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-[#6366F1]/10 to-[#8B5CF6]/10 border border-[#6366F1]/30 rounded-[12px] px-3 py-2 hover:border-[#6366F1]/60 transition-all"
        title={`${summary.totalXp} XP total — Level ${summary.level}`}
      >
        <div className="flex items-center gap-1.5">
          <Star size={14} className="text-[#6366F1]" fill="#6366F1" />
          <span className="font-bold text-[#6366F1] text-sm">Lv.{summary.level}</span>
        </div>
        {/* Mini progress bar */}
        <div className="w-14 h-1.5 bg-[#6366F1]/15 rounded-full overflow-hidden hidden sm:block">
          <div className="h-full bg-[#6366F1] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-[#6366F1]/70 font-medium hidden sm:inline">{summary.totalXp} XP</span>
      </button>

      {/* Badge Toasts */}
      <AnimatePresence>
        {toastQueue.slice(0, 1).map(badge => (
          <BadgeToast
            key={badge.code}
            badge={badge}
            onDismiss={() => setToastQueue(q => q.slice(1))}
          />
        ))}
      </AnimatePresence>

      {/* Full Achievement Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-[20px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F4F9]">
                <div>
                  <h2 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                    <Trophy size={20} className="text-amber-500" /> Hành trình của bạn
                  </h2>
                  <p className="text-[#64748B] text-sm mt-0.5">Level {summary.level} · {summary.totalXp} XP tổng cộng</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-[10px] hover:bg-[#F1F4F9] text-[#64748B]">
                  <X size={18} />
                </button>
              </div>

              {/* XP progress */}
              <div className="px-6 py-4 border-b border-[#F1F4F9]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
                      <span className="text-white font-extrabold text-sm">{summary.level}</span>
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] text-sm">Level {summary.level}</p>
                      <p className="text-[#94A3B8] text-[10px]">{summary.progressInLevel} / {summary.xpNeededForNext} XP đến level {summary.level + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[#6366F1]">
                    <Zap size={14} fill="#6366F1" />
                    <span className="font-extrabold text-sm">{summary.totalXp}</span>
                    <span className="text-xs text-[#6366F1]/60">XP</span>
                  </div>
                </div>
                <div className="h-3 bg-[#F1F4F9] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Achievements grid */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-3">
                  Thành tựu ({summary.allAchievements.filter(a => a.unlocked).length}/{summary.allAchievements.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.allAchievements.map(a => (
                    <AchievementCard key={a.code} a={a} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
