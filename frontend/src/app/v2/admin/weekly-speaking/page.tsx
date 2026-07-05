'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, Loader2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkModal } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Speaking Prompts (admin) — navy, CRUD.
// Contract: GET/POST/PUT/DELETE /api/admin/speaking/weekly-prompts[/{id}].
// Request = WeeklyPromptAdminUpsertRequest {weekStartDate, cefrBand, title,
//   promptDe, mandatoryPoints[], optionalPoints?[], active?}.
// List = raw JDBC rows (snake_case): id, week_start_date, cefr_band, title,
//   prompt_de, mandatory_points_json, optional_points_json, prompt_version, is_active.
// ─────────────────────────────────────────────────────────────────────────────

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const field =
  'ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none focus:border-ga-accent'

/** JDBC list row — column labels fold to lower-case snake_case. */
interface WeeklyPrompt {
  id: number
  week_start_date: string
  cefr_band: string
  title: string
  prompt_de: string
  mandatory_points_json?: string | null
  optional_points_json?: string | null
  prompt_version?: string
  is_active: boolean
}
interface FormState {
  weekStartDate: string
  cefrBand: string
  title: string
  promptDe: string
  mandatoryPoints: string
  optionalPoints: string
  active: boolean
}
const EMPTY: FormState = {
  weekStartDate: '',
  cefrBand: 'B1',
  title: '',
  promptDe: '',
  mandatoryPoints: '',
  optionalPoints: '',
  active: true,
}

/** weekly points persist as a JSON array string; parse defensively for the editor. */
function parsePoints(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}
const splitLines = (s: string): string[] => s.split('\n').map((l) => l.trim()).filter(Boolean)
const todayISO = (): string => new Date().toISOString().slice(0, 10)

