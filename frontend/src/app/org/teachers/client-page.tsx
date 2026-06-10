'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, Users, Trash2, X, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { OrgShell } from '@/components/layouts/OrgShell'
import { logout } from '@/lib/authSession'
import { httpStatus, apiMessage } from '@/lib/api'
import { toastApiError } from '@/lib/toastApiError'
import { useUserStore } from '@/stores/useUserStore'
import { listMembers, inviteTeacher, removeMember, type OrgMember, type OrgRole } from '@/lib/orgApi'

const TEACHER_ROLE: OrgRole = 'TEACHER'

export default function OrgTeachersClientPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)

  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [pendingRemove, setPendingRemove] = useState<OrgMember | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listMembers(TEACHER_ROLE)
      setMembers(data)
    } catch (e) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      if (httpStatus(e) === 403) {
        router.push('/teacher/dashboard')
        return
      }
      setError('Không thể tải danh sách giáo viên. Vui lòng thử lại sau.')
      toastApiError(e, { onRetry: () => void load() })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const handleRemove = async (member: OrgMember) => {
    setRemovingId(member.userId)
    try {
      await removeMember(member.userId)
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
      toast.success('Đã gỡ giáo viên khỏi tổ chức')
    } catch (e) {
      toastApiError(e)
    } finally {
      setRemovingId(null)
      setPendingRemove(null)
    }
  }

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản trị viên'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải danh sách giáo viên...</p>
        </div>
      </div>
    )
  }

  return (
    <OrgShell
      activeMenu="teachers"
      userName={userName}
      onLogout={() => { void logout() }}
      headerTitle="Giáo viên"
      headerSubtitle="Quản lý đội ngũ giáo viên của tổ chức"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {members.length > 0
              ? `Tổ chức có ${members.length} giáo viên`
              : 'Tổ chức chưa có giáo viên nào'}
          </p>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <UserPlus size={16} />
            Mời giáo viên
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
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có giáo viên nào</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Mời giáo viên qua email. Họ sẽ nhận được liên kết để tham gia và truy cập lớp học của tổ chức.
            </p>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <UserPlus size={16} />
              Mời giáo viên
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-400 to-purple-500 font-bold text-white shadow-sm">
                      {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{m.displayName || m.email}</p>
                      <p className="truncate text-xs text-slate-400">{m.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingRemove(m)}
                    disabled={removingId === m.userId}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
                  >
                    {removingId === m.userId ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Gỡ
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <InviteTeacherDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => void load()}
      />

      <ConfirmRemoveDialog
        member={pendingRemove}
        loading={removingId !== null}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => { if (pendingRemove) void handleRemove(pendingRemove) }}
      />
    </OrgShell>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteTeacherDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const reset = () => {
    setEmail('')
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Vui lòng nhập email hợp lệ')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await inviteTeacher(trimmed)
      setSuccess(true)
      onInvited()
      setTimeout(() => {
        reset()
        onClose()
      }, 1600)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-teacher-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="invite-teacher-title" className="text-xl font-bold text-slate-800">
              Mời giáo viên
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nhập email của giáo viên. Họ sẽ nhận được liên kết mời để tham gia tổ chức.
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

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Đã gửi lời mời! Giáo viên sẽ nhận được email kèm liên kết tham gia.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-semibold text-slate-700">
                Email giáo viên
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  placeholder="giaovien@example.com"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-4 text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  autoFocus
                  maxLength={255}
                />
              </div>
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
                disabled={submitting || !email.trim()}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Đang gửi…' : 'Gửi lời mời'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Remove confirmation ───────────────────────────────────────────────────────

function ConfirmRemoveDialog({
  member,
  loading,
  onCancel,
  onConfirm,
}: {
  member: { displayName: string | null; email: string } | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!member) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-teacher-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="remove-teacher-title" className="text-lg font-bold text-slate-800">
          Gỡ giáo viên?
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Bạn có chắc muốn gỡ <span className="font-semibold text-slate-700">{member.displayName || member.email}</span> khỏi
          tổ chức? Giáo viên này sẽ mất quyền truy cập lớp học của tổ chức.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Gỡ giáo viên
          </button>
        </div>
      </div>
    </div>
  )
}
