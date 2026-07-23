'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Eye, EyeOff, FileText, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listAdminMockPacks, createMockPack, updateMockPack, deactivateMockPack,
  type AdminMockPack,
} from '@/lib/adminMockPackApi'
import { GaPageHdr, GaBtn, GaCap, TkModal } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Bộ đề thi thử (admin) — navy, CRUD (W1.7 migrate admin/mock-exam-packs).
// adminMockPackApi: listAdminMockPacks / createMockPack / updateMockPack / deactivateMockPack.
//   AdminMockPack { id, title, descriptionVi, cefrLevel, examFormat, requiresPaid, sortOrder, active, examCount }.
// ─────────────────────────────────────────────────────────────────────────────

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
const field = 'ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none focus:border-ga-accent'
const GRID = '46px 1fr 140px 64px 96px 96px 132px'

interface FormState { title: string; descriptionVi: string; cefrLevel: string; examFormat: string; requiresPaid: boolean; sortOrder: number }
const EMPTY: FormState = { title: '', descriptionVi: '', cefrLevel: 'B1', examFormat: 'GOETHE', requiresPaid: true, sortOrder: 0 }

export default function V2AdminMockPacksPage() {
  const t = useTranslations('v2.adminContent.mockPacks')
  const tc = useTranslations('v2.common')
  const [packs, setPacks] = useState<AdminMockPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setPacks(await listAdminMockPacks()); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModal(true) }
  const openEdit = (p: AdminMockPack) => {
    setEditingId(p.id)
    setForm({ title: p.title, descriptionVi: p.descriptionVi ?? '', cefrLevel: p.cefrLevel, examFormat: p.examFormat, requiresPaid: p.requiresPaid, sortOrder: p.sortOrder })
    setModal(true)
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) { toast.error(t('titleRequired')); return }
    setSaving(true)
    const body = {
      title: form.title.trim(),
      descriptionVi: form.descriptionVi.trim() || null,
      cefrLevel: form.cefrLevel,
      examFormat: form.examFormat.trim() || 'GOETHE',
      requiresPaid: form.requiresPaid,
      sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
    }
    try {
      if (editingId == null) await createMockPack(body)
      else await updateMockPack(editingId, body)
      toast.success(editingId == null ? t('created') : t('saved'))
      setModal(false)
      await load()
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setSaving(false) }
  }

  const toggle = async (p: AdminMockPack) => {
    setBusyId(p.id)
    try {
      if (p.active) await deactivateMockPack(p.id)
      else await updateMockPack(p.id, { active: true })
      await load()
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setBusyId(null) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={<GaBtn variant="yellow" size="sm" onClick={openCreate}><Plus size={15} /> {t('createPack')}</GaBtn>}
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <GaCap className="mb-3.5 block">{t('hint')}</GaCap>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/admin/mock-exam-packs</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : packs.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10">{t('empty')}</div>
        ) : (
          <div className="overflow-x-auto">
          <div className="min-w-[760px] border border-ga-line bg-ga-card">
            <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: GRID }}>
              {[t('colNum'), t('colPack'), t('colLevelFormat'), t('colExams'), t('colAccess'), t('colStatus'), t('colActions')].map((h, i) => (
                <span key={i} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i === 3 ? 'text-center' : ''} ${i === 6 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            {packs.map((p, i) => (
              <div key={p.id} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: GRID, borderTop: i ? '1px solid var(--ga-line)' : 'none', opacity: p.active ? 1 : 0.6 }}>
                <span className="text-[12px] text-ga-muted">{p.sortOrder}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-ga-ink">{p.title}</span>
                  {p.descriptionVi && <span className="block truncate text-[11.5px] text-ga-muted">{p.descriptionVi}</span>}
                </span>
                <span><span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>{p.cefrLevel} · {p.examFormat}</span></span>
                <span className={`inline-flex items-center justify-center gap-1 text-[13px] font-semibold ${p.examCount === 0 ? 'text-ga-red' : 'text-ga-ink'}`}><FileText size={12} /> {p.examCount}</span>
                <span>
                  {p.requiresPaid
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-orange)', background: 'var(--ga-orange-soft)' }}><Lock size={10} /> {t('paid')}</span>
                    : <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>{t('free')}</span>}
                </span>
                <span>
                  {p.active
                    ? <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>{t('shown')}</span>
                    : <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>{t('hidden')}</span>}
                </span>
                <span className="flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => openEdit(p)} className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"><Pencil size={12} /> {t('edit')}</button>
                  <button type="button" disabled={busyId === p.id} onClick={() => toggle(p)} className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-50">
                    {p.active ? <><EyeOff size={12} /> {t('hide')}</> : <><Eye size={12} /> {t('show')}</>}
                  </button>
                </span>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      <TkModal
        open={modal}
        onOpenChange={setModal}
        title={editingId == null ? t('createModalTitle') : t('editModalTitle')}
        size="sm"
        footer={
          <>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(false)}>{tc('cancel')}</GaBtn>
            <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>{editingId == null ? t('createPack') : t('saveChanges')}</GaBtn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <GaCap className="mb-2 block">{t('fieldTitle')}</GaCap>
            <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder={t('titlePlaceholder')} />
          </div>
          <div>
            <GaCap className="mb-2 block">{t('fieldDescription')}</GaCap>
            <textarea className={`${field} resize-none`} rows={2} value={form.descriptionVi} onChange={(e) => set('descriptionVi', e.target.value)} placeholder={t('descriptionPlaceholder')} />
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <GaCap className="mb-2 block">{t('fieldLevel')}</GaCap>
              <select className={field} value={form.cefrLevel} onChange={(e) => set('cefrLevel', e.target.value)}>
                {CEFR.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            </div>
            <div>
              <GaCap className="mb-2 block">{t('fieldFormat')}</GaCap>
              <input className={field} value={form.examFormat} onChange={(e) => set('examFormat', e.target.value.toUpperCase())} maxLength={30} placeholder="GOETHE" />
            </div>
          </div>
          <div className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-2">
            <div>
              <GaCap className="mb-2 block">{t('fieldSortOrder')}</GaCap>
              <input type="number" className={field} value={form.sortOrder} onChange={(e) => set('sortOrder', Number.parseInt(e.target.value, 10) || 0)} />
            </div>
            <label className="flex items-center gap-2 pb-2.5">
              <input type="checkbox" checked={form.requiresPaid} onChange={(e) => set('requiresPaid', e.target.checked)} style={{ accentColor: 'var(--ga-accent)' }} />
              <span className="text-[13.5px] font-semibold text-ga-ink">{t('requiresPaid')}</span>
            </label>
          </div>
        </div>
      </TkModal>
    </div>
  )
}
