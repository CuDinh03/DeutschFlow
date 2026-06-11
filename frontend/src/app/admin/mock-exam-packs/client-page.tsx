'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, EyeOff, Eye, Loader2, X, Save, FileText, Lock } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import { httpStatus } from '@/lib/api'
import {
  listAdminMockPacks,
  createMockPack,
  updateMockPack,
  deactivateMockPack,
  type AdminMockPack,
} from '@/lib/adminMockPackApi'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

interface FormState {
  title: string
  descriptionVi: string
  cefrLevel: string
  examFormat: string
  requiresPaid: boolean
  sortOrder: number
}

const EMPTY_FORM: FormState = {
  title: '',
  descriptionVi: '',
  cefrLevel: 'B1',
  examFormat: 'GOETHE',
  requiresPaid: true,
  sortOrder: 0,
}

export default function AdminMockExamPacksClientPage() {
  const [packs, setPacks] = useState<AdminMockPack[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    setError(undefined)
    try {
      setPacks(await listAdminMockPacks())
      setLastSyncedAt(new Date())
    } catch (e) {
      setError(httpStatus(e) === 403 ? 'Bạn không có quyền xem trang này.' : 'Không tải được danh sách bộ đề. Thử lại sau.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (pack: AdminMockPack) => {
    setEditingId(pack.id)
    setForm({
      title: pack.title,
      descriptionVi: pack.descriptionVi ?? '',
      cefrLevel: pack.cefrLevel,
      examFormat: pack.examFormat,
      requiresPaid: pack.requiresPaid,
      sortOrder: pack.sortOrder,
    })
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
  }

  const submitForm = async () => {
    if (!form.title.trim()) {
      setFormError('Tiêu đề là bắt buộc.')
      return
    }
    setSaving(true)
    setFormError(null)
    const body = {
      title: form.title.trim(),
      descriptionVi: form.descriptionVi.trim() || null,
      cefrLevel: form.cefrLevel,
      examFormat: form.examFormat.trim() || 'GOETHE',
      requiresPaid: form.requiresPaid,
      sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
    }
    try {
      if (editingId == null) {
        await createMockPack(body)
      } else {
        await updateMockPack(editingId, body)
      }
      closeForm()
      await load(true)
    } catch (e) {
      setFormError(httpStatus(e) === 400 ? 'Dữ liệu không hợp lệ. Kiểm tra lại các trường.' : 'Không lưu được bộ đề. Thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (pack: AdminMockPack) => {
    setBusyId(pack.id)
    try {
      if (pack.active) {
        await deactivateMockPack(pack.id)
      } else {
        await updateMockPack(pack.id, { active: true })
      }
      await load(true)
    } catch {
      setError('Không cập nhật được trạng thái bộ đề. Thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell
      title="Bộ đề thi thử"
      subtitle="Quản lý các bộ đề luyện thi (D3) — tạo, sửa, ẩn/hiện mà không cần SQL"
      activeNav="mock-exam-packs"
      error={error}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Một bộ đề gom các đề thi thử <span className="font-semibold text-slate-700">đang bật</span> trùng (trình độ × định dạng).
            Cột <span className="font-semibold text-slate-700">Đề</span> = số đề bộ này hiện gom được (0 = bộ rỗng).
          </p>
          <button
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            <Plus size={16} /> Tạo bộ đề
          </button>
        </div>

        {formOpen && (
          <PackForm
            isEdit={editingId != null}
            form={form}
            saving={saving}
            error={formError}
            onChange={setForm}
            onCancel={closeForm}
            onSubmit={() => void submitForm()}
          />
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={26} className="animate-spin text-indigo-500" /></div>
          ) : packs.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-400">Chưa có bộ đề nào. Bấm “Tạo bộ đề”.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">Bộ đề</th>
                    <th className="px-4 py-3">Cấp · Định dạng</th>
                    <th className="px-4 py-3 text-center">Đề</th>
                    <th className="px-4 py-3">Truy cập</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {packs.map((p) => (
                    <tr key={p.id} className={`hover:bg-slate-50/60 ${p.active ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-3 text-slate-400">{p.sortOrder}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{p.title}</p>
                        {p.descriptionVi && <p className="mt-0.5 max-w-[22rem] truncate text-xs text-slate-400">{p.descriptionVi}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">{p.cefrLevel} · {p.examFormat}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold ${p.examCount === 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                          <FileText size={13} /> {p.examCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.requiresPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"><Lock size={11} /> Trả phí</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Miễn phí</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Đang hiện</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">Đã ẩn</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            <Pencil size={13} /> Sửa
                          </button>
                          <button
                            onClick={() => void toggleActive(p)}
                            disabled={busyId === p.id}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              p.active
                                ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {busyId === p.id ? <Loader2 size={13} className="animate-spin" /> : p.active ? <EyeOff size={13} /> : <Eye size={13} />}
                            {p.active ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

interface PackFormProps {
  isEdit: boolean
  form: FormState
  saving: boolean
  error: string | null
  onChange: (next: FormState) => void
  onCancel: () => void
  onSubmit: () => void
}

function PackForm({ isEdit, form, saving, error, onChange, onCancel, onSubmit }: PackFormProps) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => onChange({ ...form, [key]: value })
  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">{isEdit ? 'Sửa bộ đề' : 'Tạo bộ đề mới'}</h2>
        <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Tiêu đề</span>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
            placeholder="VD: Luyện thi Goethe B1 — Bộ đề đầy đủ"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="sm:col-span-2 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Mô tả (tiếng Việt)</span>
          <textarea
            value={form.descriptionVi}
            onChange={(e) => set('descriptionVi', e.target.value)}
            rows={2}
            placeholder="Mô tả ngắn hiển thị cho học viên"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Trình độ (CEFR)</span>
          <select
            value={form.cefrLevel}
            onChange={(e) => set('cefrLevel', e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {CEFR_LEVELS.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Định dạng đề</span>
          <input
            value={form.examFormat}
            onChange={(e) => set('examFormat', e.target.value.toUpperCase())}
            maxLength={30}
            placeholder="GOETHE"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Thứ tự hiển thị</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', Number.parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={form.requiresPaid}
            onChange={(e) => set('requiresPaid', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <span className="text-sm font-semibold text-slate-700">Yêu cầu gói trả phí</span>
        </label>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Huỷ</button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isEdit ? 'Lưu thay đổi' : 'Tạo bộ đề'}
        </button>
      </div>
    </div>
  )
}
