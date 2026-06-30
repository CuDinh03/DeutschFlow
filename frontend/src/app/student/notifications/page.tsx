"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Loader2, RefreshCw,
  BookOpen, Trophy, Users, Settings, Brain,
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, differenceInDays, parseISO } from "date-fns";
import { vi as dfVi } from "date-fns/locale";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import { notificationApi, NotificationItem } from "@/lib/notificationApi";
import { usePageTimeTracker } from "@/hooks/usePageTimeTracker";

// ─── Category config ──────────────────────────────────────────────────────────

type Category = "all" | "learning" | "achievement" | "class" | "system";

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all",         label: "Tất cả",     icon: Bell    },
  { id: "learning",    label: "Học tập",    icon: Brain   },
  { id: "achievement", label: "Thành tích", icon: Trophy  },
  { id: "class",       label: "Lớp học",    icon: Users   },
  { id: "system",      label: "Hệ thống",   icon: Settings },
];

function getCategory(type: string): Category {
  if (["REVIEW_DUE", "STREAK_REMINDER"].includes(type)) return "learning";
  if (["ACHIEVEMENT_UNLOCKED", "LEVEL_UP"].includes(type)) return "achievement";
  if ([
    "NEW_ASSIGNMENT", "JOIN_REQUEST_APPROVED", "JOIN_REQUEST_REJECTED",
    "ADDED_TO_CLASS", "ASSIGNMENT_GRADED", "NEW_CLASS_ASSIGNMENT",
    "TEACHER_ANNOUNCEMENT",
  ].includes(type)) return "class";
  return "system";
}

// ─── Date grouping ────────────────────────────────────────────────────────────

type DateGroup = "today" | "yesterday" | "this_week" | "earlier";

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today:     "Hôm nay",
  yesterday: "Hôm qua",
  this_week: "Tuần này",
  earlier:   "Trước đó",
};

function getDateGroup(iso: string): DateGroup {
  const date = parseISO(iso);
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  if (differenceInDays(new Date(), date) < 7) return "this_week";
  return "earlier";
}

// ─── Notification meta ────────────────────────────────────────────────────────

type NotifMeta = { icon: string; actionLabel?: string; actionHref?: string };

