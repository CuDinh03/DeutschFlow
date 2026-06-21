'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkModal } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Speaking Prompts (admin) — navy, CRUD (W1.7 migrate admin/weekly-speaking).
// Plumbing reused 1:1: GET/POST/PUT/DELETE /api/admin/speaking/weekly-prompts[/{id}].
// ─────────────────────────────────────────────────────────────────────────────

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
const field = 'ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none focus:border-ga-accent'

interface WeeklyPrompt {
  id: number
  weekNumber: number
  cefrLevel: string
  topicDe: string
  topicVi: string
  descriptionVi?: string
  isActive: boolean
}
interface FormState { weekNumber: number; cefrLevel: string; topicDe: string; topicVi: string; descriptionVi: string; isActive: boolean }
const EMPTY: FormState = { weekNumber: 1, cefrLevel: 'A1', topicDe: '', topicVi: '', descriptionVi: '', isActive: true }

export default function V2AdminWeeklySpeakingPage() {
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
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const openCreate = () => { setEditingId(null); setForm(EMPTY); setModal(true) }
  const openEdit = (p: WeeklyPrompt) => {
    setEditingId(p.id)
    setForm({ weekNumber: p.weekNumber, cefrLevel: p.cefrLevel, topicDe: p.topicDe, topicVi: p.topicVi, descriptionVi: p.descriptionVi ?? '', isActive: p.isActive })
    setModal(true)
  }
  const submit = async () => {
    if (!form.topicDe.trim() || !form.topicVi.trim()) { toast.error('Chủ đề (Đức + Việt) là bắt buộc'); return }
    setSaving(true)
    try {
      if (editingId != null) await api.put(`/admin/speaking/weekly-prompts/${editingId}`, form)
      else await api.post('/admin/speaking/weekly-prompts', form)
      toast.success(editingId != null ? 'Đã lưu thay đổi' : 'Đã tạo prompt')
      setModal(false)
      await load()
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setSaving(false) }
  }
  const remove = async (p: WeeklyPrompt) => {
    if (!window.confirm(`Xác nhận xoá prompt tuần ${p.weekNumber} (${p.topicVi})?`)) return
    setDeleting(p.id)
    try { await api.delete(`/admin/speaking/weekly-prompts/${p.id}`); await load() }
    catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setDeleting(null) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Weekly Speaking Prompts"
        subtitle="Quản lý chủ đề Speaking hàng tuần"
        right={<GaBtn variant="yellow" size="sm" onClick={openCreate}><Plus size={15} /> Tạo mới</GaBtn>}
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <GaCap className="mb-3.5 block">{prompts.length} prompt</GaCap>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được prompts</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/speaking/weekly-prompts</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : prompts.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Chưa có prompt nào — bấm “Tạo mới”.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {prompts.map((p) => (
              <div key={p.id} className="flex items-start gap-3.5 border border-ga-line bg-ga-card px-[18px] py-4" style={{ opacity: p.isActive ? 1 : 0.6 }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center font-ga-display text-[13px] font-medium text-ga-bg" style={{ background: 'var(--ga-ink)' }}>W{p.weekNumber}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-ga-ink">{p.topicVi}</span>
                    <span className="px-2 py-0.5 text-[10.5px] font-bold" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>{p.cefrLevel}</span>
                    {!p.isActive && <span className="px-2 py-0.5 text-[10.5px] font-bold" style={{ color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>Tắt</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] italic text-ga-muted">{p.topicDe}</p>
                  {p.descriptionVi && <p className="ga-ui mt-1 line-clamp-2 text-[12.5px] text-ga-subtle">{p.descriptionVi}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => openEdit(p)} className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"><Pencil size={12} /> Sửa</button>
                  <button type="button" disabled={deleting === p.id} onClick={() => remove(p)} className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1.5 text-[11px] font-semibold text-ga-red transition-colors hover:border-ga-red disabled:opacity-50">
                    {deleting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TkModal
        open={modal}
        onOpenChange={setModal}
        title={editingId == null ? 'Tạo Prompt mới' : 'Sửa Prompt'}
        size="sm"
        footer={
          <>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(false)}>Huỷ</GaBtn>
            <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>{editingId == null ? 'Tạo' : 'Lưu thay đổi'}</GaBtn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <GaCap className="mb-2 block">Tuần</GaCap>
              <input type="number" min={1} className={field} value={form.weekNumber} onChange={(e) => set('weekNumber', Number.parseInt(e.target.value, 10) || 1)} />
            </div>
            <div>
              <GaCap className="mb-2 block">CEFR Level</GaCap>
              <select className={field} value={form.cefrLevel} onChange={(e) => set('cefrLevel', e.target.value)}>
                {CEFR.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            </div>
          </div>
          <div>
            <GaCap className="mb-2 block">Chủ đề (tiếng Đức)</GaCap>
            <input className={field} value={form.topicDe} onChange={(e) => set('topicDe', e.target.value)} placeholder="Arbeit und Beruf" />
          </div>
          <div>
            <GaCap className="mb-2 block">Chủ đề (tiếng Việt)</GaCap>
            <input className={field} value={form.topicVi} onChange={(e) => set('topicVi', e.target.value)} placeholder="Nghề nghiệp & Công việc" />
          </div>
          <div>
            <GaCap className="mb-2 block">Mô tả (tuỳ chọn)</GaCap>
            <textarea className={`${field} resize-none`} rows={2} value={form.descriptionVi} onChange={(e) => set('descriptionVi', e.target.value)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ accentColor: 'var(--ga-accent)' }} />
            <span className="text-[13.5px] font-semibold text-ga-ink">Kích hoạt</span>
          </label>
        </div>
      </TkModal>
    </div>
  )
}
