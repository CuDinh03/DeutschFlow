"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronRight, Loader2, Play, Volume2 } from "lucide-react";
import { StudentShell } from "@/components/layouts/StudentShell";
import { useStudentPracticeSession } from "@/hooks/useStudentPracticeSession";
import { logout } from "@/lib/authSession";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurriculumLesson {
  lessonNumber: number;
  unitId?: string;
  title: string;
  titleVi?: string;
  themes?: string[];
  vocabulary?: string[];
  grammarPoints?: string[];
  communicativeGoals?: string[];
  canDo?: string[];         // Netzwerk Neu A1 JSON format
  vocabTopics?: string[];   // Netzwerk Neu A1 JSON format
  skillTargets?: string[];
}

interface CurriculumChapter {
  chapter: number | string;
  title: string;
  titleVi?: string;
  lessons?: CurriculumLesson[];
}

interface CurriculumData {
  bookTitle?: string;
  level?: string;
  chapters?: CurriculumChapter[];
  lessons?: CurriculumLesson[];
  units?: CurriculumUnit[];  // Netzwerk Neu A1 JSON format
  [key: string]: unknown;
}

// Backend Netzwerk Neu A1 format
interface CurriculumUnit {
  unitId: string;
  order: number;
  title: string;
  isReviewUnit?: boolean;
  reviewOfUnits?: string[];
  canDo?: string[];
  skillTargets?: string[];
  grammarPoints?: string[];
  vocabTopics?: string[];
  checkpoints?: string[];
  sessions?: unknown[];
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function LessonCard({ lesson, expanded, onToggle }: { lesson: CurriculumLesson; expanded: boolean; onToggle: () => void }) {
  // Merge canDo (Netzwerk format) into communicativeGoals for display
  const goals = lesson.communicativeGoals ?? lesson.canDo ?? [];
  // Merge vocabTopics into vocabulary display
  const vocab = lesson.vocabulary ?? lesson.vocabTopics ?? [];

  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-[#121212] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {lesson.lessonNumber}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[#0F172A] truncate">{lesson.titleVi ?? lesson.title}</p>
          {lesson.titleVi && lesson.title !== lesson.titleVi && (
            <p className="text-xs text-[#94A3B8] italic truncate">{lesson.title}</p>
          )}
        </div>
        {expanded ? <ChevronDown size={14} className="text-[#94A3B8] flex-shrink-0" /> : <ChevronRight size={14} className="text-[#94A3B8] flex-shrink-0" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4 space-y-3 border-t border-[#E2E8F0]"
        >
          {lesson.themes && lesson.themes.length > 0 && (
            <div className="pt-3">
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Chủ đề</p>
              <div className="flex flex-wrap gap-1.5">
                {lesson.themes.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{t}</span>
                ))}
              </div>
            </div>
          )}
          {lesson.grammarPoints && lesson.grammarPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Ngữ pháp</p>
              <ul className="space-y-1">
                {lesson.grammarPoints.map((g, i) => (
                  <li key={i} className="text-xs text-[#475569] flex gap-1.5"><span className="text-[#121212]">•</span>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {vocab.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Từ vựng ({vocab.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {vocab.slice(0, 20).map((v, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] font-mono">{v}</span>
                ))}
                {vocab.length > 20 && (
                  <span className="text-xs text-[#94A3B8]">+{vocab.length - 20} từ nữa</span>
                )}
              </div>
            </div>
          )}
          {goals.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1.5">Mục tiêu giao tiếp</p>
              <ul className="space-y-1">
                {goals.map((g, i) => (
                  <li key={i} className="text-xs text-[#475569] flex gap-1.5"><span className="text-green-500">✓</span>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CurriculumPage() {
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession();
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    api.get<CurriculumData>("/curriculum/netzwerk-neu/a1")
      .then(({ data }) => { setCurriculum(data); setLoading(false); })
      .catch(() => { setError("Không thể tải nội dung giáo trình."); setLoading(false); });
  }, [me]);

  const toggleLesson = (n: number) => setExpandedLessons(prev => {
    const next = new Set(prev);
    next.has(n) ? next.delete(n) : next.add(n);
    return next;
  });

  const toggleChapter = (id: string) => setExpandedChapters(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Normalize: support both flat lessons[], chapters[].lessons, AND units[] (Netzwerk Neu A1 format)
  const chapters: Array<{ id: string; title: string; lessons: CurriculumLesson[] }> = (() => {
    if (!curriculum) return [];
    // Priority 1: chapters[].lessons
    if (curriculum.chapters?.length) {
      return curriculum.chapters.map(c => ({
        id: String(c.chapter),
        title: c.titleVi ?? c.title,
        lessons: c.lessons ?? [],
      }));
    }
    // Priority 2: flat lessons[]
    if (curriculum.lessons?.length) {
      return [{ id: "1", title: "Nội dung giáo trình", lessons: curriculum.lessons }];
    }
    // Priority 3: units[] — Netzwerk Neu A1 backend format
    if (curriculum.units?.length) {
      const units = curriculum.units as CurriculumUnit[];
      // Group into "chapters" by batches of 3 units (Lektion blocks)
      const chapterSize = 3;
      const grouped: Array<{ id: string; title: string; lessons: CurriculumLesson[] }> = [];
      for (let i = 0; i < units.length; i += chapterSize) {
        const batch = units.slice(i, i + chapterSize);
        const chapterNum = Math.floor(i / chapterSize) + 1;
        const lessons: CurriculumLesson[] = batch.map((u, j) => ({
          lessonNumber: i + j + 1,
          unitId: u.unitId,
          title: u.title,
          canDo: u.canDo,
          grammarPoints: u.grammarPoints,
          vocabTopics: u.vocabTopics,
          skillTargets: u.skillTargets,
        }));
        grouped.push({
          id: String(chapterNum),
          title: `Kapitel ${chapterNum} (Lektion ${i + 1}–${i + batch.length})`,
          lessons,
        });
      }
      return grouped;
    }
    return [];
  })();


  if (meLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F4F9]">
        <Loader2 size={28} className="animate-spin text-[#121212]" />
      </div>
    );
  }

  return (
    <StudentShell
      activeSection="curriculum"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { logout(); }}
      headerTitle="Giáo trình Netzwerk Neu A1"
      headerSubtitle="Chuẩn Goethe-Institut · Đức ngữ cơ bản"
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Header card */}
        {curriculum && (
          <div className="rounded-2xl p-4 border-2 border-[#121212]/20"
            style={{ background: "linear-gradient(135deg,#121212 0%,#0052A3 100%)" }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <BookOpen size={24} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white">
                  {(curriculum.bookTitle as string | undefined)
                    ?? String(curriculum.courseId ?? "Netzwerk Neu A1")
                        .replace(/-/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                <p className="text-white/70 text-xs">
                  {(curriculum.level as string | undefined) ?? "CEFR A1"} · {chapters.reduce((s, c) => s + c.lessons.length, 0)} bài học
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <Loader2 size={28} className="animate-spin text-[#121212]" />
            <p className="text-sm text-[#64748B]">Đang tải giáo trình...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16 text-red-500 bg-white rounded-3xl border-2 border-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Chapters + Lessons */}
        {!loading && !error && chapters.length > 0 && (
          <div className="space-y-3">
            {chapters.map(chapter => (
              <div key={chapter.id} className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#121212] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    C{chapter.id}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-[#0F172A]">{chapter.title}</p>
                    <p className="text-xs text-[#94A3B8]">{chapter.lessons.length} bài</p>
                  </div>
                  {expandedChapters.has(chapter.id) ? <ChevronDown size={14} className="text-[#94A3B8]" /> : <ChevronRight size={14} className="text-[#94A3B8]" />}
                </button>

                {expandedChapters.has(chapter.id) && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[#E2E8F0]">
                    <div className="pt-2 space-y-2">
                      {chapter.lessons.map(lesson => (
                        <LessonCard
                          key={lesson.lessonNumber}
                          lesson={lesson}
                          expanded={expandedLessons.has(lesson.lessonNumber)}
                          onToggle={() => toggleLesson(lesson.lessonNumber)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-[#E2E8F0]">
            <BookOpen size={40} className="text-[#94A3B8]" />
            <p className="text-sm text-[#64748B]">Chưa có dữ liệu giáo trình.</p>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
