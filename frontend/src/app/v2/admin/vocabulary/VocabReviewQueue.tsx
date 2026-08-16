'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaBtn, GaCap, AdStatStrip } from '@/components/ui-v2'

// Wires the previously-orphaned admin review endpoints (A-3):
//   GET  /api/admin/vocabulary/review/queue?limit&cefrLevel&dtype  → { items, total }
//   GET  /api/admin/vocabulary/review/stats                        → { totals: { reviewed, pending, total } }
//   PATCH /api/admin/vocabulary/{id}/review  { reviewed, dtype, gender, notes }
// NB: the queue endpoint returns raw column names (snake_case), not camelCase.

const GREEN = '#1E9E61'
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const DTYPES = ['Noun', 'Verb', 'Adjective', 'Adverb'] as const
const GENDERS: { label: string; value: string }[] = [
  { label: 'der', value: 'DER' },
  { label: 'die', value: 'DIE' },
  { label: 'das', value: 'DAS' },
]
const QUEUE_LIMIT = 50

interface ReviewWord {
  id: number
  base_form: string | null
  dtype: string | null
  cefr_level: string | null
  phonetic: string | null
  gender: string | null
  admin_review_notes: string | null
  meaning_vi: string | null
  meaning_en: string | null
}
interface QueueResponse {
  items?: ReviewWord[]
  total?: number
}
interface StatsResponse {
  totals?: { reviewed?: number; pending?: number; total?: number }
}

