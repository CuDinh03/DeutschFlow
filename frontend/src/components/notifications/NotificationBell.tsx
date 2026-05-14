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

type NotifItem = {
  id: number;
  type: string;
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
    default:
      return item.type;
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
};

export function NotificationBell({ buttonClassName }: NotificationBellProps) {
  const t = useTranslations("notifications");
  const intlLocale = useLocale();
  const dfLocale = DF_LOCALES[intlLocale] ?? enUS;

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
    if (item.read) return;
    try {
      await api.post(`/notifications/${item.id}/read`);
      await fetchUnread();
      await fetchList();
    } catch {
      /* ignore */
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
            <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 px-0.5 bg-[#FFCD00] rounded-full border border-white" />
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
        <div className="max-h-80 overflow-y-auto">
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
      </PopoverContent>
    </Popover>
  );
}
