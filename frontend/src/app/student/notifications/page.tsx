"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ArrowLeft, Check, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { vi as dfVi } from "date-fns/locale";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import { notificationApi, NotificationItem } from "@/lib/notificationApi";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";

const NOTIF_ICONS: Record<string, string> = {
  USER_REGISTERED: "👤",
  LEARNER_PLAN_UPDATED: "📋",
  ADMIN_LEARNER_PLAN_CHANGED: "⚙️",
  ADMIN_LEARNER_SUBSCRIBED: "💳",
  ACHIEVEMENT_UNLOCKED: "🏆",
  LEVEL_UP: "⬆️",
  REVIEW_DUE: "📚",
  STREAK_REMINDER: "🔥",
};

function notifSummary(item: NotificationItem): string {
  const p = item.payload ?? {};
  switch (item.type) {
    case "ACHIEVEMENT_UNLOCKED":
      return `Bạn đã mở khóa huy hiệu "${String(p.achievementName ?? "")}"! +${String(p.xpReward ?? 0)} XP`;
    case "LEVEL_UP":
      return `Chúc mừng! Bạn đã lên Level ${String(p.newLevel ?? "")}!`;
    case "REVIEW_DUE":
      return String(p.message ?? `Có ${String(p.dueCount ?? 0)} thẻ cần ôn tập hôm nay`);
    case "STREAK_REMINDER":
      return String(p.message ?? "Đừng quên học hôm nay!");
    case "LEARNER_PLAN_UPDATED":
      return `Gói học của bạn đã được cập nhật: ${String(p.planCode ?? "")}`;
    case "ADMIN_LEARNER_SUBSCRIBED":
      return `Đăng ký thành công gói ${String(p.planCode ?? "")}`;
    default:
      return item.type.replace(/_/g, " ");
  }
}

export default function NotificationsPage() {
  usePageTimeTracker('notifications');
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async (pg = 0, uo = false) => {
    setLoading(true);
    try {
      const { data } = await notificationApi.list(pg, 20, uo || undefined);
      setItems(pg === 0 ? (data.items ?? []) : (prev) => [...prev, ...(data.items ?? [])]);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) fetchNotifications(0, unreadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await notificationApi.markRead(item.id);
      setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
    finally { setMarkingAll(false); }
  };

  const handleFilterChange = (uo: boolean) => {
    setUnreadOnly(uo);
    setPage(0);
    fetchNotifications(0, uo);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNotifications(next, unreadOnly);
  };

  const unreadCount = items.filter((n) => !n.read).length;

  if (meLoading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#6366F1]" />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="notifications"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="🔔 Thông báo"
      headerSubtitle="Cập nhật mới nhất từ DeutschFlow"
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-[#F1F5F9] rounded-xl p-1 gap-1">
            {[
              { label: "Tất cả", value: false },
              { label: "Chưa đọc", value: true },
            ].map(({ label, value }) => (
              <button
                key={String(value)}
                onClick={() => handleFilterChange(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  unreadOnly === value
                    ? "bg-white text-[#0F172A] shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {label}
                {value && unreadCount > 0 && (
                  <span className="ml-1 bg-[#FFCD00] text-[#0F172A] text-[10px] font-black px-1.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications(0, unreadOnly)}
              className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
              title="Làm mới"
            >
              <RefreshCw size={16} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0F172A] text-white text-sm font-semibold rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-60"
              >
                {markingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading && page === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-[#94A3B8]">
            <Bell size={40} className="opacity-30" />
            <p className="font-medium">Không có thông báo nào</p>
            <p className="text-sm">{unreadOnly ? "Bạn đã đọc hết rồi 🎉" : "Chưa có hoạt động mới"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {items.map((item, idx) => (
                <motion.button
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleMarkRead(item)}
                  className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    item.read
                      ? "bg-white border-[#E2E8F0] opacity-70"
                      : "bg-[#FFFBF0] border-[#FFCD00]/30 shadow-sm"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    item.read ? "bg-[#F1F5F9]" : "bg-[#FFCD00]/15"
                  }`}>
                    {NOTIF_ICONS[item.type] ?? "🔔"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${item.read ? "text-[#64748B]" : "text-[#0F172A] font-medium"}`}>
                      {notifSummary(item)}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-1">
                      {formatDistanceToNow(parseISO(item.createdAtUtc), {
                        addSuffix: true,
                        locale: dfVi,
                      })}
                    </p>
                  </div>

                  {/* Read indicator */}
                  {!item.read && (
                    <div className="w-2 h-2 rounded-full bg-[#FFCD00] flex-shrink-0 mt-1.5" />
                  )}
                  {item.read && (
                    <Check size={14} className="text-[#CBD5E1] flex-shrink-0 mt-1" />
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Load more */}
            {page < totalPages - 1 && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Tải thêm
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
