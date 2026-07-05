'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  getOrgSummary, getAnalytics, listClasses, listInvitations,
  type OrgSummary, type OrgAnalytics, type OrgClass, type OrgInvitation,
} from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Org dashboard (GaOrgDashboard) — teal (role=org). Plumbing reused 1:1 (zero backend):
//   getOrgSummary (/org) + getAnalytics (/org/analytics) + listClasses (/org/classes) +
//   listInvitations (/org/invitations).
// Option-1: proto's monthly new-student TREND chart + org avg-speaking-score + top-classes-
//   by-performance have no backing (no time-series / no per-class avg) → replaced with the
//   REAL CEFR distribution + seat/token-pool meters; "Cần xử lý" derived from real
//   free-seats / teacherless-classes / pending-invites.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'

export default function V2OrgDashboardPage() {
  const t = useTranslations('v2.org.overview')
  const tc = useTranslations('v2.common')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, a, c, inv] = await Promise.all([
        getOrgSummary(),
        getAnalytics().catch(() => null),
        listClasses(0, 50).then((p) => p.content).catch(() => [] as OrgClass[]),
        listInvitations().catch(() => [] as OrgInvitation[]),
      ])
      setSummary(s)
      setAnalytics(a)
      setClasses(c)
      setInvites(inv)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const freeSeats = summary ? Math.max(0, summary.seatLimit - summary.seatUsed) : 0
  const seatPct = summary && summary.seatLimit > 0 ? Math.round((summary.seatUsed / summary.seatLimit) * 100) : 0
  const teacherlessClasses = classes.filter((c) => c.teacherId == null).length
  const pendingInvites = invites.filter((i) => i.status === 'PENDING').length

  const todos: { label: string; tone: string }[] = []
  if (freeSeats > 0) todos.push({ label: t('todo.freeSeats', { count: freeSeats }), tone: 'var(--ga-yellow)' })
  if (teacherlessClasses > 0) todos.push({ label: t('todo.teacherless', { count: teacherlessClasses }), tone: 'var(--ga-red)' })
  if (pendingInvites > 0) todos.push({ label: t('todo.pendingInvites', { count: pendingInvites }), tone: 'var(--ga-orange)' })

  const cefr = analytics?.cefrDistribution ?? []
  const cefrMax = Math.max(1, ...cefr.map((b) => b.count))

  if (error) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitleDashboard')} />
        <div className="flex-1 px-10 py-10">
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-md text-[14px] text-ga-muted">
              {error || t('loadErrorDesc')}
            </p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={summary?.name ?? t('title')}
        subtitle={t('subtitleB2b')}
        right={
          <div className="flex items-center gap-2.5">
            <GaBtn variant="ghost" size="sm" onClick={() => toast(t('managePlanSoon'))}>{t('managePlan')}</GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => toast(t('inviteMemberSoon'))}>
              <UserPlus size={15} /> {t('inviteMember')}
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <TkStatStrip
          items={[
            { label: t('stats.seatsUsed'), value: summary ? `${summary.seatUsed}/${summary.seatLimit}` : '—', sub: t('stats.capacity', { pct: seatPct }), color: TEAL },
            { label: t('stats.totalStudents'), value: loading ? '—' : (analytics?.studentCount ?? summary?.studentCount ?? 0), sub: t('stats.active7d', { count: analytics?.activeStudents7d ?? 0 }), color: '#2F6FC9' },
            { label: t('stats.openClasses'), value: loading ? '—' : (analytics?.classCount ?? classes.length), sub: loading ? '—' : t('stats.teacherCount', { count: summary?.teacherCount ?? 0 }), color: '#7C56C8' },
            { label: t('stats.tokensThisMonth'), value: analytics ? analytics.tokensThisMonth.toLocaleString('vi-VN') : '—', sub: analytics?.poolUnlimited ? t('stats.poolUnlimited') : analytics && analytics.monthlyTokenPool > 0 ? t('stats.poolPercent', { pct: Math.round(analytics.poolUsagePercent) }) : t('stats.noPool'), color: '#1E9E61' },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
          {/* CEFR distribution (real) */}
          <div className="border border-ga-line bg-ga-card p-[22px]">
            <GaCap className="mb-4 block">{t('cefrCap')}</GaCap>
            {loading ? (
              <div className="ga-shimmer h-[170px]" aria-hidden />
            ) : cefr.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ga-muted">{t('cefrEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cefr.map((b) => (
                  <div key={b.level} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-ga-display text-[15px] font-medium text-ga-ink">{b.level}</span>
                    <span className="h-6 flex-1 bg-ga-bg">
                      <span className="block h-full" style={{ width: `${(b.count / cefrMax) * 100}%`, background: TEAL, minWidth: b.count > 0 ? 2 : 0 }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-ga-muted">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seat + token meters (real) */}
          <div className="border border-ga-line bg-ga-card p-[22px]">
            <GaCap className="mb-4 block">{t('seatUsageCap')}</GaCap>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-ga-display text-[26px] font-medium text-ga-ink">{seatPct}%</span>
              <span className="text-[12.5px] text-ga-muted">{t('seatsSuffix', { used: summary?.seatUsed ?? 0, limit: summary?.seatLimit ?? 0 })}</span>
            </div>
            <span className="block h-2.5 bg-ga-bg"><span className="block h-full" style={{ width: `${Math.min(100, seatPct)}%`, background: TEAL }} /></span>
            <div className="mt-2 flex items-center justify-between text-[12.5px] text-ga-muted">
              <span>{t('freeSuffix', { count: freeSeats })}</span>
              <button type="button" onClick={() => toast(t('buySeatsSoon'))} className="font-semibold underline" style={{ color: TEAL }}>{t('buySeats')}</button>
            </div>

            {analytics && analytics.monthlyTokenPool > 0 && (
              <>
                <GaCap className="mb-2 mt-5 block">{t('tokenPoolCap')}</GaCap>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-ga-display text-[20px] font-medium text-ga-ink">{Math.round(analytics.poolUsagePercent)}%</span>
                  <span className="text-[12px] text-ga-muted">{analytics.tokensThisMonth.toLocaleString('vi-VN')} / {analytics.monthlyTokenPool.toLocaleString('vi-VN')}</span>
                </div>
                <span className="block h-2 bg-ga-bg"><span className="block h-full" style={{ width: `${Math.min(100, analytics.poolUsagePercent)}%`, background: analytics.poolUsagePercent >= 90 ? 'var(--ga-red)' : analytics.poolUsagePercent >= 70 ? 'var(--ga-orange)' : 'var(--ga-green)' }} /></span>
              </>
            )}
          </div>
        </div>

        <div className="mt-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-2">
          {/* Cần xử lý (derived from real data) */}
          <div className="border border-ga-line bg-ga-card p-[22px]">
            <GaCap className="mb-3.5 block">{t('todoCap')}</GaCap>
            {todos.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('todoEmpty')}</p>
            ) : (
              todos.map((td, i) => (
                <button
                  key={td.label}
                  type="button"
                  onClick={() => toast(t('todo.relatedSoon'))}
                  className="group flex w-full items-center gap-3 py-3 text-left"
                  style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                >
                  <span className="h-[7px] w-[7px] shrink-0" style={{ background: td.tone }} />
                  <span className="flex-1 text-[13.5px] text-ga-ink">{td.label}</span>
                  <ChevronRight size={15} className="text-ga-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))
            )}
          </div>

          {/* Org classes (real) */}
          <div className="border border-ga-line bg-ga-card p-[22px]">
            <GaCap className="mb-3.5 block">{t('orgClassesCap')}</GaCap>
            {loading ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : classes.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('orgClassesEmpty')}</p>
            ) : (
              classes.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>
                    {(c.name[0] ?? 'L').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ga-ink">{c.name}</div>
                    <div className="text-[11.5px] text-ga-muted">{c.teacherId == null ? t('classNoTeacher') : t('classHasTeacher')}</div>
                  </div>
                  {c.inviteCode && <code className="shrink-0 bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">{c.inviteCode}</code>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
