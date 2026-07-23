'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'

/**
 * /v2/student/curriculum — giáo trình Netzwerk Neu A1 (Galerie shell).
 *
 * Port của /student/curriculum: CÙNG endpoint (GET /curriculum/netzwerk-neu/a1), cùng cách
 * chuẩn hoá 3 dạng payload (chapters[].lessons · lessons[] phẳng · units[] — dạng backend thật
 * đang trả), cùng quy tắc gộp 3 unit = 1 "Kapitel", cùng event PostHog `feature_session`
 * (usePageTimeTracker('curriculum')). Chỉ đổi vỏ.
 *
 * KHÔNG trùng /v2/student/lessons: trang đó là thư viện VIDEO (mediaApi); đây là đề cương sách.
 */

interface CurriculumLesson {
  lessonNumber: number
  unitId?: string
  title: string
  titleVi?: string
  themes?: string[]
  vocabulary?: string[]
  grammarPoints?: string[]
  communicativeGoals?: string[]
  canDo?: string[] // Netzwerk Neu A1 JSON format
  vocabTopics?: string[] // Netzwerk Neu A1 JSON format
  skillTargets?: string[]
}

interface CurriculumChapter {
  chapter: number | string
  title: string
  titleVi?: string
  lessons?: CurriculumLesson[]
}

// Backend Netzwerk Neu A1 format
interface CurriculumUnit {
  unitId: string
  order: number
  title: string
  isReviewUnit?: boolean
  reviewOfUnits?: string[]
  canDo?: string[]
  skillTargets?: string[]
  grammarPoints?: string[]
  vocabTopics?: string[]
  checkpoints?: string[]
  sessions?: unknown[]
}

interface CurriculumData {
  bookTitle?: string
  level?: string
  chapters?: CurriculumChapter[]
  lessons?: CurriculumLesson[]
  units?: CurriculumUnit[]
  courseId?: string
  [key: string]: unknown
}

/** Số unit gộp thành một "Kapitel" khi payload ở dạng units[] — giữ nguyên hằng số của v1. */
const UNITS_PER_CHAPTER = 3

