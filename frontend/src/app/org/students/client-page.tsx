'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Users,
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Link2,
  GraduationCap,
} from 'lucide-react'
import { toast } from 'sonner'
import { OrgShell } from '@/components/layouts/OrgShell'
import { logout } from '@/lib/authSession'
import { httpStatus, apiMessage } from '@/lib/api'
import { toastApiError } from '@/lib/toastApiError'
import { useUserStore } from '@/stores/useUserStore'
import {
  listStudents,
  listClasses,
  importRoster,
  type OrgMember,
  type OrgClass,
  type RosterImportResult,
} from '@/lib/orgApi'

const CLASS_PAGE_SIZE = 100

export default function OrgStudentsClientPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)

  const [students, setStudents] = useState<OrgMember[]>([])
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [roster, classPage] = await Promise.all([
        listStudents(),
        listClasses(0, CLASS_PAGE_SIZE),
      ])
      setStudents(roster)
      setClasses(classPage.content ?? [])
    } catch (e) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      if (httpStatus(e) === 403) {
        router.push('/teacher/dashboard')
        return
      }
      setError('Không thể tải danh sách học viên. Vui lòng thử lại sau.')
      toastApiError(e, { onRetry: () => void load() })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản trị viên'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải danh sách học viên...</p>
        </div>
      </div>
    )
  }

  return (
    <OrgShell
      activeMenu="students"
      userName={userName}
      onLogout={() => {
        void logout()
      }}
      headerTitle="Học viên"
      headerSubtitle="Quản lý và import học viên của tổ chức"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {students.length > 0
              ? `Tổ chức có ${students.length} học viên`
              : 'Tổ chức chưa có học viên nào'}
          </p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <UploadCloud size={16} />
            Import CSV
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            <div className="mb-1 font-semibold">Không tải được danh sách</div>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => void load()}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có học viên nào</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Import danh sách học viên từ file CSV (cột: email, tên hiển thị, số điện thoại). Mỗi
              học viên sẽ được cấp gói học của tổ chức và (tuỳ chọn) thêm vào một lớp.
            </p>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <UploadCloud size={16} />
              Import CSV
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Học viên</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Email</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="hidden px-5 py-3 md:table-cell">Tham gia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.userId} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-sm">
                          {(s.displayName || s.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {s.displayName || s.email}
                          </p>
                          <p className="truncate text-xs text-slate-400 sm:hidden">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-500 sm:table-cell">
                      <span className="truncate">{s.email}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã gỡ'}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-slate-400 md:table-cell">
                      {formatJoinedAt(s.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImportRosterDialog
        open={importOpen}
        classes={classes}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />
    </OrgShell>
  )
}

function formatJoinedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Import modal ───────────────────────────────────────────────────────────────

function ImportRosterDialog({
  open,
  classes,
  onClose,
  onImported,
}: {
  open: boolean
  classes: OrgClass[]
  onClose: () => void
  onImported: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [classId, setClassId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RosterImportResult | null>(null)

  if (!open) return null

  const reset = () => {
    setFile(null)
    setClassId('')
    setError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    setError(null)
    setResult(null)
    if (picked && !picked.name.toLowerCase().endsWith('.csv')) {
      setError('Chỉ chấp nhận file .csv')
      setFile(null)
      return
    }
    setFile(picked)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Vui lòng chọn một file CSV')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await importRoster(file, classId ? Number(classId) : undefined)
      setResult(res)
      onImported()
      const summary = `Đã xử lý ${res.total} dòng: ${res.created} mới, ${res.linked} liên kết${
        res.enrolled > 0 ? `, ${res.enrolled} vào lớp` : ''
      }${res.failed > 0 ? `, ${res.failed} lỗi` : ''}.`
      if (res.failed > 0) {
        toast.warning(summary)
      } else {
        toast.success(summary)
      }
    } catch (e) {
      setError(apiMessage(e))
      toastApiError(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-roster-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="import-roster-title" className="text-xl font-bold text-slate-800">
              Import học viên từ CSV
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              File CSV với các cột: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">email,tên hiển thị,số điện thoại</code>. Dòng tiêu đề (chứa &quot;email&quot;) sẽ được tự động bỏ qua.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="-mr-1 -mt-1 p-1 text-slate-400 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {result ? (
          <ImportResultPanel
            result={result}
            onDone={() => {
              reset()
              onClose()
            }}
            onAgain={reset}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">File CSV</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-50"
              >
                {file ? (
                  <>
                    <FileText size={22} className="shrink-0 text-indigo-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud size={22} className="shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-500">Bấm để chọn file .csv</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handlePickFile}
                disabled={submitting}
                className="sr-only"
              />
            </div>

            <div>
              <label
                htmlFor="import-class"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Thêm vào lớp <span className="font-normal text-slate-400">(tuỳ chọn)</span>
              </label>
              <div className="relative">
                <GraduationCap
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  id="import-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={submitting || classes.length === 0}
                  className="w-full appearance-none rounded-xl border border-slate-300 py-2.5 pl-9 pr-4 text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                >
                  <option value="">— Không thêm vào lớp —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {classes.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Tổ chức chưa có lớp nào để thêm học viên.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting || !file}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Đang import…
                  </>
                ) : (
                  <>
                    <UploadCloud size={14} />
                    Import
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Import result panel ─────────────────────────────────────────────────────────

function ImportResultPanel({
  result,
  onDone,
  onAgain,
}: {
  result: RosterImportResult
  onDone: () => void
  onAgain: () => void
}) {
  const hasFailures = result.failed > 0
  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
          hasFailures
            ? 'border border-amber-200 bg-amber-50 text-amber-800'
            : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        {hasFailures ? (
          <AlertTriangle size={20} className="shrink-0" />
        ) : (
          <CheckCircle2 size={20} className="shrink-0" />
        )}
        <p className="text-sm font-semibold">
          {hasFailures
            ? `Import hoàn tất với ${result.failed} dòng lỗi.`
            : 'Import thành công!'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<UserPlus size={16} />} label="Mới" value={result.created} tone="indigo" />
        <StatTile icon={<Link2 size={16} />} label="Liên kết" value={result.linked} tone="sky" />
        <StatTile
          icon={<GraduationCap size={16} />}
          label="Vào lớp"
          value={result.enrolled}
          tone="emerald"
        />
        <StatTile
          icon={<AlertTriangle size={16} />}
          label="Lỗi"
          value={result.failed}
          tone={hasFailures ? 'rose' : 'slate'}
        />
      </div>

      <p className="text-xs text-slate-400">Tổng cộng {result.total} dòng đã được xử lý.</p>

      {result.errors.length > 0 && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
            Chi tiết lỗi
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-rose-700">
            {result.errors.map((msg, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-rose-400">•</span>
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onAgain}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Import tiếp
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Xong
        </button>
      </div>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'indigo' | 'sky' | 'emerald' | 'rose' | 'slate'
}) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-50 text-slate-500',
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
      <div
        className={`mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        {icon}
      </div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}
