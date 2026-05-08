'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import { clearTokens, getAccessToken, logout } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { planAttemptsApi, type PlanAttemptRow } from '@/lib/planAttemptsApi'
import Link from 'next/link'

type MeUser = { displayName: string; role: string }

export default function ExerciseHistoryPage() {
  const t = useTranslations('student')
  const router = useRouter()
  const [me, setMe] = useState<MeUser | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [streakDays, setStreakDays] = useState(0)
  const [rows, setRows] = useState<PlanAttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace('/login')
      return
    }
    const meRes = await api.get<MeUser>('/auth/me')
    if (meRes.data.role !== 'STUDENT') {
      router.replace(`/${String(meRes.data.role).toLowerCase()}`)
      return
    }
    setMe(meRes.data)

    type DashBoardMe = { streakDays?: number }
    const dashFallback: { data: DashBoardMe } = { data: {} }
    const [planRes, dashRes, attemptsRes] = await Promise.all([
      api.get<{ plan?: { targetLevel?: string } }>('/plan/me'),
      api.get<DashBoardMe>('/student/dashboard').catch(() => dashFallback),
      planAttemptsApi.list(page, 25),
    ])
    const tl = typeof planRes.data?.plan?.targetLevel === 'string' ? planRes.data.plan.targetLevel : 'A1'
    setTargetLevel(tl)
    setStreakDays(Number(dashRes?.data?.streakDays ?? 0))
    setRows(attemptsRes.data.content ?? [])
    setTotalPages(Math.max(1, attemptsRes.data.totalPages ?? 1))
    setLoading(false)
  }, [router, page])

  useEffect(() => {
    setLoading(true)
    void load().catch(() => setLoading(false))
  }, [load])

  const initials = useMemo(() => {
    if (!me) return '?'
    return me.displayName
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [me])

  const logout = () => {
    clearTokens()
    router.push('/')
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <p className="text-[#64748B]">{t('loading')}</p>
      </div>
    )
  }

  return (
    <StudentShell
      activeSection="exerciseHistory"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={logout}
      headerTitle={t('exerciseHistoryTitle')}
      headerSubtitle={t('exerciseHistorySubtitle')}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {loading ? (
          <p className="text-[#64748B]">{t('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-[#64748B] text-sm">{t('exerciseHistoryEmpty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[14px] border border-[#E2E8F0] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-left text-[#64748B] text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t('attemptWhen')}</th>
                    <th className="px-3 py-2 font-semibold">{t('attemptSession')}</th>
                    <th className="px-3 py-2 font-semibold">{t('attemptTry')}</th>
                    <th className="px-3 py-2 font-semibold">{t('attemptScore')}</th>
                    <th className="px-3 py-2 font-semibold">{t('attemptMistakes')}</th>
                    <th className="px-3 py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[#F1F5F9]">
                      <td className="px-3 py-2.5 text-[#334155] whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-[#121212] font-medium">
                        {t('attemptWeekSession', { w: r.weekNumber, s: r.sessionIndex })}
                      </td>
                      <td className="px-3 py-2.5 text-[#64748B]">#{r.attemptNo}</td>
                      <td className="px-3 py-2.5 font-semibold">{r.scorePercent}%</td>
                      <td className="px-3 py-2.5 text-[#64748B]">
                        {r.mistakeCount == null ? '—' : r.mistakeCount}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/student/plan/week/${r.weekNumber}/session/${r.sessionIndex}`}
                          className="text-[#121212] font-semibold text-xs hover:underline"
                        >
                          {t('attemptOpen')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 0}
                className="px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] text-[#121212] disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('prevPage')}
              </button>
              <span className="text-[#64748B]">
                {t('pageOf', { n: page + 1, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] text-[#121212] disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                {t('nextPage')}
              </button>
            </div>
          </>
        )}
      </div>
    </StudentShell>
  )
}
