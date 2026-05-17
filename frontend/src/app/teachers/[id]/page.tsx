import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpen, Mail, Star } from "lucide-react";

interface TeacherProfileDto {
  id: number;
  userId: number;
  name: string;
  email: string;
  headline: string;
  bio: string;
  qualifications: string;
  featured: boolean;
}

async function getTeacher(id: string): Promise<TeacherProfileDto | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v2/teachers/${id}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const teacher = await getTeacher(params.id);
  return {
    title: teacher
      ? `${teacher.name} — Chuyên gia DeutschFlow`
      : "Chuyên gia | DeutschFlow",
    description: teacher?.headline ?? "Khám phá hồ sơ chuyên gia DeutschFlow",
  };
}

export default async function TeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const teacher = await getTeacher(params.id);

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
          <p className="text-white/70 text-sm mb-5">
            Liên hệ trực tiếp để đặt lịch học 1-1 hoặc tham gia lớp học nhóm.
          </p>
          <a
            href={`mailto:${teacher.email}?subject=Đặt lịch học cùng ${encodeURIComponent(teacher.name)}`}
            className="inline-flex items-center gap-2 bg-white text-[#6366F1] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            <Mail size={16} /> Liên hệ qua Email
          </a>
        </section>
      </div>
    </div>
  );
}