function getNotifMeta(item: NotificationItem): NotifMeta {
  const p = item.payload ?? {};
  switch (item.type) {
    case "ACHIEVEMENT_UNLOCKED": return { icon: "🏆" };
    case "LEVEL_UP":             return { icon: "⬆️" };
    case "REVIEW_DUE":           return { icon: "📚", actionLabel: "Ôn ngay →", actionHref: "/student/review" };
    case "STREAK_REMINDER":      return { icon: "🔥", actionLabel: "Học ngay →", actionHref: "/dashboard" };
    case "TEACHER_ANNOUNCEMENT": return { icon: "📢" };
    case "ADMIN_BROADCAST":      return { icon: "📣" };
    case "NEW_ASSIGNMENT":       return { icon: "📝", actionLabel: "Xem bài →", actionHref: "/student/assignments" };
    case "ASSIGNMENT_GRADED":    return { icon: "✅" };
    case "NEW_CLASS_ASSIGNMENT": return { icon: "📋" };
    case "JOIN_REQUEST_APPROVED":return { icon: "✅", actionLabel: "Vào lớp →", actionHref: "/student/classes" };
    case "JOIN_REQUEST_REJECTED":return { icon: "❌" };
    case "ADDED_TO_CLASS":       return { icon: "👥", actionLabel: "Xem lớp →", actionHref: "/student/classes" };
    case "LEARNER_PLAN_UPDATED": return { icon: "📋" };
    case "ADMIN_LEARNER_SUBSCRIBED": return { icon: "💳" };
    default:                     return { icon: "🔔" };
  }
}

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
    case "NEW_ASSIGNMENT":
      return `${String(p.teacherName ?? "Giáo viên")} đã giao quiz "${String(p.quizTitle ?? "")}" cho lớp ${String(p.classroomName ?? "")}`;
    case "JOIN_REQUEST_APPROVED":
      return `Yêu cầu tham gia lớp ${String(p.className ?? "")} đã được chấp thuận`;
    case "JOIN_REQUEST_REJECTED":
      return `Yêu cầu tham gia lớp ${String(p.className ?? "")} đã bị từ chối`;
    case "ADDED_TO_CLASS":
      return `Bạn đã được thêm vào lớp ${String(p.className ?? "")} bởi ${String(p.teacherName ?? "giáo viên")}`;
    case "ASSIGNMENT_GRADED": {
      const typeLabel = p.assignmentType === "SPEAKING" ? "Speaking" : "Bài tập";
      return `${typeLabel} đã được chấm điểm${p.score != null ? ` · Điểm ${String(p.score)}` : ""}`;
    }
    case "NEW_CLASS_ASSIGNMENT":
      return `Lớp ${String(p.className ?? "")} có bài tập mới: ${String(p.topic ?? "")}`;
    case "TEACHER_ANNOUNCEMENT":
      return String(p.message ?? p.title ?? "Thông báo từ giáo viên");
    case "ADMIN_BROADCAST":
      return String(p.title ?? p.message ?? "Thông báo từ hệ thống");
    default:
      // Unmapped type: use the server-rendered content instead of the raw enum.
      return item.body || item.title || "Bạn có thông báo mới";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  usePageTimeTracker("notifications");
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState<Category>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async (pg = 0, uo = false) => {
    setLoading(true);
    try {
      const { data } = await notificationApi.list(pg, 20, uo || undefined);
      setItems((pg === 0)
        ? (data.items ?? [])
        : (prev) => [...prev, ...(data.items ?? [])]);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me) void fetchNotifications(0, unreadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await notificationApi.markRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  };

  const handleActivate = async (item: NotificationItem, href?: string) => {
    await handleMarkRead(item);
    if (href) router.push(href);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ } finally {
      setMarkingAll(false);
    }
  };

  const handleCategoryChange = (c: Category) => {
    setCategory(c);
    setUnreadOnly(false);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    void fetchNotifications(next, unreadOnly);
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let list = items;
    if (unreadOnly) list = list.filter((n) => !n.read);
    if (category !== "all") list = list.filter((n) => getCategory(n.type) === category);
    return list;
  }, [items, unreadOnly, category]);

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: Partial<Record<DateGroup, NotificationItem[]>> = {};
    const order: DateGroup[] = ["today", "yesterday", "this_week", "earlier"];
    for (const item of filteredItems) {
      const g = getDateGroup(item.createdAtUtc);
      if (!groups[g]) groups[g] = [];
      groups[g]!.push(item);
    }
    return order.filter((g) => groups[g]?.length).map((g) => ({ group: g, items: groups[g]! }));
  }, [filteredItems]);

  const unreadCount = items.filter((n) => !n.read).length;

  // Category counts (for badge on tabs)
  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { all: 0, learning: 0, achievement: 0, class: 0, system: 0 };
    for (const n of items) {
      if (!n.read) {
        counts.all++;
        counts[getCategory(n.type)]++;
      }
    }
    return counts;
  }, [items]);

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
      headerTitle="Thông báo"
      headerSubtitle="Cập nhật mới nhất từ DeutschFlow"
    >
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ── Top controls ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                unreadOnly
                  ? "bg-[#0F172A] text-white border-[#0F172A]"
                  : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#0F172A]"
              }`}
            >
              Chưa đọc
              {unreadCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                  unreadOnly ? "bg-[#FFCD00] text-[#0F172A]" : "bg-[#0F172A] text-white"
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchNotifications(0, unreadOnly)}
              className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
              title="Làm mới"
            >
              <RefreshCw size={15} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => void handleMarkAll()}
                disabled={markingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold rounded-lg hover:bg-[#1E293B] transition-colors disabled:opacity-60"
              >
                {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>

        {/* ── Category tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(({ id, label, icon: Icon }) => {
            const count = categoryCounts[id];
            const active = category === id;
            return (
              <button
                key={id}
                onClick={() => handleCategoryChange(id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  active
                    ? "bg-[#0F172A] text-white border-[#0F172A] shadow-sm"
                    : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#0F172A]/30 hover:text-[#0F172A]"
                }`}
              >
                <Icon size={12} />
                {label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                    active ? "bg-[#FFCD00] text-[#0F172A]" : "bg-[#EF4444] text-white"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── List ────────────────────────────────────────────────────── */}
        {loading && page === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-[#94A3B8]">
            <Bell size={40} className="opacity-20" />
            <p className="font-medium text-sm">Không có thông báo</p>
            <p className="text-xs">{unreadOnly ? "Bạn đã đọc hết rồi 🎉" : "Chưa có hoạt động mới"}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {groupedItems.map(({ group, items: groupItems }) => (
                <div key={group}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2 px-1">
                    {DATE_GROUP_LABELS[group]}
                  </p>
                  <div className="space-y-2">
                    {groupItems.map((item, idx) => {
                      const meta = getNotifMeta(item);
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.025 }}
                          className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                            item.read
                              ? "bg-white border-[#E2E8F0]"
                              : "bg-[#FFFBF0] border-[#FFCD00]/40 shadow-sm"
                          }`}
                        >
                          {/* Icon */}
                          <button
                            type="button"
                            onClick={() => void handleActivate(item)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 cursor-pointer ${
                              item.read ? "bg-[#F1F5F9]" : "bg-[#FFCD00]/15"
                            }`}
                          >
                            {meta.icon}
                          </button>

                          {/* Content */}
                          <button
                            type="button"
                            onClick={() => void handleActivate(item)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className={`text-sm leading-snug ${item.read ? "text-[#64748B]" : "text-[#0F172A] font-medium"}`}>
                              {notifSummary(item)}
                            </p>
                            <p className="text-[11px] text-[#94A3B8] mt-1">
                              {formatDistanceToNow(parseISO(item.createdAtUtc), { addSuffix: true, locale: dfVi })}
                            </p>
                          </button>

                          {/* Right side: action + read indicator */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {!item.read && <div className="w-2 h-2 rounded-full bg-[#FFCD00] mt-1" />}
                            {item.read && <Check size={14} className="text-[#CBD5E1] mt-1" />}
                            {meta.actionLabel && meta.actionHref && (
                              <button
                                type="button"
                                onClick={() => void handleActivate(item, meta.actionHref)}
                                className="text-[10px] font-semibold text-[#6366F1] hover:underline whitespace-nowrap"
                              >
                                {meta.actionLabel}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
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