function LessonCard({
  lesson,
  expanded,
  onToggle,
}: {
  lesson: CurriculumLesson
  expanded: boolean
  onToggle: () => void
}) {
  const t = useTranslations('v2.student.curriculum')
  // canDo (Netzwerk) hoà vào communicativeGoals; vocabTopics hoà vào vocabulary — như v1.
  const goals = lesson.communicativeGoals ?? lesson.canDo ?? []
  const vocab = lesson.vocabulary ?? lesson.vocabTopics ?? []

  return (
    <div className="overflow-hidden rounded-ga border border-ga-line bg-ga-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ga-surface"
      >
        <span className="ga-ui grid h-8 w-8 shrink-0 place-items-center rounded-ga bg-ga-accent text-[12px] font-bold text-ga-accent-ink">
          {lesson.lessonNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ga-ink">
            {lesson.titleVi ?? lesson.title}
          </span>
          {lesson.titleVi && lesson.title !== lesson.titleVi && (
            <span className="ga-ui block truncate text-[12px] italic text-ga-subtle">{lesson.title}</span>
          )}
        </span>
        {expanded ? (
          <ChevronDown size={14} className="shrink-0 text-ga-subtle" aria-hidden />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-ga-subtle" aria-hidden />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-ga-border px-4 pb-4">
          {lesson.themes && lesson.themes.length > 0 && (
            <div className="pt-3">
              <GaCap className="mb-1.5 block">{t('themes')}</GaCap>
              <div className="flex flex-wrap gap-1.5">
                {lesson.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="ga-ui rounded-ga-pill bg-ga-yellow-soft px-2 py-0.5 text-[12px] text-ga-gold"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lesson.grammarPoints && lesson.grammarPoints.length > 0 && (
            <div className={lesson.themes?.length ? '' : 'pt-3'}>
              <GaCap className="mb-1.5 block">{t('grammar')}</GaCap>
              {/* Nội dung bài học là text node TRẦN trong flex (`{g}` dưới đây) → trở thành mục ẩn
                  danh có min-width:auto, tức min-content = từ dài nhất. Một từ ghép tiếng Đức dài sẽ
                  đẩy tràn khung ở 320px (bề rộng khả dụng chỉ ~232px). `overflow-wrap:anywhere`
                  (khác `break-words`) hạ cả min-content nên khối co được; từ lg trả lại `normal`. */}
              <ul className="space-y-1">
                {lesson.grammarPoints.map((g, i) => (
                  <li key={i} className="ga-ui flex gap-1.5 text-[12.5px] text-ga-muted [overflow-wrap:anywhere] lg:[overflow-wrap:normal]">
                    <span className="text-ga-accent" aria-hidden>
                      •
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vocab.length > 0 && (
            <div>
              <GaCap className="mb-1.5 block">{t('vocabulary', { count: vocab.length })}</GaCap>
              <div className="flex flex-wrap gap-1.5">
                {vocab.slice(0, 20).map((v, i) => (
                  <span
                    key={i}
                    className="rounded-ga border border-ga-line bg-ga-surface px-2 py-0.5 font-mono text-[12px] text-ga-muted [overflow-wrap:anywhere] lg:[overflow-wrap:normal]"
                  >
                    {v}
                  </span>
                ))}
                {vocab.length > 20 && (
                  <span className="ga-ui text-[12px] text-ga-subtle">
                    {t('moreWords', { count: vocab.length - 20 })}
                  </span>
                )}
              </div>
            </div>
          )}

          {goals.length > 0 && (
            <div>
              <GaCap className="mb-1.5 block">{t('communicativeGoals')}</GaCap>
              {/* Cùng lý do như danh sách ngữ pháp phía trên: text node trần trong flex. */}
              <ul className="space-y-1">
                {goals.map((g, i) => (
                  <li key={i} className="ga-ui flex gap-1.5 text-[12.5px] text-ga-muted [overflow-wrap:anywhere] lg:[overflow-wrap:normal]">
                    <span className="text-ga-green" aria-hidden>
                      ✓
                    </span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function V2StudentCurriculumPage() {
  usePageTimeTracker('curriculum')
  const t = useTranslations('v2.student.curriculum')
  const { me, loading: meLoading } = useStudentPracticeSession()

  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set())
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!me) return
    setLoading(true)
    setError(null)
    api
      .get<CurriculumData>('/curriculum/netzwerk-neu/a1')
      .then(({ data }) => {
        setCurriculum(data)
        setLoading(false)
      })
      .catch(() => {
        setError(t('cannotLoad'))
        setLoading(false)
      })
  }, [me, t, reloadKey])

  const toggleLesson = (n: number) =>
    setExpandedLessons((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const toggleChapter = (id: string) =>
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Chuẩn hoá: hỗ trợ cả lessons[] phẳng, chapters[].lessons, VÀ units[] (dạng Netzwerk Neu A1
  // backend đang trả). Thứ tự ưu tiên giữ nguyên như v1.
  const chapters: Array<{ id: string; title: string; lessons: CurriculumLesson[] }> = (() => {
    if (!curriculum) return []
    if (curriculum.chapters?.length) {
      return curriculum.chapters.map((c) => ({
        id: String(c.chapter),
        title: c.titleVi ?? c.title,
        lessons: c.lessons ?? [],
      }))
    }
    if (curriculum.lessons?.length) {
      return [{ id: '1', title: t('content'), lessons: curriculum.lessons }]
    }
    if (curriculum.units?.length) {
      const units = curriculum.units
      const grouped: Array<{ id: string; title: string; lessons: CurriculumLesson[] }> = []
      for (let i = 0; i < units.length; i += UNITS_PER_CHAPTER) {
        const batch = units.slice(i, i + UNITS_PER_CHAPTER)
        const chapterNum = Math.floor(i / UNITS_PER_CHAPTER) + 1
        const lessons: CurriculumLesson[] = batch.map((u, j) => ({
          lessonNumber: i + j + 1,
          unitId: u.unitId,
          title: u.title,
          canDo: u.canDo,
          grammarPoints: u.grammarPoints,
          vocabTopics: u.vocabTopics,
          skillTargets: u.skillTargets,
        }))
        // Nhãn chương giữ nguyên tiếng Đức của v1 (Kapitel/Lektion là thuật ngữ giáo trình).
        grouped.push({
          id: String(chapterNum),
          title: `Kapitel ${chapterNum} (Lektion ${i + 1}–${i + batch.length})`,
          lessons,
        })
      }
      return grouped
    }
    return []
  })()

  const totalLessons = chapters.reduce((sum, c) => sum + c.lessons.length, 0)

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const bookTitle =
    curriculum?.bookTitle ??
    String(curriculum?.courseId ?? 'Netzwerk Neu A1')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl space-y-4">
          {curriculum && !error && (
            <GaCard className="flex items-center gap-3 p-4 lg:p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
                <BookOpen size={22} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-ga-display text-[20px] font-medium text-ga-ink">{bookTitle}</span>
                <span className="ga-ui block text-[13px] text-ga-muted">
                  {curriculum.level ?? 'CEFR A1'} · {t('lessonCount', { count: totalLessons })}
                </span>
              </span>
            </GaCard>
          )}

          {error && !loading && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

          {loading && <LoadingState label={t('loading')} />}

          {!loading && !error && chapters.length > 0 && (
            <div className="space-y-3">
              {chapters.map((chapter) => {
                const open = expandedChapters.has(chapter.id)
                return (
                  <GaCard key={chapter.id} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ga-surface"
                    >
                      <span className="ga-ui grid h-8 w-8 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-[12px] font-bold text-ga-accent">
                        C{chapter.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ga-ink">{chapter.title}</span>
                        <span className="ga-ui block text-[12.5px] text-ga-muted">
                          {t('chapterLessonCount', { count: chapter.lessons.length })}
                        </span>
                      </span>
                      {open ? (
                        <ChevronDown size={16} className="shrink-0 text-ga-subtle" aria-hidden />
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
                      )}
                    </button>

                    {open && (
                      <div className="space-y-2 border-t border-ga-border bg-ga-surface px-3 py-3">
                        {chapter.lessons.map((lesson) => (
                          <LessonCard
                            key={lesson.lessonNumber}
                            lesson={lesson}
                            expanded={expandedLessons.has(lesson.lessonNumber)}
                            onToggle={() => toggleLesson(lesson.lessonNumber)}
                          />
                        ))}
                      </div>
                    )}
                  </GaCard>
                )
              })}
            </div>
          )}

          {!loading && !error && chapters.length === 0 && (
            <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('noData')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
