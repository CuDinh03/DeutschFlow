"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { de as dfDe, enUS, vi as dfVi } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "date-fns";
import api from "@/lib/api";
import { subscribeNotificationUnread } from "@/lib/notificationStream";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NotifItem = {
  id: number;
  type: string;
  /** Server-rendered content (NotificationContentRenderer); used for types this
   *  client doesn't have a localized case for, instead of showing the raw enum. */
  title?: string;
  body?: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAtUtc: string;
};

const DF_LOCALES: Record<string, Locale> = { vi: dfVi, en: enUS, de: dfDe };

const POLL_MS = 90_000;

function summarizeNotification(t: (key: string, values?: Record<string, string>) => string, item: NotifItem): string {
  const p = item.payload ?? {};
  switch (item.type) {
    case "USER_REGISTERED":
      return t("typeUserRegistered", {
        name: String(p.displayName ?? ""),
        email: String(p.email ?? ""),
      });
    case "LEARNER_PLAN_UPDATED":
      return t("typeLearnerPlanUpdated", {
        plan: String(p.planCode ?? ""),
      });
    case "ADMIN_LEARNER_PLAN_CHANGED":
      return t("typeAdminLearnerPlanChanged", {
        email: String(p.learnerEmail ?? ""),
        plan: String(p.planCode ?? ""),
        actor: String(p.actingAdminEmail ?? ""),
      });
    case "ADMIN_LEARNER_SUBSCRIBED":
      return t("typeAdminLearnerSubscribed", {
        email: String(p.learnerEmail ?? ""),
        plan: String(p.planCode ?? ""),
      });
    case "ACHIEVEMENT_UNLOCKED":
      return `🏆 Bạn đã mở khóa huy hiệu "${String(p.achievementName ?? "")}"! +${String(p.xpReward ?? 0)} XP`;
    case "LEVEL_UP":
      return `⬆️ Chúc mừng! Bạn đã lên Level ${String(p.newLevel ?? "")}!`;
    case "REVIEW_DUE":
      return `📚 ${String(p.message ?? `Có ${String(p.dueCount ?? 0)} thẻ cần ôn tập hôm nay`)}`;
    case "STREAK_REMINDER":
      return `🔔 ${String(p.message ?? "Đừng quên học hôm nay!")}`;
    case "NEW_ASSIGNMENT":
      return t("typeNewAssignment", {
        teacher: String(p.teacherName ?? ""),
        quiz: String(p.quizTitle ?? ""),
        class: String(p.classroomName ?? ""),
      });
    case "JOIN_REQUEST_APPROVED":
      return t("typeJoinRequestApproved", {
        class: String(p.className ?? ""),
      });
    case "JOIN_REQUEST_REJECTED":
      return t("typeJoinRequestRejected", {
        class: String(p.className ?? ""),
      });
    case "ADDED_TO_CLASS":
      return t("typeAddedToClass", {
        class: String(p.className ?? ""),
        teacher: String(p.teacherName ?? ""),
      });
    case "ASSIGNMENT_GRADED": {
      const typeLabel = p.assignmentType === "SPEAKING" ? t("gradedTypeSpeaking") : t("gradedTypeAssignment");
      return t("typeAssignmentGraded", {
        type: typeLabel,
        score: String(p.score ?? "?"),
      });
    }
    case "NEW_CLASS_ASSIGNMENT":
      return t("typeNewClassAssignment", {
        class: String(p.className ?? ""),
        topic: String(p.topic ?? ""),
      });
    case "TEACHER_ANNOUNCEMENT":
      return `📢 ${String(p.message ?? p.title ?? "Thông báo từ giáo viên")}`;
    case "ADMIN_BROADCAST":
      return `📣 ${String(p.title ?? p.message ?? "Thông báo từ hệ thống")}`;
    default:
      // Unmapped type: use the server-rendered content instead of the raw enum.
      return item.body || item.title || "Bạn có thông báo mới";
  }
}

function formatTimeAgo(iso: string, dfLocale: Locale): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: dfLocale });
  } catch {
    return "";
  }
}

