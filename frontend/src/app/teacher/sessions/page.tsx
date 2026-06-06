"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, XCircle, TrendingUp, Users, Wallet } from "lucide-react";

interface Session {
  id: number;
  studentName: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  priceVnd: number;
  status: string;
  paymentStatus: string;
  payoutStatus: string;
  teacherRating: number | null;
}

interface Earnings {
  totalEarningsVnd: number;
  platformFeeVnd: number;
  netEarningsVnd: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Chờ xác nhận", color: "text-amber-600 bg-amber-50" },
  CONFIRMED: { label: "Đã xác nhận",  color: "text-blue-600 bg-blue-50" },
  COMPLETED: { label: "Hoàn thành",   color: "text-emerald-600 bg-emerald-50" },
  CANCELLED: { label: "Đã hủy",       color: "text-red-500 bg-red-50" },
};

export default function TeacherSessionsPage() {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const loadProfileId = useCallback(async () => {
    try {
      const me = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/me`, { credentials: "include" }).then(r => r.json());
      const profiles = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/teachers/public?size=100`, { credentials: "include" }).then(r => r.json());
      const mine = (profiles.content as { userId: number; id: number }[]).find(p => p.userId === me.userId);
      if (mine) setProfileId(mine.id);
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async (pid: number) => {
    try {
      const [sessRes, earRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teacher-sessions/teacher?profileId=${pid}`, { credentials: "include" }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teacher-sessions/earnings?profileId=${pid}`, { credentials: "include" }),
      ]);
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data.content ?? []);
      }
      if (earRes.ok) setEarnings(await earRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfileId(); }, [loadProfileId]);
  useEffect(() => { if (profileId) loadData(profileId); }, [profileId, loadData]);

  const updateStatus = async (sessionId: number, status: string) => {
    setUpdating(sessionId);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teacher-sessions/${sessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (profileId) loadData(profileId);
    } finally {
      setUpdating(null);
    }
  };

  const pending   = sessions.filter(s => s.status === "PENDING");
  const active    = sessions.filter(s => s.status === "CONFIRMED");
  const completed = sessions.filter(s => s.status === "COMPLETED");

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[#0F172A]">Quản lý phiên dạy</h1>

        {/* Earnings stats */}
        {earnings && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Wallet className="text-emerald-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Doanh thu</p>
                <p className="text-lg font-bold text-[#0F172A]">
                  {(earnings.totalEarningsVnd / 1000).toFixed(0)}k ₫
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <TrendingUp className="text-rose-500" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phí nền tảng (15%)</p>
                <p className="text-lg font-bold text-[#0F172A]">
                  {(earnings.platformFeeVnd / 1000).toFixed(0)}k ₫
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <Users className="text-indigo-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Thu nhập ròng</p>
                <p className="text-lg font-bold text-indigo-700">
                  {(earnings.netEarningsVnd / 1000).toFixed(0)}k ₫
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}

        {/* Pending sessions */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Chờ xác nhận ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  actions={
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(s.id, "CONFIRMED")}
                        disabled={updating === s.id}
                        className="rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Xác nhận
                      </button>
                      <button
                        onClick={() => updateStatus(s.id, "CANCELLED")}
                        disabled={updating === s.id}
                        className="rounded-lg border border-red-200 text-red-500 px-3 py-1.5 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <XCircle size={12} /> Từ chối
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Active sessions */}
        {active.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Đã xác nhận ({active.length})
            </h2>
            <div className="space-y-3">
              {active.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  actions={
                    <button
                      onClick={() => updateStatus(s.id, "COMPLETED")}
                      disabled={updating === s.id}
                      className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Đánh dấu hoàn thành
                    </button>
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed sessions */}
        {completed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Đã hoàn thành ({completed.length})
            </h2>
            <div className="space-y-3">
              {completed.map(s => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Chưa có phiên dạy nào</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session, actions }: { session: Session; actions?: React.ReactNode }) {
  const status = STATUS_LABELS[session.status] ?? { label: session.status, color: "text-gray-500 bg-gray-50" };
  const date = new Date(session.scheduledAt);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            {session.payoutStatus === "PROCESSED" && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50">
                Đã thanh toán
              </span>
            )}
          </div>
          <h3 className="font-semibold text-[#0F172A] truncate">{session.title}</h3>
          <p className="text-sm text-gray-500">Học viên: {session.studentName}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {date.toLocaleDateString("vi-VN")} {date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{session.durationMinutes} phút</span>
            <span className="font-semibold text-indigo-600">
              {session.priceVnd.toLocaleString("vi-VN")} ₫
            </span>
          </div>
          {session.teacherRating && (
            <div className="mt-1 text-xs text-amber-600">
              {"★".repeat(session.teacherRating)}{"☆".repeat(5 - session.teacherRating)} Đánh giá từ học viên
            </div>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
