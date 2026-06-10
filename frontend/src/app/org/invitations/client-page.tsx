'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import api, { httpStatus } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { toastApiError } from '@/lib/toastApiError'
import { OrgShell } from '@/components/layouts/OrgShell'
import { listInvitations, revokeInvitation, type OrgInvitation } from '@/lib/orgApi'
import {
  Mail, Loader2, RefreshCw, Trash2, Clock, AlertTriangle,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Chủ tổ chức',
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học viên',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function isExpired(iso: string): boolean {
  const d = new Date(iso)
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
}

export default function OrgInvitationsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('Quản trị viên')
  const [loading, setLoading] = useState(true)
  const [invitations, setInvitations] = useState<OrgInvitation[]>([])
  const [revokingId, setRevokingId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [me, pending] = await Promise.all([
        api.get('/auth/me').catch(() => null),
        listInvitations(),
      ])
      if (me?.data) {
        const d = me.data
        if (d.displayName) setUserName(d.displayName)
        else if (d.name) setUserName(d.name)
        else if (d.email) setUserName(String(d.email).split('@')[0])
      }
      setInvitations(pending)
    } catch (e) {
      const status = httpStatus(e)
      if (status === 401) {
        router.push('/login')
        return
      }
      if (status === 403) {
        router.push('/teacher')
        return
      }
      toastApiError(e, { onRetry: loadData, locale: 'vi' })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRevoke = async (inv: OrgInvitation) => {
    setRevokingId(inv.id)
    // Optimistic removal — roll back on failure.
    const snapshot = invitations
    setInvitations((prev) => prev.filter((i) => i.id !== inv.id))
    try {
      await revokeInvitation(inv.id)
      toast.success(`Đã thu hồi lời mời gửi tới ${inv.email}`)
    } catch (e) {
      setInvitations(snapshot)
      toastApiError(e, { locale: 'vi' })
    } finally {
      setRevokingId(null)
    }
  }

  if (loading && invitations.length === 0) {
    return (
      <OrgShell
        activeMenu="invitations"
        userName={userName}
        onLogout={() => void logout()}
        headerTitle="Lời mời"
        headerSubtitle="Lời mời tham gia tổ chức đang chờ"
      >
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <p className="font-medium text-slate-500">Đang tải lời mời...</p>
          </div>
        </div>
      </OrgShell>
    )
  }

  return (
    <OrgShell
      activeMenu="invitations"
      userName={userName}
      onLogout={() => void logout()}
      headerTitle="Lời mời"
      headerSubtitle="Lời mời tham gia tổ chức đang chờ"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Mail size={20} className="text-indigo-600" />
            Lời mời đang chờ
            <span className="bg-amber-100 text-amber-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {invitations.length}
            </span>
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Làm mới
          </button>
        </div>

        {invitations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Mail size={36} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">Không có lời mời đang chờ</h3>
            <p className="text-slate-500 max-w-sm text-sm">
              Khi bạn mời giáo viên qua email, các lời mời chưa được nhận sẽ xuất hiện ở đây.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => {
              const expired = isExpired(inv.expiresAt)
              const revoking = revokingId === inv.id
              return (
                <div
                  key={inv.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-wrap items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-indigo-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{inv.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                      {expired ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} />
                          Đã hết hạn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Clock size={11} />
                          Hết hạn: {formatDateTime(inv.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevoke(inv)}
                    disabled={revoking}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-60 shrink-0"
                  >
                    {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Thu hồi
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </OrgShell>
  )
}
