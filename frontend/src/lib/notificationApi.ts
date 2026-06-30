import api from "@/lib/api";

export interface NotificationItem {
  id: number;
  type: string;
  /** Server-rendered display content (NotificationContentRenderer). Prefer these
   *  over per-type client switches; `payload` stays for structured deep-link data. */
  title?: string;
  body?: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAtUtc: string;
}

export interface NotificationPageResponse {
  items: NotificationItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export const notificationApi = {
  list: (page = 0, size = 20, unreadOnly?: boolean) =>
    api.get<NotificationPageResponse>("/notifications", {
      params: { page, size, ...(unreadOnly !== undefined && { unreadOnly }) },
    }),

  unreadCount: () =>
    api.get<{ unreadCount: number }>("/notifications/unread-count"),

  markRead: (id: number) =>
    api.post<{ markedCount: number }>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post<{ markedCount: number }>("/notifications/read-all"),
};
