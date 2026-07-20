'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  acceptInvitation, previewInvitation,
  type AcceptInvitationInput, type InvitationPreview,
} from '@/lib/orgApi'
import {
  setTokens, clearTokens, recordTokenRefresh,
} from '@/lib/authSession'
import { homeFor } from '@/lib/roleRouting'
import { useUserStore } from '@/stores/useUserStore'
import { apiMessage } from '@/lib/api'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import {
  Building2, Loader2, AlertTriangle, CheckCircle2, ShieldCheck,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Chủ tổ chức',
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học viên',
}

type FormState = { displayName: string; password: string }

export default function OrgAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const setUser = useUserStore((s) => s.setUser)
  const setAccessToken = useUserStore((s) => s.setAccessToken)

  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({ displayName: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    if (!token) {
      setLoadError('Liên kết mời không hợp lệ — thiếu mã mời.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const data = await previewInvitation(token)
      setPreview(data)
    } catch (e) {
      setLoadError(apiMessage(e) || 'Không thể tải lời mời. Liên kết có thể đã bị thu hồi hoặc không tồn tại.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleAccept = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!preview) return
    setSubmitting(true)
    setSubmitError(null)

    // Preview no longer reveals whether the account exists (that would be an existence oracle),
    // so we always send the password. The backend treats it as ownership proof for an existing
    // account, or as the new password when creating one; displayName is used only in the latter.
    const body: AcceptInvitationInput = {
      password: form.password,
      displayName: form.displayName.trim() || undefined,
    }

    try {
      // Mirror the login flow: clear any stale token before establishing the new session.
      clearTokens()
      const auth = await acceptInvitation(token, body)

      setTokens(auth)
      recordTokenRefresh()

      // Hydrate the client store so UI reflects the new session immediately.
      setAccessToken(auth.accessToken)
      setUser({
        id: String(auth.userId),
        email: auth.email,
        roles: [auth.role],
        displayName: auth.displayName,
      })

      if (auth.locale && ['vi', 'en', 'de'].includes(auth.locale)) {
        document.cookie = `locale=${auth.locale};path=/;max-age=31536000;SameSite=Lax`
      }

      // An invitation can be for ANY role (see ROLE_LABELS), not just TEACHER — a student or centre
      // owner invitee must not land on the teacher surface, so the destination comes from the shared
      // role map rather than a fixed path.
      router.replace(homeFor(auth.role, { orgRole: auth.orgRole }))
    } catch (err) {
      setSubmitError(apiMessage(err) || 'Không thể nhận lời mời. Vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải lời mời...</p>
        </div>
      </Centered>
    )
  }

  // ─── Load error / invalid token ──────────────────────────────────────────────
  if (loadError || !preview) {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle size={30} className="text-rose-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Lời mời không khả dụng</h1>
            <p className="text-slate-500 text-sm">{loadError ?? 'Không tìm thấy lời mời.'}</p>
            <Link
              href="/v2/login"
              className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Đến trang đăng nhập
            </Link>
          </div>
        </Card>
      </Centered>
    )
  }

  // ─── Expired invitation ───────────────────────────────────────────────────────
  if (preview.expired) {
    return (
      <Centered>
        <Card>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={30} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Lời mời đã hết hạn</h1>
            <p className="text-slate-500 text-sm">
              Lời mời gửi tới <span className="font-semibold text-slate-700">{preview.email}</span> đã hết hạn.
              Vui lòng liên hệ quản trị viên tổ chức để được mời lại.
            </p>
            <Link
              href="/v2/login"
              className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Đến trang đăng nhập
            </Link>
          </div>
        </Card>
      </Centered>
    )
  }

  const roleLabel = ROLE_LABELS[preview.role] ?? preview.role
  // Password is always required (ownership proof for an existing account, or the new password
  // for a fresh one). We can't tell which case applies — the backend enforces displayName when
  // it turns out a new account must be created.
  const canSubmit = form.password.length > 0

  // ─── Valid invitation ─────────────────────────────────────────────────────────
  return (
    <Centered>
      <Card>
        <div className="flex flex-col items-center text-center mb-6">
          <DeutschFlowLogo variant="horizontal" size={180} animated />
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Building2 size={20} className="text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-500">Lời mời tham gia tổ chức</p>
              <p className="font-bold text-slate-800 truncate">{preview.orgName}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-indigo-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-500">
              Email: <span className="font-semibold text-slate-700">{preview.email}</span>
            </span>
            <span className="text-slate-500">
              Vai trò: <span className="font-semibold text-slate-700">{roleLabel}</span>
            </span>
          </div>
        </div>

        {submitError && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleAccept} className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-500" />
            <span>
              Nhập mật khẩu để xác nhận. Nếu bạn <span className="font-semibold">đã có tài khoản</span> DeutschFlow
              với email này, hãy dùng mật khẩu hiện tại. Nếu <span className="font-semibold">chưa có</span>, hãy
              đặt mật khẩu mới và tên hiển thị để tạo tài khoản.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Mật khẩu</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Mật khẩu tài khoản"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Tên hiển thị <span className="font-normal text-slate-400">(nếu tạo tài khoản mới)</span>
            </label>
            <input
              type="text"
              autoComplete="name"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Tham gia tổ chức
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Bằng việc tham gia, bạn đồng ý với điều khoản sử dụng của DeutschFlow.
        </p>
      </Card>
    </Centered>
  )
}

// ─── Layout helpers (public, no auth shell) ─────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 px-4 py-10">
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/60">
      {children}
    </div>
  )
}
