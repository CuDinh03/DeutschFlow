'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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

export default function V2OrgInvitationsPage() {
  const t = useTranslations('v2.org.invitations')
  const tc = useTranslations('v2.common')
  // Role display label via catalog (roles.TEACHER/STUDENT/ADMIN/OWNER); falls back to the raw enum.
  const roleLabel = (r: string) => (['TEACHER', 'STUDENT', 'ADMIN', 'OWNER'].includes(r) ? t(`roles.${r}`) : r)
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
    if (role === 'STUDENT') { toast(t('studentByCode')); return }
    setSending(true)
    try {
      await inviteTeacher(e)
      toast.success(t('sent', { email: e }))
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
      toast.success(t('revoked'))
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
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-10 py-7">
        <TkStatStrip
          items={[
            { label: t('stats.pending'), value: pending.length, sub: t('stats.pendingSub'), color: '#E07B39', alert: pending.length > 0 },
            { label: t('stats.accepted'), value: accepted, sub: t('stats.acceptedSub'), color: '#1E9E61' },
            { label: t('stats.freeSeats'), value: freeSeats, sub: t('stats.freeSeatsSub'), color: TEAL },
          ]}
        />

        {/* Invite form */}
        <div className="mt-6 max-w-[780px] border border-ga-line bg-ga-card p-[26px]">
          <GaCap className="mb-3.5 block">{t('inviteFormCap')}</GaCap>
          <div className="mb-3.5 flex border border-ga-line">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('emailPlaceholder')}
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
                {roleLabel(r)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <GaBtn variant="yellow" size="sm" loading={sending} disabled={sending || !email.trim()} onClick={send}>
              <Send size={14} /> {t('sendInvite')}
            </GaBtn>
            {summary && (
              <span className="ga-ui text-[13px] text-ga-muted">
                {t('joinByCode')} <code className="px-2 py-1 text-[12.5px] font-semibold" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{summary.name}</code>
              </span>
            )}
          </div>
        </div>

        {/* Sent invitations */}
        <GaCap className="mb-3.5 mt-7 block">{t('sentListCap', { count: invites.length })}</GaCap>
        {loading ? (
          <div className="max-w-[780px] flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer mb-2 h-[58px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="max-w-[780px] border border-ga-line bg-ga-card px-10 py-[40px] text-center">
            <p className="ga-ui text-[14px] text-ga-red">{error}</p>
            <GaBtn variant="primary" className="mt-3" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : invites.length === 0 ? (
          <div className="max-w-[780px] border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">{t('empty')}</div>
        ) : (
          <div className="max-w-[780px] border border-ga-line bg-ga-card">
            {invites.map((iv, i) => {
              const isPending = iv.status === 'PENDING'
              return (
                <div key={iv.id} className="flex items-center gap-3.5 px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center" style={{ background: 'var(--ga-side-active)' }}><Mail size={15} className="text-ga-muted" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ga-ink">{iv.email}</div>
                    <div className="text-[12px] text-ga-muted">{t('sentMeta', { role: roleLabel(iv.role), date: fmtDate(iv.createdAt) })}</div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]" style={isPending ? { color: 'var(--ga-orange)', background: 'var(--ga-orange-soft)' } : iv.status === 'ACCEPTED' ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>
                    {isPending ? t('statusPending') : iv.status === 'ACCEPTED' ? t('statusAccepted') : iv.status === 'EXPIRED' ? t('statusExpired') : t('statusRevoked')}
                  </span>
                  {isPending && (
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => toast(t('resendSoon'))} className="ga-ui border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">{t('resend')}</button>
                      <button type="button" disabled={busy === iv.id} onClick={() => revoke(iv.id)} className="ga-ui border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50" style={{ color: 'var(--ga-red)', borderColor: 'color-mix(in srgb, var(--ga-red) 35%, transparent)' }}>{t('revoke')}</button>
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
