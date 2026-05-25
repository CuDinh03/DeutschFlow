"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

interface AchievementToast {
  code: string;
  nameVi: string;
  iconEmoji: string;
  xpReward: number;
}

/**
 * Global achievement toast — polls /api/xp/me for pending badges on mount.
 * Renders a stacked toast at bottom-center.
 * Call from a layout that wraps all student pages.
 */
export function AchievementToastProvider() {
  const [queue, setQueue] = useState<AchievementToast[]>([]);
  const [visible, setVisible] = useState<AchievementToast | null>(null);

  // Poll for pending badges on mount
  useEffect(() => {
    api.get<{ pendingBadges: AchievementToast[] }>("/xp/me")
      .then((res) => {
        const pending = res.data?.pendingBadges ?? [];
        if (pending.length > 0) {
          setQueue(pending);
          // Acknowledge so they won't show again
          api.post("/xp/me/badges/ack").catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Show queue items one by one
  useEffect(() => {
    if (visible || queue.length === 0) return;
    const [first, ...rest] = queue;
    setVisible(first!);
    const timer = setTimeout(() => {
      setVisible(null);
      setQueue(rest);
    }, 3500);
    return () => clearTimeout(timer);
  }, [queue, visible]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.code}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 18, stiffness: 260 }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl border border-[#FFCD00]/30"
            style={{
              background: "linear-gradient(135deg,#121212 0%,#1E293B 100%)",
              minWidth: 260,
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#FFCD00]/10 flex items-center justify-center text-2xl flex-shrink-0">
              {visible.iconEmoji}
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-[#FFCD00] font-bold uppercase tracking-wide">🏆 Huy hiệu mới!</p>
              <p className="text-white font-bold text-sm">{visible.nameVi}</p>
              <p className="text-white/60 text-xs">+{visible.xpReward} XP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
