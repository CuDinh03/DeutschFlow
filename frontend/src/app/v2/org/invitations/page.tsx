'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  listInvitations, inviteTeacher, revokeInvitation, getOrgSummary,
  type OrgInvitation, type OrgSummary, type OrgRole,
} from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Lời mời thành viên (GaOrgInvitations) — teal.
// Plumbing reused 1:1 (zero backend): listInvitations + inviteTeacher + revokeInvitation
//   + getOrgSummary (free seats). Option-1: backend has only a TEACHER invite endpoint —
//   students self-join via the org code → the "Học viên" tab points there (no fake invite).
//   "Gửi lại" has no endpoint → toast.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const ROLE_LABEL: Record<string, string> = { TEACHER: 'Giáo viên', STUDENT: 'Học viên', ADMIN: 'Quản trị', OWNER: 'Chủ sở hữu' }

export default function V2OrgInvitationsPage() {
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState<OrgRole>('TEACHER')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, sum] = await Promise.all([listInvitations(), getOrgSummary().catch(() => null)])
      setInvites(inv)
      setSummary(sum)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const send = async () => {
    const e = email.trim()
    if (!e) return
    if (role === 'STUDENT') { toast('Học viên tham gia bằng mã tổ chức (xem bên dưới)'); return }
    setSending(true)
    try {
      await inviteTeacher(e)
      toast.success(`Đã gửi lời mời tới ${e}`)
      setEmail('')
      await load()
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setSending(false)
    }
  }

  const revoke = async (id: number) => {
    setBusy(id)
    try {
      await revokeInvitation(id)
      toast.success('Đã thu hồi lời mời')
      await load()
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const pending = invites.filter((i) => i.status === 'PENDING')
  const accepted = invites.filter((i) => i.status === 'ACCEPTED').length
  const freeSeats = summary ? Math.max(0, summary.seatLimit - summary.seatUsed) : 0

  return (
    <div className="flex min-h-screen flex-col">
      <GaPageHdr accent title="Lời mời thành viên" subtitle="Mời giáo viên bằng email · học viên tham gia qua mã tổ chức" />

      <div className="flex-1 overflow-auto px-10 py-7">
        <TkStatStrip
          items={[
            { label: 'Lời mời đang chờ', value: pending.length, sub: 'chưa phản hồi', color: '#E07B39', alert: pending.length > 0 },
            { label: 'Đã tham gia', value: accepted, sub: 'qua lời mời', color: '#1E9E61' },
            { label: 'Ghế còn trống', value: freeSeats, sub: 'có thể mời thêm', color: TEAL },
          ]}
        />

        {/* Invite form */}
        <div className="mt-6 max-w-[780px] border border-ga-line bg-ga-card p-[26px]">
          <GaCap className="mb-3.5 block">Mời thành viên mới</GaCap>
          <div className="mb-3.5 flex border border-ga-line">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="email@vidu.com"
              className="ga-ui flex-1 bg-transparent px-4 py-3 text-[14.5px] text-ga-ink outline-none"
            />
            {(['TEACHER', 'STUDENT'] as OrgRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="ga-ui border-l border-ga-line px-4 text-[12.5px] font-semibold transition-colors"
                style={{ background: role === r ? 'var(--ga-ink)' : 'transparent', color: role === r ? 'var(--ga-bg)' : 'var(--ga-muted)' }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <GaBtn variant="yellow" size="sm" loading={sending} disabled={sending || !email.trim()} onClick={send}>
              <Send size={14} /> Gửi lời mời
            </GaBtn>
            {summary && (
              <span className="ga-ui text-[13px] text-ga-muted">
                Học viên tự tham gia bằng mã tổ chức: <code className="px-2 py-1 text-[12.5px] font-semibold" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{summary.name}</code>
              </span>
            )}
          </div>
        </div>

        {/* Sent invitations */}
        <GaCap className="mb-3.5 mt-7 block">Lời mời đã gửi ({invites.length})</GaCap>
        {loading ? (
          <div className="max-w-[780px] flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer mb-2 h-[58px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="max-w-[780px] border border-ga-line bg-ga-card px-10 py-[40px] text-center">
            <p className="ga-ui text-[14px] text-ga-red">{error}</p>
            <GaBtn variant="primary" className="mt-3" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : invites.length === 0 ? (
          <div className="max-w-[780px] border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Chưa gửi lời mời nào.</div>
        ) : (
          <div className="max-w-[780px] border border-ga-line bg-ga-card">
            {invites.map((iv, i) => {
              const isPending = iv.status === 'PENDING'
              return (
                <div key={iv.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center" style={{ background: 'var(--ga-side-active)' }}><Mail size={15} className="text-ga-muted" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ga-ink">{iv.email}</div>
                    <div className="text-[12px] text-ga-muted">{ROLE_LABEL[iv.role] ?? iv.role} · gửi {fmtDate(iv.createdAt)}</div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]" style={isPending ? { color: 'var(--ga-orange)', background: 'var(--ga-orange-soft)' } : iv.status === 'ACCEPTED' ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>
                    {isPending ? 'Đang chờ' : iv.status === 'ACCEPTED' ? 'Đã tham gia' : iv.status === 'EXPIRED' ? 'Hết hạn' : 'Đã thu hồi'}
                  </span>
                  {isPending && (
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => toast('Gửi lại lời mời (sắp ra mắt)')} className="ga-ui border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">Gửi lại</button>
                      <button type="button" disabled={busy === iv.id} onClick={() => revoke(iv.id)} className="ga-ui border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ color: 'var(--ga-red)', borderColor: 'color-mix(in srgb, var(--ga-red) 35%, transparent)' }}>Thu hồi</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
