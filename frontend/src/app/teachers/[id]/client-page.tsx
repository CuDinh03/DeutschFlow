"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpen, CalendarPlus, Mail, Star } from "lucide-react";

interface TeacherProfileDto {
  id: number;
  userId: number;
  name: string;
  email: string;
  headline: string;
  bio: string;
  qualifications: string;
  featured: boolean;
  hourlyRateVnd: number;
}
export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/teachers/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTeacher(data))
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
        <p className="text-2xl font-bold text-[#0F172A]">Không tìm thấy chuyên gia</p>
        <Link
          href="/teachers"
          className="flex items-center gap-2 text-sm text-[#6366F1] hover:underline"
        >
          <ArrowLeft size={14} /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div
        className="w-full py-16 px-6"
        style={{ background: "linear-gradient(135deg, #1E293B 0%, #4F46E5 100%)" }}
      >
        <div className="max-w-3xl mx-auto">
          <Link
            href="/teachers"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> Đội ngũ chuyên gia
          </Link>
          <div className="flex items-start gap-6">
            <div
              className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl font-black text-white"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {teacher.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-white">{teacher.name}</h1>
                {teacher.featured && (
                  <span className="flex items-center gap-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-2 py-1 rounded-full">
                    <Star size={10} className="fill-current" /> Nổi bật
                  </span>
                )}
              </div>
              <p className="text-white/70 text-lg">{teacher.headline}</p>
              <a
                href={`mailto:${teacher.email}`}
                className="inline-flex items-center gap-2 mt-3 text-sm text-[#FFCD00] hover:underline"
              >
                <Mail size={14} /> {teacher.email}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-[#6366F1]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Giới thiệu</h2>
          </div>
          <p className="text-[#475569] leading-relaxed whitespace-pre-line">
            {teacher.bio || "Chưa có thông tin giới thiệu."}
          </p>
        </section>

        {teacher.qualifications && (
          <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck size={18} className="text-[#10B981]" />
              <h2 className="text-lg font-bold text-[#0F172A]">Bằng cấp & Chứng chỉ</h2>
            </div>
            <p className="text-[#475569] leading-relaxed whitespace-pre-line">
              {teacher.qualifications}
            </p>
          </section>
        )}

        <section className="bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-2xl p-6 text-white text-center">
          <h2 className="text-xl font-black mb-2">Muốn học cùng {teacher.name}?</h2>
          <p className="text-white/70 text-sm mb-1">
            Đặt lịch học 1:1 trực tiếp trên DeutschFlow.
          </p>
          {teacher.hourlyRateVnd > 0 && (
            <p className="text-white/90 font-semibold text-sm mb-5">
              {teacher.hourlyRateVnd.toLocaleString("vi-VN")} ₫/giờ
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push(`/student/book-session?teacherId=${teacher.id}`)}
              className="inline-flex items-center justify-center gap-2 bg-white text-[#6366F1] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
            >
              <CalendarPlus size={16} /> Đặt lịch học
            </button>
            <a
              href={`mailto:${teacher.email}?subject=Hỏi về lịch học cùng ${encodeURIComponent(teacher.name)}`}
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
            >
              <Mail size={16} /> Liên hệ Email
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
