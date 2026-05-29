"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Bell, CheckCheck, Check, RefreshCw, UserPlus, UserMinus, ClipboardList, FileText, Sparkles, GraduationCap, MessageSquareWarning, CheckCircle2, Send, X } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { vi as dfVi } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/layouts/TeacherShell";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";
import { notificationApi, NotificationItem } from "@/lib/notificationApi";
import { toast } from "sonner";

function notifMeta(item: NotificationItem) {
  const p = item.payload ?? {};
  switch (item.type) {
    case "CLASS_JOIN_REQUEST_CREATED":
      return { icon: UserPlus, accent: "bg-sky-100 text-sky-700", title: `Học sinh yêu cầu tham gia lớp ${String(p.className ?? "")}` };
    case "CLASS_STUDENT_ADDED":
      return { icon: UserPlus, accent: "bg-emerald-100 text-emerald-700", title: `Đã thêm học sinh ${String(p.studentName ?? "")} vào lớp ${String(p.className ?? "")}` };
    case "CLASS_STUDENT_REMOVED":
      return { icon: UserMinus, accent: "bg-rose-100 text-rose-700", title: `Đã xóa học sinh ${String(p.studentName ?? "")} khỏi lớp ${String(p.className ?? "")}` };
    case "QUIZ_SUBMISSION_RECEIVED":
      return { icon: ClipboardList, accent: "bg-violet-100 text-violet-700", title: `Có bài cần xem từ ${String(p.studentName ?? "học sinh")} · ${String(p.className ?? "")}` };
    case "NEW_CLASS_ASSIGNMENT":
      return { icon: FileText, accent: "bg-amber-100 text-amber-700", title: `Lớp ${String(p.className ?? "")} có bài tập mới: ${String(p.topic ?? "")}` };
    case "NEW_ASSIGNMENT":
      return { icon: Sparkles, accent: "bg-cyan-100 text-cyan-700", title: `Lớp ${String(p.classroomName ?? "")} có quiz mới: ${String(p.quizTitle ?? "")}` };
    case "ASSIGNMENT_GRADED":
      return { icon: CheckCircle2, accent: "bg-indigo-100 text-indigo-700", title: `Đã chấm bài cho ${String(p.studentName ?? "học sinh")}${p.score != null ? ` · Điểm ${String(p.score)}` : ""}` };
    case "JOIN_REQUEST_APPROVED":
      return { icon: GraduationCap, accent: "bg-emerald-100 text-emerald-700", title: `Học sinh đã được duyệt vào lớp ${String(p.className ?? "")}` };
    case "JOIN_REQUEST_REJECTED":
      return { icon: MessageSquareWarning, accent: "bg-amber-100 text-amber-700", title: `Học sinh bị từ chối vào lớp ${String(p.className ?? "")}` };
    case "ADDED_TO_CLASS":
      return { icon: UserPlus, accent: "bg-slate-100 text-slate-700", title: `Có học sinh được thêm vào lớp ${String(p.className ?? "")}` };
    case "TEACHER_ANNOUNCEMENT":
      return { icon: Sparkles, accent: "bg-purple-100 text-purple-700", title: String(p.message ?? p.title ?? "Thông báo lớp học") };
    case "ADMIN_BROADCAST":
      return { icon: Bell, accent: "bg-orange-100 text-orange-700", title: String(p.title ?? p.message ?? "Thông báo hệ thống") };
    default:
      return { icon: Bell, accent: "bg-slate-100 text-slate-700", title: item.type.replace(/_/g, " ") };
  }
}

// ─── Announcement modal ───────────────────────────────────────────────────────

type ClassOption = { id: string; name: string };