export default function VocabReviewQueue() {
  const t = useTranslations('v2.adminContent.vocabulary')
  const tc = useTranslations('v2.common')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState('')
  const [items, setItems] = useState<ReviewWord[]>([])
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState<number | null>(null)
  const [reviewed, setReviewed] = useState<number | null>(null)
  const [totalWords, setTotalWords] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: QUEUE_LIMIT }
      if (cefr) params.cefrLevel = cefr
      if (dtype) params.dtype = dtype
      const [q, s] = await Promise.all([
        api.get<QueueResponse>('/admin/vocabulary/review/queue', { params }),
        api.get<StatsResponse>('/admin/vocabulary/review/stats'),
      ])
      setItems(q.data?.items ?? [])
      setTotal(q.data?.total ?? 0)
      setReviewed(s.data?.totals?.reviewed ?? null)
      setPending(s.data?.totals?.pending ?? null)
      setTotalWords(s.data?.totals?.total ?? null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [cefr, dtype])

  useEffect(() => {
    void load()
  }, [load])

  // Once reviewed, drop the word from the queue and nudge the counters (optimistic).
  const onReviewed = useCallback((id: number) => {
    setItems((prev) => prev.filter((w) => w.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    setPending((n) => (n === null ? n : Math.max(0, n - 1)))
    setReviewed((n) => (n === null ? n : n + 1))
  }, [])

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
      <AdStatStrip
        className="mb-6"
        cells={[
          { label: t('reviewStatTotal'), value: (totalWords ?? 0).toLocaleString('vi-VN'), color: GREEN },
          {
            label: t('reviewStatPending'),
            value: (pending ?? 0).toLocaleString('vi-VN'),
            color: '#C79A00',
            alert: (pending ?? 0) > 0,
          },
          { label: t('reviewStatReviewed'), value: (reviewed ?? 0).toLocaleString('vi-VN'), color: '#2F6FC9' },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <GaCap>{t('reviewFilterLevel')}</GaCap>
        <FilterChip active={cefr === ''} onClick={() => setCefr('')}>
          {t('reviewAll')}
        </FilterChip>
        {CEFR_LEVELS.map((l) => (
          <FilterChip key={l} active={cefr === l} onClick={() => setCefr(cefr === l ? '' : l)}>
            {l}
          </FilterChip>
        ))}
        <span className="mx-1 h-4 w-px bg-ga-line" aria-hidden />
        <GaCap>{t('reviewFilterType')}</GaCap>
        <FilterChip active={dtype === ''} onClick={() => setDtype('')}>
          {t('reviewAll')}
        </FilterChip>
        {DTYPES.map((d) => (
          <FilterChip key={d} active={dtype === d} onClick={() => setDtype(dtype === d ? '' : d)}>
            {d}
          </FilterChip>
        ))}
      </div>

      <GaCap className="mb-3.5 block">
        {t('reviewQueueCap', { shown: items.length, total: total.toLocaleString('vi-VN') })}
      </GaCap>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ga-shimmer h-[92px] border border-ga-line" aria-hidden />
          ))}
        </div>
      ) : error ? (
        <div className="border border-ga-line bg-ga-card px-4 py-10 text-center">
          <p className="ga-ui mx-auto max-w-md break-words text-[14px] text-ga-red">
            {error}{' '}
            <code className="break-words font-mono text-[12px] text-ga-accent">
              GET /api/admin/vocabulary/review/queue
            </code>
          </p>
          <div className="mt-4">
            <GaBtn variant="primary" onClick={() => void load()}>
              {tc('retry')}
            </GaBtn>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-ga-line px-4 py-10 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: GREEN }} aria-hidden />
          <p className="font-ga-display text-[18px] italic text-ga-ink">{t('reviewEmpty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((w) => (
            <ReviewRow key={w.id} word={w} onReviewed={onReviewed} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[34px] rounded-ga border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
        active ? 'text-white' : 'border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink'
      }`}
      style={active ? { background: GREEN, borderColor: GREEN } : undefined}
    >
      {children}
    </button>
  )
}

function ReviewRow({ word, onReviewed }: { word: ReviewWord; onReviewed: (id: number) => void }) {
  const t = useTranslations('v2.adminContent.vocabulary')
  const [dtype, setDtype] = useState(word.dtype ?? '')
  const [gender, setGender] = useState(word.gender ?? '')
  const [notes, setNotes] = useState(word.admin_review_notes ?? '')
  const [saving, setSaving] = useState(false)

  const isNoun = dtype === 'Noun'

  const markReviewed = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/vocabulary/${word.id}/review`, {
        reviewed: true,
        dtype: dtype || undefined,
        gender: isNoun ? gender || undefined : undefined,
        notes: notes || undefined,
      })
      toast.success(t('reviewSaved', { word: word.base_form ?? String(word.id) }))
      onReviewed(word.id)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-ga-line bg-ga-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ga-display text-[18px] font-semibold text-ga-ink">{word.base_form || '—'}</span>
            {word.cefr_level && (
              <span
                className="px-1.5 py-0.5 text-[10.5px] font-bold"
                style={{ background: 'var(--ga-navy-soft)', color: 'var(--ga-navy)' }}
              >
                {word.cefr_level}
              </span>
            )}
            {word.phonetic && <span className="text-[12px] text-ga-muted">/{word.phonetic}/</span>}
          </div>
          <p className="mt-1 break-words text-[13px] text-ga-muted">
            {word.meaning_vi || '—'}
            {word.meaning_en ? ` · ${word.meaning_en}` : ''}
          </p>
        </div>
        <GaBtn variant="primary" disabled={saving} onClick={markReviewed}>
          {saving ? t('reviewSaving') : t('reviewMarkDone')}
        </GaBtn>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-[12px]">
          <span className="mb-1 block text-ga-muted">{t('reviewDtype')}</span>
          <select
            value={dtype}
            onChange={(e) => setDtype(e.target.value)}
            className="min-h-[40px] w-full rounded-ga border border-ga-line bg-ga-bg px-2 py-2 text-[13px] text-ga-ink"
          >
            <option value="">—</option>
            {DTYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-ga-muted">{t('reviewGender')}</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            disabled={!isNoun}
            className="min-h-[40px] w-full rounded-ga border border-ga-line bg-ga-bg px-2 py-2 text-[13px] text-ga-ink disabled:opacity-50"
          >
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-ga-muted">{t('reviewNotes')}</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('reviewNotesPlaceholder')}
            className="min-h-[40px] w-full rounded-ga border border-ga-line bg-ga-bg px-2 py-2 text-[13px] text-ga-ink"
          />
        </label>
      </div>
    </div>
  )
}
