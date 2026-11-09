"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpen, CalendarPlus, Loader2, Mail, Star, UserRound } from "lucide-react";
import { GaBtn } from "@/components/ui-v2/GaBtn";
import { GaGlyph } from "@/components/ui-v2/GaGlyph";

/**
 * Hồ sơ công khai của một giáo viên. Icon đợt B (09/11/2026): giao diện Galerie (token `ga-*`, `GaGlyph`,
 * `GaBtn`); khung trang + header/footer ở `page.tsx`. Cách tải dữ liệu, link và nút đặt lịch giữ nguyên.
 */
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
      <div role="status" className="flex min-h-[50vh] items-center justify-center text-ga-muted">
        <Loader2 size={28} className="ga-spin" aria-hidden />
        <span className="sr-only">Đang tải…</span>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-5 text-center">
        <GaGlyph icon={UserRound} tone="plain" size="lg" />
        <p className="font-ga-display text-ga-h1-m font-medium text-ga-ink">Không tìm thấy chuyên gia</p>
        <Link
          href="/teachers"
          className="inline-flex items-center gap-2 text-ga-small font-semibold text-ga-ink underline underline-offset-4"
        >
          <ArrowLeft size={14} aria-hidden /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8 md:pt-14">
      <Link
        href="/teachers"
        className="mb-8 inline-flex items-center gap-2 text-ga-small text-ga-muted underline-offset-4 hover:text-ga-ink hover:underline"
      >
        <ArrowLeft size={14} aria-hidden /> Đội ngũ chuyên gia
      </Link>

      <div className="flex items-start gap-5">
        <div
          aria-hidden
          className="flex h-20 w-20 shrink-0 items-center justify-center bg-ga-ink font-ga-display text-ga-display font-medium text-ga-bg"
        >
          {teacher.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h1 className="font-ga-display text-ga-h1-m font-medium text-ga-ink sm:text-ga-h1">{teacher.name}</h1>
            {teacher.featured && (
              <span className="inline-flex items-center gap-1 bg-ga-yellow px-2 py-0.5 text-ga-caption font-semibold text-ga-ink">
                <Star size={11} aria-hidden className="fill-current" /> Nổi bật
              </span>
            )}
          </div>
          <p className="text-ga-body-lg text-ga-muted">{teacher.headline}</p>
          <a
            href={`mailto:${teacher.email}`}
            className="mt-3 inline-flex items-center gap-2 break-all text-ga-small text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink"
          >
            <Mail size={14} aria-hidden className="shrink-0" /> {teacher.email}
          </a>
        </div>
      </div>

      <div className="mt-10 space-y-6">
        <section className="border border-ga-border bg-ga-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <GaGlyph icon={BookOpen} size="sm" />
            <h2 className="text-ga-h3 text-ga-ink">Giới thiệu</h2>
          </div>
          <p className="whitespace-pre-line text-ga-body text-ga-ink">
            {teacher.bio || "Chưa có thông tin giới thiệu."}
          </p>
        </section>

        {teacher.qualifications && (
          <section className="border border-ga-border bg-ga-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <GaGlyph icon={BadgeCheck} size="sm" />
              <h2 className="text-ga-h3 text-ga-ink">Bằng cấp & Chứng chỉ</h2>
            </div>
            <p className="whitespace-pre-line text-ga-body text-ga-ink">{teacher.qualifications}</p>
          </section>
        )}

        <section className="border border-ga-border bg-ga-card p-6 text-center">
          <h2 className="mb-2 font-ga-display text-ga-h2 font-medium text-ga-ink">Muốn học cùng {teacher.name}?</h2>
          <p className="mb-1 text-ga-small text-ga-muted">Đặt lịch học 1:1 trực tiếp trên DeutschFlow.</p>
          {teacher.hourlyRateVnd > 0 && (
            <p className="mb-5 text-ga-small font-semibold tabular-nums text-ga-ink">
              {teacher.hourlyRateVnd.toLocaleString("vi-VN")} ₫/giờ
            </p>
          )}
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <GaBtn
              type="button"
              variant="ink"
              size="lg"
              onClick={() => router.push(`/v2/student/tutor?teacherId=${teacher.id}`)}
            >
              <CalendarPlus size={16} aria-hidden /> Đặt lịch học
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg">
              <a href={`mailto:${teacher.email}?subject=Hỏi về lịch học cùng ${encodeURIComponent(teacher.name)}`}>
                <Mail size={16} aria-hidden /> Liên hệ Email
              </a>
            </GaBtn>
          </div>
        </section>
      </div>
    </main>
  );
}
