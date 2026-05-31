"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Clock, MessageSquare, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

interface TeacherProfile {
  id: number;
  name: string;
  headline: string;
  hourlyRateVnd: number;
  featured: boolean;
}

export default function BookSessionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const teacherId = params.get("teacherId");

  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    if (!teacherId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v2/teachers/${teacherId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setTeacher)
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [teacherId]);

  const priceVnd = teacher ? (teacher.hourlyRateVnd * duration) / 60 : 0;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !scheduledAt) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/teacher-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          teacherProfileId: teacher.id,
          title,
          notes,
          scheduledAt: new Date(scheduledAt).toISOString().slice(0, 19),
          durationMinutes: duration,
        }),
      });
      if (res.ok) setBooked(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-gray-700">Không tìm thấy giáo viên</p>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-indigo-600 hover:underline text-sm">
          <ArrowLeft size={14} /> Quay lại
        </button>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#F8FAFC] p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="text-emerald-500" size={36} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-1">Đặt lịch thành công!</h2>
          <p className="text-gray-500 text-sm">Giáo viên sẽ xác nhận lịch học của bạn sớm.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/student/sessions")}
            className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700"
          >
            Xem lịch của tôi
          </button>
          <button onClick={() => router.push("/teachers")} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Xem giáo viên khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Quay lại hồ sơ
        </button>

        {/* Teacher info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg shrink-0">
            {teacher.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-[#0F172A]">{teacher.name}</h3>
            <p className="text-sm text-gray-500">{teacher.headline}</p>
            <p className="text-sm font-semibold text-indigo-600 mt-1">
              {teacher.hourlyRateVnd.toLocaleString("vi-VN")} ₫/giờ
            </p>
          </div>
        </div>

        {/* Booking form */}
        <form onSubmit={handleBook} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-bold text-[#0F172A]">Đặt lịch học 1:1</h2>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare size={14} className="inline mr-1 mb-0.5" />
              Chủ đề buổi học
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Luyện nói B1, chuẩn bị phỏng vấn..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Scheduled at */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1 mb-0.5" />
              Ngày & giờ
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1 mb-0.5" />
              Thời lượng
            </label>
            <div className="flex gap-2">
              {[30, 60, 90, 120].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    duration === d
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-indigo-300"
                  }`}
                >
                  {d} phút
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Mô tả mục tiêu hoặc điểm cần luyện tập..."
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Price summary */}
          <div className="rounded-xl bg-indigo-50 p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Tổng thanh toán</span>
            <span className="text-lg font-bold text-indigo-700">{priceVnd.toLocaleString("vi-VN")} ₫</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? "Đang đặt lịch..." : "Xác nhận đặt lịch"}
          </button>
        </form>
      </div>
    </div>
  );
}
