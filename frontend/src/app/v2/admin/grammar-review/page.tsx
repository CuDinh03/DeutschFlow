'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Duyệt bài tập ngữ pháp (admin) — navy review queue (W1.7 migrate admin/grammar-review).
// Plumbing reused 1:1: GET /grammar/syllabus/admin/pending; POST .../exercises/{id}/approve,
//   .../exercises/{id}/reject {reason}, .../exercises/bulk-approve {ids}.
// ─────────────────────────────────────────────────────────────────────────────

interface PendingExercise {
  id: number
  exercise_type: string
  difficulty: number
  question_json: string
  status: string
  topic_id: number
  topic_title_vi?: string
  cefr_level?: string
  created_by_name?: string
}
interface ParsedQ { prompt?: string; options?: string[]; correct_answer?: string; explanation_vi?: string }

const LEVELS = ['ALL', 'A1', 'A2', 'B1', 'B2'] as const

export default function V2AdminGrammarReviewPage() {
  const t = useTranslations('v2.adminContent.grammarReview')
  const tc = useTranslations('v2.common')
  const [exercises, setExercises] = useState<PendingExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({})
  const [filterLevel, setFilterLevel] = useState<string>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<PendingExercise[]>('/grammar/syllabus/admin/pending')
      setExercises(data ?? [])
      setSelected(new Set())
      setError('')
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(
    () => (filterLevel === 'ALL' ? exercises : exercises.filter((e) => e.cefr_level === filterLevel)),
    [exercises, filterLevel],
  )

  const toggleSelect = (id: number) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const approve = async (id: number) => {
    setActionId(id)
    try {
      await api.post(`/grammar/syllabus/admin/exercises/${id}/approve`)
      setExercises((prev) => prev.filter((e) => e.id !== id))
      toast.success(t('approved'))
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setActionId(null) }
  }
  const reject = async (id: number) => {
    setActionId(id)
    try {
      await api.post(`/grammar/syllabus/admin/exercises/${id}/reject`, { reason: rejectReason[id] ?? '' })
      setExercises((prev) => prev.filter((e) => e.id !== id))
      toast.success(t('rejected'))
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setActionId(null) }
  }
  const bulkApprove = async () => {
    if (selected.size === 0) return
    setBulkWorking(true)
    try {
      await api.post('/grammar/syllabus/admin/exercises/bulk-approve', { ids: Array.from(selected) })
      setExercises((prev) => prev.filter((e) => !selected.has(e.id)))
      toast.success(t('bulkApproved', { count: selected.size }))
      setSelected(new Set())
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setBulkWorking(false) }
  }

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle', { count: exercises.length })}
        right={selected.size > 0
          ? <GaBtn variant="yellow" size="sm" loading={bulkWorking} onClick={bulkApprove}><CheckCheck size={15} /> {t('bulkApprove', { count: selected.size })}</GaBtn>
          : <GaBtn variant="ghost" size="sm" onClick={load}>{t('refresh')}</GaBtn>}
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {LEVELS.map((lv) => (
            <button key={lv} type="button" onClick={() => setFilterLevel(lv)}
              className="ga-ui border px-3 py-3 text-[11.5px] font-bold transition-colors lg:py-1"
              style={filterLevel === lv ? { color: 'var(--ga-bg)', background: 'var(--ga-accent)', borderColor: 'var(--ga-accent)' } : { color: 'var(--ga-muted)', borderColor: 'var(--ga-line)' }}>
              {lv === 'ALL' ? t('levelAll') : lv}
            </button>
          ))}
          {filtered.length > 0 && (
            <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)))}
              className="ga-ui ml-auto py-3 text-[12px] font-semibold text-ga-accent hover:underline lg:py-0">
              {allSelected ? t('deselectAll') : t('selectAll')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[72px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/grammar/syllabus/admin/pending</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border border-dashed border-ga-line px-4 py-10 text-center text-ga-muted sm:px-6 lg:px-10 lg:py-[52px]">
            <CheckCircle2 size={36} className="opacity-30" />
            <p className="text-[14px] font-medium">{t('emptyQueue')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((ex) => {
              let parsed: ParsedQ = {}
              try { parsed = JSON.parse(ex.question_json) as ParsedQ } catch { /* ignore */ }
              const open = expandedId === ex.id
              const isSel = selected.has(ex.id)
              return (
                <div key={ex.id} className="border bg-ga-card transition-colors" style={{ borderColor: isSel ? 'var(--ga-accent)' : 'var(--ga-line)' }}>
                  <div className="flex flex-wrap items-start gap-3 p-4 lg:flex-nowrap">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(ex.id)} className="mt-1 shrink-0" style={{ accentColor: 'var(--ga-accent)' }} aria-label={t('selectAria', { id: ex.id })} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ga-ink">{parsed.prompt ?? t('exerciseFallback')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {ex.cefr_level && <span className="px-1.5 py-0.5 text-[10px] font-bold" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>{ex.cefr_level}</span>}
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-ga-muted" style={{ background: 'var(--ga-side-active)' }}>{ex.exercise_type}</span>
                        {ex.topic_title_vi && <span className="min-w-0 truncate text-[11px] text-ga-subtle">{ex.topic_title_vi}</span>}
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-end gap-2 lg:w-auto">
                      <button type="button" disabled={actionId === ex.id} onClick={() => approve(ex.id)}
                        className="ga-ui inline-flex items-center gap-1.5 border px-3 py-3 text-[11.5px] font-bold transition-colors disabled:opacity-60 lg:py-1.5"
                        style={{ color: 'var(--ga-green)', borderColor: 'var(--ga-green)' }}>
                        {actionId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} {t('approve')}
                      </button>
                      <button type="button" onClick={() => setExpandedId(open ? null : ex.id)} className="flex h-10 w-10 items-center justify-center text-ga-muted transition-colors hover:text-ga-ink lg:h-auto lg:w-auto">
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-3 border-t border-ga-line px-4 pb-4 pt-3">
                      {parsed.options && (
                        <div className="flex flex-wrap gap-2">
                          {parsed.options.map((o, i) => (
                            <span key={i} className="px-2.5 py-1 text-[12px]" style={o === parsed.correct_answer
                              ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)', fontWeight: 700 }
                              : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>{o}</span>
                          ))}
                        </div>
                      )}
                      {parsed.explanation_vi && <p className="ga-ui text-[12.5px] italic text-ga-muted">{parsed.explanation_vi}</p>}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input type="text" placeholder={t('rejectPlaceholder')} value={rejectReason[ex.id] ?? ''}
                          onChange={(e) => setRejectReason((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                          className="ga-ui min-w-0 flex-1 border border-ga-line bg-ga-bg px-3 py-3 text-[12.5px] text-ga-ink outline-none focus:border-ga-red sm:py-2" />
                        <button type="button" disabled={actionId === ex.id} onClick={() => reject(ex.id)}
                          className="ga-ui inline-flex items-center justify-center gap-1.5 border px-3 py-3 text-[11.5px] font-bold transition-colors disabled:opacity-60 sm:py-2"
                          style={{ color: 'var(--ga-red)', borderColor: 'var(--ga-red)' }}>
                          {actionId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} {t('reject')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