export default function V2AdminWeeklySpeakingPage() {
  const t = useTranslations('v2.adminOps.weeklySpeaking')
  const tc = useTranslations('v2.common')
  const [prompts, setPrompts] = useState<WeeklyPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<WeeklyPrompt[]>('/admin/speaking/weekly-prompts')
      setPrompts(Array.isArray(res.data) ? res.data : [])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY, weekStartDate: todayISO() })
    setModal(true)
  }
  const openEdit = (p: WeeklyPrompt) => {
    setEditingId(p.id)
    setForm({
      weekStartDate: (p.week_start_date ?? '').slice(0, 10),
      cefrBand: p.cefr_band ?? 'B1',
      title: p.title ?? '',
      promptDe: p.prompt_de ?? '',
      mandatoryPoints: parsePoints(p.mandatory_points_json).join('\n'),
      optionalPoints: parsePoints(p.optional_points_json).join('\n'),
      active: p.is_active !== false,
    })
    setModal(true)
  }
  const submit = async () => {
    const mandatory = splitLines(form.mandatoryPoints)
    const optional = splitLines(form.optionalPoints)
    if (!form.weekStartDate) return toast.error(t('validation.weekStart'))
    if (!form.cefrBand.trim()) return toast.error(t('validation.cefrRequired'))
    if (!form.title.trim()) return toast.error(t('validation.titleRequired'))
    if (!form.promptDe.trim()) return toast.error(t('validation.promptRequired'))
    if (mandatory.length === 0) return toast.error(t('validation.mandatoryMin'))
    const body = {
      weekStartDate: form.weekStartDate,
      cefrBand: form.cefrBand.trim().toUpperCase(),
      title: form.title.trim(),
      promptDe: form.promptDe,
      mandatoryPoints: mandatory,
      optionalPoints: optional.length ? optional : null,
      active: form.active,
    }
    setSaving(true)
    try {
      if (editingId != null) await api.put(`/admin/speaking/weekly-prompts/${editingId}`, body)
      else await api.post('/admin/speaking/weekly-prompts', body)
      toast.success(editingId != null ? t('saved') : t('created'))
      setModal(false)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async (p: WeeklyPrompt) => {
    if (!window.confirm(t('confirmDeactivate', { title: p.title, week: (p.week_start_date ?? '').slice(0, 10) }))) return
    setDeleting(p.id)
    try {
      await api.delete(`/admin/speaking/weekly-prompts/${p.id}`)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" size="sm" onClick={openCreate}>
            <Plus size={15} /> {t('createNew')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <GaCap className="mb-3.5 block">{t('count', { count: prompts.length })}</GaCap>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/speaking/weekly-prompts</code>
            </p>
            <GaBtn variant="primary" onClick={load}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : prompts.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {t('empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {prompts.map((p) => {
              const mandatory = parsePoints(p.mandatory_points_json)
              const optional = parsePoints(p.optional_points_json)
              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3.5 border border-ga-line bg-ga-card px-[18px] py-4"
                  style={{ opacity: p.is_active ? 1 : 0.6 }}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center font-ga-display text-[13px] font-bold text-ga-bg"
                    style={{ background: 'var(--ga-ink)' }}
                  >
                    {p.cefr_band}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-ga-ink">{p.title}</span>
                      {!p.is_active && (
                        <span
                          className="px-2 py-0.5 text-[10.5px] font-bold"
                          style={{ color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}
                        >
                          {t('inactive')}
                        </span>
                      )}
                    </div>
                    <div className="ga-ui mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-ga-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} className="text-ga-subtle" /> {(p.week_start_date ?? '').slice(0, 10)}
                      </span>
                      <span>{t('mandatoryCount', { count: mandatory.length })}</span>
                      {optional.length > 0 && <span>{t('optionalCount', { count: optional.length })}</span>}
                      {p.prompt_version && <span className="text-ga-subtle">{p.prompt_version}</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] italic text-ga-subtle">{p.prompt_de}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
                    >
                      <Pencil size={12} /> {t('edit')}
                    </button>
                    <button
                      type="button"
                      disabled={deleting === p.id}
                      onClick={() => remove(p)}
                      className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-red transition-colors hover:border-ga-red disabled:opacity-50"
                    >
                      {deleting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t('deactivate')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TkModal
        open={modal}
        onOpenChange={setModal}
        title={editingId == null ? t('modalTitleCreate') : t('modalTitleEdit')}
        size="md"
        footer={
          <>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(false)}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>
              {editingId == null ? t('submitCreate') : t('submitSave')}
            </GaBtn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <GaCap className="mb-2 block">{t('weekStartLabel')}</GaCap>
              <input
                type="date"
                className={field}
                value={form.weekStartDate}
                onChange={(e) => set('weekStartDate', e.target.value)}
              />
            </div>
            <div>
              <GaCap className="mb-2 block">{t('cefrLabel')}</GaCap>
              <select className={field} value={form.cefrBand} onChange={(e) => set('cefrBand', e.target.value)}>
                {CEFR.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <GaCap className="mb-2 block">{t('titleLabel')}</GaCap>
            <input
              className={field}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </div>
          <div>
            <GaCap className="mb-2 block">{t('promptLabel')}</GaCap>
            <textarea
              className={`${field} resize-none`}
              rows={4}
              value={form.promptDe}
              onChange={(e) => set('promptDe', e.target.value)}
              placeholder={t('promptPlaceholder')}
            />
          </div>
          <div>
            <GaCap className="mb-2 block">{t('mandatoryLabel')}</GaCap>
            <textarea
              className={`${field} resize-none`}
              rows={4}
              value={form.mandatoryPoints}
              onChange={(e) => set('mandatoryPoints', e.target.value)}
              placeholder={t('mandatoryPlaceholder')}
            />
          </div>
          <div>
            <GaCap className="mb-2 block">{t('optionalLabel')}</GaCap>
            <textarea
              className={`${field} resize-none`}
              rows={2}
              value={form.optionalPoints}
              onChange={(e) => set('optionalPoints', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              style={{ accentColor: 'var(--ga-accent)' }}
            />
            <span className="text-[13.5px] font-semibold text-ga-ink">{t('activeLabel')}</span>
          </label>
        </div>
      </TkModal>
    </div>
  )
}