type NotificationBellProps = {
  /** Classes for the icon button (background, padding, rounded). */
  buttonClassName?: string;
  /** Optional link to the full inbox page for the current role. */
  inboxHref?: string;
};

export function NotificationBell({ buttonClassName, inboxHref }: NotificationBellProps) {
  const t = useTranslations("notifications");
  const intlLocale = useLocale();
  const dfLocale = DF_LOCALES[intlLocale] ?? enUS;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  /** Popover open state for SSE-triggered list refresh without resubscribing. */
  const openRef = useRef(false);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ unreadCount: number }>("/notifications/unread-count");
      setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoadErr(null);
    try {
      const { data } = await api.get<{ items: NotifItem[] }>("/notifications", {
        params: { size: 30, page: 0 },
      });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setLoadErr(t("loadError"));
    }
  }, [t]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    void fetchUnread();
    const id = window.setInterval(() => void fetchUnread(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    const bump = () => {
      if (document.visibilityState === "visible") void fetchUnread();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [fetchUnread]);

  useEffect(() => {
    const ac = subscribeNotificationUnread(
      (n) => {
        setUnread(n);
        if (openRef.current) void fetchList();
      },
      () => {},
    );
    return () => ac.abort();
  }, [fetchList]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void fetchList();
      void fetchUnread();
    }
  };

  const onRowActivate = async (item: NotifItem) => {
    try {
      if (!item.read) {
        await api.post(`/notifications/${item.id}/read`);
        await fetchUnread();
        await fetchList();
      }
    } catch {
      /* ignore */
    }

    if (item.type === "NEW_ASSIGNMENT") {
      setOpen(false);
      router.push(`/student/assignments`);
    } else if (
      (item.type === "JOIN_REQUEST_APPROVED" || item.type === "ADDED_TO_CLASS") &&
      item.payload?.classId
    ) {
      setOpen(false);
      router.push(`/student/classes`);
    } else if (item.type === "NEW_CLASS_ASSIGNMENT" && item.payload?.assignmentId) {
      setOpen(false);
      router.push(`/student/assignments`);
    } else if (item.type === "ASSIGNMENT_GRADED" && item.payload?.referenceId) {
      setOpen(false);
      if (item.payload.assignmentType === "SPEAKING") {
        router.push(`/speaking/history`);
      } else {
        router.push(`/student/assignments`);
      }
    }
  };

  const onMarkAll = async () => {
    try {
      await api.post("/notifications/read-all");
      await fetchUnread();
      await fetchList();
    } catch {
      /* ignore */
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("relative p-2.5 rounded-[12px] transition-colors", buttonClassName)}
          aria-label={t("title")}
        >
          <Bell size={18} className="text-[#64748B]" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-[#EF4444] text-white text-[10px] font-black rounded-full border-2 border-white leading-none tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] sm:w-96 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2E8F0] bg-[#FAFBFC]">
          <span className="text-sm font-semibold text-[#0F172A]">{t("title")}</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-[#121212] hover:underline"
              onClick={() => void onMarkAll()}
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loadErr && <p className="text-sm text-red-600 px-3 py-2">{loadErr}</p>}
          {!loadErr && items.length === 0 && (
            <p className="text-sm text-[#64748B] px-3 py-6 text-center">{t("empty")}</p>
          )}
          <ul className="divide-y divide-[#F1F5F9]">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors",
                    !item.read && "bg-[#FFFBF0]/80",
                  )}
                  onClick={() => void onRowActivate(item)}
                >
                  <p className="text-sm text-[#1e293b] leading-snug">{summarizeNotification(t, item)}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    {formatTimeAgo(item.createdAtUtc, dfLocale) || t("justNow")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* Footer — link to full inbox */}
        <div className="border-t border-[#E2E8F0] px-3 py-2">
          <Link
            href={inboxHref ?? "/student/notifications"}
            className="block text-center text-xs font-semibold text-[#6366F1] hover:underline py-1"
            onClick={() => setOpen(false)}
          >
            Xem tất cả thông báo →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