function AnnouncementModal({ classes, onClose }: { classes: ClassOption[]; onClose: () => void }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !classId) return;
    setSending(true);
    try {
      await api.post("/notifications/teacher/announce", { classId: Number(classId), message });
      toast.success("Đã gửi thông báo cho lớp!");
      onClose();
    } catch {
      toast.error("Gửi thất bại. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Send size={15} className="text-[#6366F1]" />
            Gửi thông báo cho lớp
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Lớp học</label>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Bạn chưa có lớp nào.</p>
            ) : (
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Nội dung</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập nội dung thông báo cho học sinh..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !message.trim() || !classId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-semibold transition-colors hover:bg-[#1E293B] disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Gửi thông báo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherNotificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ displayName?: string; email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [myClasses, setMyClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, classRes] = await Promise.all([
          api.get('/auth/me'),
          api.get<{ items: ClassOption[] }>('/teacher/classes').catch(() => ({ data: { items: [] } })),
        ]);
        if (meRes.data?.role === 'TEACHER' || meRes.data?.role === 'ADMIN') {
          setMe(meRes.data);
        }
        setMyClasses(classRes.data?.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchNotifications = useCallback(async (pg = 0) => {
    setLoadingList(true);
    try {
      const { data } = await notificationApi.list(pg, 20, undefined);
      setItems((prev) => (pg === 0 ? (data.items ?? []) : [...prev, ...(data.items ?? [])]));
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (me) void fetchNotifications(0);
  }, [me, fetchNotifications]);

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await notificationApi.markRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    } catch {
      /* ignore */
    }
  };

  const handleActivate = async (item: NotificationItem) => {
    await handleMarkRead(item);
    const p = item.payload ?? {};
    if (item.type === "CLASS_JOIN_REQUEST_CREATED" || item.type === "CLASS_STUDENT_ADDED" || item.type === "CLASS_STUDENT_REMOVED") {
      if (p.classId) router.push(`/teacher/classes/${p.classId}`);
    } else if (item.type === "QUIZ_SUBMISSION_RECEIVED") {
      if (p.classId && p.assignmentId) router.push(`/teacher/classes/${p.classId}/assignments/${p.assignmentId}`);
      else router.push(`/teacher/grading`);
    } else if (item.type === "NEW_CLASS_ASSIGNMENT") {
      if (p.classId) router.push(`/teacher/classes/${p.classId}`);
    } else if (item.type === "NEW_ASSIGNMENT") {
      router.push(`/teacher/quizzes`);
    } else if (item.type === "ASSIGNMENT_GRADED") {
      router.push(`/teacher/grading`);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#6366F1]" />
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <>
      {showAnnounce && (
        <AnnouncementModal classes={myClasses} onClose={() => setShowAnnounce(false)} />
      )}
    <TeacherShell
      activeMenu="notifications"
      userName={me.displayName ?? me.email ?? "Teacher"}
      onLogout={() => logout()}
      headerTitle="Thông báo của tôi"
      headerSubtitle="Cập nhật các thay đổi liên quan đến lớp học và bài tập"
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Bell size={16} />
            <span>Số thông báo chưa đọc</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{unreadCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAnnounce(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#6366F1] text-white text-sm font-semibold hover:bg-[#4F46E5] transition-colors"
            >
              <Send size={13} />
              Gửi thông báo
            </button>
            <button
              onClick={() => void fetchNotifications(0)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              title="Làm mới"
            >
              <RefreshCw size={16} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => void handleMarkAll()}
                disabled={markingAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p>Chưa có thông báo nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const meta = notifMeta(item)
              const Icon = meta.icon
              return (
              <button
                key={item.id}
                onClick={() => void handleActivate(item)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${item.read ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.accent}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.read ? "text-slate-600" : "text-slate-900 font-medium"}`}>{meta.title}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatDistanceToNow(parseISO(item.createdAtUtc), { addSuffix: true, locale: dfVi })}
                    </p>
                  </div>
                  {item.read ? <Check size={14} className="text-slate-300 mt-1" /> : <div className="w-2 h-2 rounded-full bg-amber-400 mt-2" />}
                </div>
              </button>
              )
            })}
          </div>
        )}

        {page < totalPages - 1 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void fetchNotifications(next);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Tải thêm
            </button>
          </div>
        )}
      </div>
    </TeacherShell>
    </>
  );
}
