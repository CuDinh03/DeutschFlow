'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, ArrowRight, Dumbbell, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, GaCard, GaCap, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse GET /grammar/topics + /grammar/topics/{id}/exercises. Tolerant shapes. Topic browser
// + per-topic exercise preview; the full practice runner now lives in v2 at
// /v2/student/grammar/practice (grammar-syllabus flow, ported from the legacy /student/grammar).
//
// CTA "Luyện tập" nằm ở HEADER (không chỉ trong thẻ chủ đề đã mở): danh mục này đọc
// GET /grammar/topics — endpoint backend hiện KHÔNG có (chỉ có /grammar/syllabus/topics), nên
// trang thường rơi vào loadError/empty và lối vào runner bên trong thẻ chủ đề không bao giờ hiện.
// Runner tự liệt kê chủ đề từ syllabus nên vào thẳng vẫn chạy được — CTA header giữ nó luôn tới được.
const PRACTICE_HREF = '/v2/student/grammar/practice'
const AI_HREF = '/v2/student/grammar/ai'

interface Topic {
  id: number
  title: string
  description: string
  level: string | null
}
interface Exercise {
  id: number
  prompt: string
}

function pick(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

const LEVEL_COLOR: Record<string, string> = { A1: '#1E9E61', A2: '#2F6FC9', B1: '#7C56C8', B2: '#E07B39' }

export default function V2StudentGrammarPage() {
  const t = useTranslations('v2.student.grammar')
  const [topics, setTopics] = useState<Topic[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exLoading, setExLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .get('/grammar/topics')
      .then((res) => {
        const raw = (Array.isArray(res.data) ? res.data : (res.data?.content ?? [])) as Record<string, unknown>[]
        setTopics(
          raw.map((r, i) => ({
            id: Number(r.id ?? i),
            title: pick(r, 'title', 'nameVi', 'name', 'topic'),
            description: pick(r, 'descriptionVi', 'description', 'summary'),
            level: pick(r, 'level', 'cefrLevel', 'cefr') || null,
          })),
        )
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggle = async (t: Topic) => {
    if (openId === t.id) {
      setOpenId(null)
      return
    }
    setOpenId(t.id)
    setExercises([])
    setExLoading(true)
    try {
      const res = await api.get(`/grammar/topics/${t.id}/exercises`)
      const raw = (Array.isArray(res.data) ? res.data : (res.data?.content ?? [])) as Record<string, unknown>[]
      setExercises(raw.map((r, i) => ({ id: Number(r.id ?? i), prompt: pick(r, 'prompt', 'question', 'questionText', 'sentence', 'text') })))
    } catch {
      setExercises([])
    } finally {
      setExLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <>
            {/* Công cụ ngữ pháp AI (POST /grammar/ai/correct · explain · analyze + văn hoá Đức) —
                port từ /student/grammar-practice. Backend RIÊNG với /grammar/syllabus/* mà catalog
                + runner đang dùng, nên đây là đường vào duy nhất của phần AI trong /v2. */}
            <a
              href={AI_HREF}
              className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
            >
              <Sparkles size={14} aria-hidden /> {t('aiCta')}
            </a>
            <a
              href={PRACTICE_HREF}
              className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-accent px-4 py-2.5 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
            >
              <Dumbbell size={14} aria-hidden /> {t('practiceCta')}
            </a>
          </>
        }
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : topics.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {topics.map((topic) => {
              const open = openId === topic.id
              const color = topic.level ? LEVEL_COLOR[topic.level.toUpperCase()] ?? 'var(--ga-accent)' : 'var(--ga-accent)'
              return (
                <GaCard key={topic.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(topic)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ga-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-ga-ink">{topic.title || t('topicFallback', { id: topic.id })}</p>
                        {topic.level && (
                          <span
                            className="ga-ui shrink-0 rounded-ga px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {topic.level}
                          </span>
                        )}
                      </div>
                      {topic.description && <p className="ga-ui mt-0.5 line-clamp-2 text-[13px] text-ga-muted">{topic.description}</p>}
                    </div>
                    <ChevronRight size={18} className={`shrink-0 text-ga-subtle transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                  </button>

                  {open && (
                    <div className="border-t border-ga-border bg-ga-surface px-5 py-4">
                      {exLoading ? (
                        <LoadingState label={t('exLoading')} />
                      ) : exercises.length > 0 ? (
                        <>
                          <GaCap className="mb-2.5 block">{t('exCount', { count: exercises.length })}</GaCap>
                          <ul className="space-y-2">
                            {exercises.slice(0, 5).map((ex, i) => (
                              <li key={ex.id} className="ga-ui flex gap-2 text-[13.5px] text-ga-ink">
                                <span className="text-ga-subtle">{i + 1}.</span>
                                <span className="line-clamp-2">{ex.prompt || t('exFallback')}</span>
                              </li>
                            ))}
                          </ul>
                          {/* The practice runner (v2) lists the syllabus topics itself — the catalog's
                              topic ids come from a different endpoint, so we only carry the LEVEL. */}
                          <a
                            href={`/v2/student/grammar/practice${topic.level ? `?cefr=${encodeURIComponent(topic.level)}` : ''}`}
                            className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent"
                          >
                            {t('practiceThisTopic')} <ArrowRight size={14} aria-hidden />
                          </a>
                        </>
                      ) : (
                        <p className="ga-ui py-2 text-center text-[13px] text-ga-muted">{t('noExercises')}</p>
                      )}
                    </div>
                  )}
                </GaCard>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
