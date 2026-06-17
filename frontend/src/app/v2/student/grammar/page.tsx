'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, GaCard, GaCap, TkBadge, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reuse GET /grammar/topics + /grammar/topics/{id}/exercises. Tolerant shapes. Topic browser
// + per-topic exercise preview; full practice runner = legacy /student/grammar (Option-1).

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
      .catch(() => setError('Không thể tải chủ đề ngữ pháp.'))
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
      <GaPageHdr accent title="Ngữ pháp" subtitle="Học theo chủ đề với bài tập tương tác" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải chủ đề…" />
        ) : topics.length === 0 ? (
          <div className="border border-ga-line bg-ga-card py-16 text-center">
            <p className="font-ga-display text-[20px] font-medium text-ga-ink">Chưa có chủ đề ngữ pháp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {topics.map((t) => {
              const open = openId === t.id
              const color = t.level ? LEVEL_COLOR[t.level.toUpperCase()] ?? 'var(--ga-accent)' : 'var(--ga-accent)'
              return (
                <GaCard key={t.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ga-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-ga-ink">{t.title || `Chủ đề ${t.id}`}</p>
                        {t.level && (
                          <span
                            className="ga-ui shrink-0 rounded-ga px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {t.level}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="ga-ui mt-0.5 line-clamp-2 text-[13px] text-ga-muted">{t.description}</p>}
                    </div>
                    <ChevronRight size={18} className={`shrink-0 text-ga-subtle transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                  </button>

                  {open && (
                    <div className="border-t border-ga-border bg-ga-surface px-5 py-4">
                      {exLoading ? (
                        <LoadingState label="Đang tải bài tập…" />
                      ) : exercises.length > 0 ? (
                        <>
                          <GaCap className="mb-2.5 block">{exercises.length} bài tập</GaCap>
                          <ul className="space-y-2">
                            {exercises.slice(0, 5).map((ex, i) => (
                              <li key={ex.id} className="ga-ui flex gap-2 text-[13.5px] text-ga-ink">
                                <span className="text-ga-subtle">{i + 1}.</span>
                                <span className="line-clamp-2">{ex.prompt || 'Bài tập'}</span>
                              </li>
                            ))}
                          </ul>
                          <a
                            href="/student/grammar"
                            className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent"
                          >
                            Luyện chủ đề này <ArrowRight size={14} aria-hidden />
                          </a>
                        </>
                      ) : (
                        <p className="ga-ui py-2 text-center text-[13px] text-ga-muted">Chủ đề này chưa có bài tập.</p>
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
