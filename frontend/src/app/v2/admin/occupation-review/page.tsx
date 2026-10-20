'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, XCircle, Loader2, Pencil, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Duyệt lớp câu hỏi theo nghề (admin) — đợt 2b định hướng A + B + E.
// GET /admin/occupations/review-queue?status=…; POST /admin/occupations/questions/{id}/review,
//   /admin/occupations/terms/{id}/review {status, …sửa lời, note}; POST /admin/occupations/{code}/generate.
// Thứ tự nghề do backend xếp: nghề được chọn nhiều trước, rồi Điều dưỡng / Xây dựng (quyết định 6).
// ─────────────────────────────────────────────────────────────────────────────

type Status = 'AI_GENERATED' | 'APPROVED' | 'REJECTED'
type Decision = 'APPROVED' | 'REJECTED'

interface QuestionItem { id: string; topicKey: string; questionDe: string; difficulty: string; status: Status; sourceModel?: string }
interface TermItem { id: number; termDe: string; meaningEn: string; meaningVi: string; exampleDe?: string | null; status: Status; sourceModel?: string }
interface ReviewOccupation {
  code: string
  nameDe: string
  nameVi: string
  workplace: string
  sessionCount: number
  questions: QuestionItem[]
  terms: TermItem[]
}
interface ReviewBody {
  status: Decision
  questionDe?: string
  termDe?: string
  meaningEn?: string
  meaningVi?: string
  exampleDe?: string
  note?: string
}

const STATUSES: Status[] = ['AI_GENERATED', 'APPROVED', 'REJECTED']

