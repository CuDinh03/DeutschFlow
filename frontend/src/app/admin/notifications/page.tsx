"use client";

import { useState } from "react";
import { Bell, Send, Users, User, Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AudienceType = "ALL" | "TIER" | "ROLE" | "SINGLE_USER";
type Tier = "FREE" | "PRO" | "PREMIUM";
type Role = "STUDENT" | "TEACHER";
type ScheduleType = "NOW" | "SCHEDULED";

type NotifTemplate = {
  type: string;
  label: string;
  defaultTitle: string;
  defaultBody: string;
  icon: string;
};

const TEMPLATES: NotifTemplate[] = [
  { type: "ADMIN_BROADCAST",  label: "Thông báo hệ thống",  defaultTitle: "Thông báo từ DeutschFlow", defaultBody: "", icon: "📣" },
  { type: "REVIEW_DUE",       label: "Nhắc ôn tập SRS",     defaultTitle: "Đến giờ ôn tập rồi!",     defaultBody: "Bạn có thẻ cần ôn tập hôm nay.", icon: "📚" },
  { type: "STREAK_REMINDER",  label: "Nhắc streak",          defaultTitle: "Đừng quên học hôm nay!",  defaultBody: "Hãy duy trì chuỗi streak của bạn.", icon: "🔥" },
  { type: "ADMIN_BROADCAST",  label: "Tính năng mới",        defaultTitle: "DeutschFlow vừa cập nhật!", defaultBody: "", icon: "✨" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminNotificationsPage() {
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL");
  const [selectedTier, setSelectedTier] = useState<Tier>("FREE");
  const [selectedRole, setSelectedRole] = useState<Role>("STUDENT");
  const [targetEmail, setTargetEmail] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<NotifTemplate>(TEMPLATES[0]);
  const [title, setTitle] = useState(TEMPLATES[0].defaultTitle);
  const [body, setBody] = useState(TEMPLATES[0].defaultBody);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTemplateChange = (tpl: NotifTemplate) => {
    setSelectedTemplate(tpl);
    setTitle(tpl.defaultTitle);
    setBody(tpl.defaultBody);
  };

  const buildPayload = () => ({
    type: selectedTemplate.type,
    audienceType,
    ...(audienceType === "TIER" && { tier: selectedTier }),
    ...(audienceType === "ROLE" && { role: selectedRole }),
    ...(audienceType === "SINGLE_USER" && { targetEmail }),
    payload: { title, body },
    ...(scheduleType === "SCHEDULED" && scheduledAt && { scheduledAt }),
  });

  const handleSend = async () => {
    if (!title.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await api.post("/admin/notifications/broadcast", buildPayload());
      setResult({ ok: true, message: "Đã gửi thông báo thành công!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi thất bại. Vui lòng thử lại.";
      setResult({ ok: false, message: msg });
    } finally {
      setSending(false);
    }
  };

  const audienceLabel: Record<AudienceType, string> = {
    ALL:         "Tất cả người dùng",
    TIER:        "Theo gói học",
    ROLE:        "Theo vai trò",
    SINGLE_USER: "Một người dùng cụ thể",
  };

  return (
    <AdminShell
      title="Gửi thông báo"
      subtitle="Gửi thông báo tới người dùng theo nhóm hoặc cá nhân"
      activeNav="notifications"
    >
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

        {/* ── Header stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Tổng gửi tháng này", value: "—", icon: Send },
            { label: "Tỷ lệ đọc",          value: "—", icon: Bell },
            { label: "Người dùng active",   value: "—", icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F1F5F9] flex items-center justify-center">
                <Icon size={16} className="text-[#6366F1]" />
              </div>
              <div>
                <p className="text-xs text-[#64748B]">{label}</p>
                <p className="text-lg font-bold text-[#0F172A]">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Compose form ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
          <h2 className="font-bold text-[#0F172A] flex items-center gap-2">
            <Bell size={16} className="text-[#6366F1]" />
            Soạn thông báo
          </h2>

          {/* Template picker */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2 block">
              Loại thông báo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.type}
                  type="button"
                  onClick={() => handleTemplateChange(tpl)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    selectedTemplate.type === tpl.type
                      ? "bg-[#0F172A] text-white border-[#0F172A]"
                      : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#0F172A]/30"
                  }`}
                >
                  <span className="text-base">{tpl.icon}</span>
                  <span className="truncate">{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5 block">
              Tiêu đề
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề thông báo..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5 block">
              Nội dung
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nhập nội dung thông báo... (có thể để trống)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] resize-none"
            />
          </div>
        </div>

        {/* ── Audience ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
          <h2 className="font-bold text-[#0F172A] flex items-center gap-2">
            <Users size={16} className="text-[#6366F1]" />
            Đối tượng nhận
          </h2>

          <div className="grid grid-cols-2 gap-2">
            {(["ALL", "TIER", "ROLE", "SINGLE_USER"] as AudienceType[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudienceType(a)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                  audienceType === a
                    ? "bg-[#0F172A] text-white border-[#0F172A]"
                    : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#0F172A]/30"
                }`}
              >
                {a === "ALL"         && <Users size={14} />}
                {a === "TIER"        && <span className="text-sm">💳</span>}
                {a === "ROLE"        && <span className="text-sm">🎓</span>}
                {a === "SINGLE_USER" && <User size={14} />}
                <span>{audienceLabel[a]}</span>
              </button>
            ))}
          </div>

          {audienceType === "TIER" && (
            <div className="flex gap-2 mt-2">
              {(["FREE", "PRO", "PREMIUM"] as Tier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTier(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    selectedTier === t
                      ? "bg-[#6366F1] text-white border-[#6366F1]"
                      : "text-[#64748B] border-[#E2E8F0] hover:border-[#6366F1]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {audienceType === "ROLE" && (
            <div className="flex gap-2 mt-2">
              {(["STUDENT", "TEACHER"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    selectedRole === r
                      ? "bg-[#6366F1] text-white border-[#6366F1]"
                      : "text-[#64748B] border-[#E2E8F0] hover:border-[#6366F1]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {audienceType === "SINGLE_USER" && (
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="Email người dùng..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
            />
          )}
        </div>

        {/* ── Schedule ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
          <h2 className="font-bold text-[#0F172A] flex items-center gap-2">
            <span className="text-base">🕐</span>
            Thời gian gửi
          </h2>
          <div className="flex gap-2">
            {(["NOW", "SCHEDULED"] as ScheduleType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScheduleType(s)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  scheduleType === s
                    ? "bg-[#0F172A] text-white border-[#0F172A]"
                    : "text-[#64748B] border-[#E2E8F0] hover:border-[#0F172A]/30"
                }`}
              >
                {s === "NOW" ? "Gửi ngay" : "Lên lịch"}
              </button>
            ))}
          </div>
          {scheduleType === "SCHEDULED" && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
            />
          )}
        </div>

        {/* ── Preview + send ───────────────────────────────────────── */}
        <div className="bg-[#0F172A] rounded-2xl p-5 space-y-4">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Xem trước</p>
          <div className="bg-white/10 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFCD00]/20 flex items-center justify-center text-lg flex-shrink-0">
              {selectedTemplate.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{title || "(Chưa có tiêu đề)"}</p>
              {body && <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{body}</p>}
              <p className="text-[10px] text-white/40 mt-1">
                → {audienceLabel[audienceType]}
                {audienceType === "TIER" && ` · Gói ${selectedTier}`}
                {audienceType === "ROLE" && ` · ${selectedRole}`}
                {audienceType === "SINGLE_USER" && ` · ${targetEmail || "(email)"}`}
              </p>
            </div>
          </div>

          {result && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
              result.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
            }`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {result.message}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !title.trim() || (audienceType === "SINGLE_USER" && !targetEmail.trim())}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FFCD00] text-[#0F172A] font-bold text-sm transition-all hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {scheduleType === "NOW" ? "Gửi ngay" : "Lên lịch gửi"}
          </button>
        </div>

      </div>
    </AdminShell>
  );
}