const STATUS_STYLE: Record<Status, { color: string; background: string }> = {
  AI_GENERATED: { color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' },
  APPROVED: { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' },
  REJECTED: { color: 'var(--ga-red)', background: 'var(--ga-side-active)' },
}

export default function V2AdminOccupationReviewPage() {
  const t = useTranslations('v2.adminContent.occupationReview')
  const tc = useTranslations('v2.common')
  const [status, setStatus] = useState<Status>('AI_GENERATED')
  const [items, setItems] = useState<ReviewOccupation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [genCode, setGenCode] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ReviewOccupation[]>('/admin/occupations/review-queue', { params: { status } })
      setItems(data ?? [])
      setError('')
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [status])
  useEffect(() => { void load() }, [load])

  // Sau khi duyệt: ở hàng "AI tạo" thì bỏ dòng khỏi danh sách; ở các hàng khác thì cập nhật nhãn tại chỗ.
  const applyResult = <T extends { status: Status }>(list: T[], match: (x: T) => boolean, updated: T): T[] =>
    status === 'AI_GENERATED' && updated.status !== 'AI_GENERATED'
      ? list.filter((x) => !match(x))
      : list.map((x) => (match(x) ? updated : x))

  const dropEmpty = (list: ReviewOccupation[]) => list.filter((o) => o.questions.length > 0 || o.terms.length > 0)

  const reviewQuestion = async (code: string, q: QuestionItem, decision: Decision, edited?: string) => {
    const key = `q:${q.id}`
    setBusyKey(key)
    try {
      const body: ReviewBody = { status: decision, note: notes[key] || undefined }
      if (edited !== undefined && edited.trim() !== q.questionDe) body.questionDe = edited.trim()
      const { data } = await api.post<QuestionItem>(`/admin/occupations/questions/${encodeURIComponent(q.id)}/review`, body)
      setItems((prev) => dropEmpty(prev.map((o) => (o.code !== code ? o
        : { ...o, questions: applyResult(o.questions, (x) => x.id === q.id, data) }))))
      setEditKey(null)
      toast.success(decision === 'APPROVED' ? t('approved') : t('rejected'))
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setBusyKey(null) }
  }

  const reviewTerm = async (code: string, term: TermItem, decision: Decision, edited?: Partial<TermItem>) => {
    const key = `t:${term.id}`
    setBusyKey(key)
    try {
      const body: ReviewBody = { status: decision, note: notes[key] || undefined }
      if (edited) {
        if (edited.termDe && edited.termDe.trim() !== term.termDe) body.termDe = edited.termDe.trim()
        if (edited.meaningVi && edited.meaningVi.trim() !== term.meaningVi) body.meaningVi = edited.meaningVi.trim()
        if (edited.meaningEn && edited.meaningEn.trim() !== term.meaningEn) body.meaningEn = edited.meaningEn.trim()
        if (edited.exampleDe && edited.exampleDe.trim() !== (term.exampleDe ?? '')) body.exampleDe = edited.exampleDe.trim()
      }
      const { data } = await api.post<TermItem>(`/admin/occupations/terms/${term.id}/review`, body)
      setItems((prev) => dropEmpty(prev.map((o) => (o.code !== code ? o
        : { ...o, terms: applyResult(o.terms, (x) => x.id === term.id, data) }))))
      setEditKey(null)
      toast.success(decision === 'APPROVED' ? t('approved') : t('rejected'))
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setBusyKey(null) }
  }

  const generate = async () => {
    const code = genCode.trim().toLowerCase()
    if (!code) return
    setGenerating(true)
    try {
      const { data } = await api.post<ReviewOccupation>(`/admin/occupations/${encodeURIComponent(code)}/generate`)
      toast.success(t('generated', { questions: data.questions.length, terms: data.terms.length }))
      setGenCode('')
      if (status === 'AI_GENERATED') void load()
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setGenerating(false) }
  }

  const startEdit = (key: string, fields: Record<string, string>) => {
    setEditKey(key)
    setDraft(fields)
  }

  const statusChip = (s: Status) => (
    <span className="px-1.5 py-0.5 text-ga-eyebrow font-bold" style={STATUS_STYLE[s]}>{t(`status.${s}`)}</span>
  )

  const actionBtn = (label: string, icon: ReactNode, color: string, onClick: () => void, disabled: boolean) => (
    <button type="button" disabled={disabled} onClick={onClick}
      className="ga-ui inline-flex items-center gap-1.5 border px-3 py-3 text-ga-caption font-bold transition-colors disabled:opacity-60 lg:py-1.5"
      style={{ color, borderColor: color }}>
      {icon} {label}
    </button>
  )

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle', { count: items.length })}
        right={<GaBtn variant="ghost" size="sm" onClick={load}>{t('refresh')}</GaBtn>}
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <p className="ga-ui mb-4 max-w-3xl text-ga-small text-ga-muted">{t('hint')}</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className="ga-ui border px-3 py-3 text-ga-caption font-bold transition-colors lg:py-1"
              style={status === s ? { color: 'var(--ga-bg)', background: 'var(--ga-accent)', borderColor: 'var(--ga-accent)' } : { color: 'var(--ga-muted)', borderColor: 'var(--ga-line)' }}>
              {t(`status.${s}`)}
            </button>
          ))}
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <input type="text" value={genCode} onChange={(e) => setGenCode(e.target.value)} placeholder={t('generatePlaceholder')}
              aria-label={t('generatePlaceholder')}
              className="ga-ui min-w-0 flex-1 border border-ga-line bg-ga-bg px-3 py-3 text-ga-small text-ga-ink outline-none focus:border-ga-accent sm:w-48 sm:flex-none lg:py-1.5" />
            <GaBtn variant="yellow" size="sm" loading={generating} onClick={generate}><Sparkles size={14} /> {t('generate')}</GaBtn>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-ga-h2 font-medium text-ga-red lg:text-ga-h1-m">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-ga-body text-ga-muted">{error} <code className="break-words font-mono text-ga-caption text-ga-accent">GET /api/admin/occupations/review-queue</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border border-dashed border-ga-line px-4 py-10 text-center text-ga-muted sm:px-6 lg:px-10 lg:py-[52px]">
            <CheckCircle2 size={36} className="opacity-30" />
            <p className="text-ga-body font-medium">{t('emptyQueue')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((o) => (
              <section key={o.code} className="border border-ga-line bg-ga-card">
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ga-line px-4 py-3">
                  <h2 className="text-ga-body-lg font-semibold text-ga-ink">{o.nameDe}</h2>
                  <span className="ga-ui text-ga-small text-ga-muted">{o.nameVi}</span>
                  <span className="px-1.5 py-0.5 text-ga-eyebrow font-bold uppercase text-ga-muted" style={{ background: 'var(--ga-side-active)' }}>{o.workplace}</span>
                  <code className="font-mono text-ga-caption text-ga-subtle">{o.code}</code>
                  <span className="ga-ui ml-auto text-ga-caption text-ga-muted">{t('sessions', { count: o.sessionCount })}</span>
                </header>

                {o.questions.length > 0 && (
                  <div className="px-4 py-3">
                    <h3 className="ga-ui mb-2 text-ga-eyebrow font-bold uppercase tracking-wide text-ga-subtle">{t('questions')}</h3>
                    <ul className="flex flex-col gap-2">
                      {o.questions.map((q) => {
                        const key = `q:${q.id}`
                        const busy = busyKey === key
                        const editing = editKey === key
                        return (
                          <li key={q.id} className="border border-ga-line p-3">
                            {editing ? (
                              <textarea value={draft.questionDe ?? ''} onChange={(e) => setDraft({ ...draft, questionDe: e.target.value })}
                                rows={2} maxLength={400} aria-label={t('questions')}
                                className="ga-ui w-full border border-ga-line bg-ga-bg px-3 py-2 text-ga-body text-ga-ink outline-none focus:border-ga-accent" />
                            ) : (
                              <p lang="de" className="text-ga-body text-ga-ink">{q.questionDe}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {statusChip(q.status)}
                              <span className="px-1.5 py-0.5 text-ga-eyebrow font-bold text-ga-muted" style={{ background: 'var(--ga-side-active)' }}>{t(`difficulty.${q.difficulty}`)}</span>
                              <span className="font-mono text-ga-caption text-ga-subtle">{q.topicKey}</span>
                              <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:ml-auto lg:w-auto">
                                <input type="text" value={notes[key] ?? ''} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
                                  placeholder={t('notePlaceholder')} aria-label={t('notePlaceholder')} maxLength={500}
                                  className="ga-ui min-w-0 flex-1 border border-ga-line bg-ga-bg px-3 py-3 text-ga-caption text-ga-ink outline-none focus:border-ga-accent lg:w-44 lg:flex-none lg:py-1.5" />
                                {editing ? (
                                  <>
                                    {actionBtn(t('saveApprove'), busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />, 'var(--ga-green)',
                                      () => reviewQuestion(o.code, q, 'APPROVED', draft.questionDe), busy || !(draft.questionDe ?? '').trim())}
                                    {actionBtn(t('cancel'), null, 'var(--ga-muted)', () => setEditKey(null), busy)}
                                  </>
                                ) : (
                                  <>
                                    {q.status !== 'APPROVED' && actionBtn(t('approve'), busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />, 'var(--ga-green)',
                                      () => reviewQuestion(o.code, q, 'APPROVED'), busy)}
                                    {actionBtn(t('edit'), <Pencil size={12} />, 'var(--ga-accent)', () => startEdit(key, { questionDe: q.questionDe }), busy)}
                                    {q.status !== 'REJECTED' && actionBtn(t('reject'), <XCircle size={12} />, 'var(--ga-red)',
                                      () => reviewQuestion(o.code, q, 'REJECTED'), busy)}
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {o.terms.length > 0 && (
                  <div className="border-t border-ga-line px-4 py-3">
                    <h3 className="ga-ui mb-2 text-ga-eyebrow font-bold uppercase tracking-wide text-ga-subtle">{t('terms')}</h3>
                    <ul className="flex flex-col gap-2">
                      {o.terms.map((term) => {
                        const key = `t:${term.id}`
                        const busy = busyKey === key
                        const editing = editKey === key
                        return (
                          <li key={term.id} className="border border-ga-line p-3">
                            {editing ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {(['termDe', 'meaningVi', 'meaningEn', 'exampleDe'] as const).map((f) => (
                                  <label key={f} className="ga-ui flex flex-col gap-1 text-ga-eyebrow text-ga-subtle">
                                    {t(`field.${f}`)}
                                    <input type="text" value={draft[f] ?? ''} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                                      maxLength={f === 'termDe' ? 120 : f === 'exampleDe' ? 300 : 200}
                                      className="border border-ga-line bg-ga-bg px-3 py-2 text-ga-small text-ga-ink outline-none focus:border-ga-accent" />
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <>
                                <p className="text-ga-body text-ga-ink"><span lang="de" className="font-semibold">{term.termDe}</span> <span className="text-ga-muted">— {term.meaningVi} · {term.meaningEn}</span></p>
                                {term.exampleDe && <p lang="de" className="ga-ui mt-1 text-ga-small italic text-ga-muted">{term.exampleDe}</p>}
                              </>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {statusChip(term.status)}
                              <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:ml-auto lg:w-auto">
                                <input type="text" value={notes[key] ?? ''} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })}
                                  placeholder={t('notePlaceholder')} aria-label={t('notePlaceholder')} maxLength={500}
                                  className="ga-ui min-w-0 flex-1 border border-ga-line bg-ga-bg px-3 py-3 text-ga-caption text-ga-ink outline-none focus:border-ga-accent lg:w-44 lg:flex-none lg:py-1.5" />
                                {editing ? (
                                  <>
                                    {actionBtn(t('saveApprove'), busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />, 'var(--ga-green)',
                                      () => reviewTerm(o.code, term, 'APPROVED', draft), busy || !(draft.termDe ?? '').trim())}
                                    {actionBtn(t('cancel'), null, 'var(--ga-muted)', () => setEditKey(null), busy)}
                                  </>
                                ) : (
                                  <>
                                    {term.status !== 'APPROVED' && actionBtn(t('approve'), busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />, 'var(--ga-green)',
                                      () => reviewTerm(o.code, term, 'APPROVED'), busy)}
                                    {actionBtn(t('edit'), <Pencil size={12} />, 'var(--ga-accent)', () => startEdit(key, {
                                      termDe: term.termDe, meaningVi: term.meaningVi, meaningEn: term.meaningEn, exampleDe: term.exampleDe ?? '',
                                    }), busy)}
                                    {term.status !== 'REJECTED' && actionBtn(t('reject'), <XCircle size={12} />, 'var(--ga-red)',
                                      () => reviewTerm(o.code, term, 'REJECTED'), busy)}
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
