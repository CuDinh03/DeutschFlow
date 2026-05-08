'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import { clearTokens, getAccessToken, logout } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { WeeklyChallengeCard } from '@/components/speaking/WeeklyChallengeCard'
import {
  weeklySpeakingApi,
  type WeeklySubmissionDetailDto,
  type WeeklySubmissionListItem,
} from '@/lib/weeklySpeakingApi'

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function idx(b: string): number {
  const i = BANDS.indexOf(b as (typeof BANDS)[number])
  return i < 0 ? 0 : i
}

function normCurrent(c: string | null): string {
  const u = (c ?? '').trim().toUpperCase()
  if (!u || u === 'A0') return 'A1'
  return BANDS.includes(u as (typeof BANDS)[number]) ? u : 'A1'
}

type MeUser = { displayName: string; role: string }

export default function StudentWeeklySpeakingPage() {
  const t = useTranslations('student')
  const tSpeak = useTranslations('speaking')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [me, setMe] = useState<MeUser | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [streakDays, setStreakDays] = useState(0)
  const [currentLevel, setCurrentLevel] = useState<string | null>(null)

  const [cefPick, setCefPick] = useState<string>('A1')

  const [rows, setRows] = useState<WeeklySubmissionListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<WeeklySubmissionDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const bandOptions = useMemo(() => {
    const floor = normCurrent(currentLevel)
    let ceil = (targetLevel ?? 'A2').trim().toUpperCase()
    if (!BANDS.includes(ceil as (typeof BANDS)[number])) ceil = floor
    let fi = idx(floor)
    let ci = idx(ceil)
    if (ci < fi) ci = fi
    return BANDS.slice(fi, ci + 1)
  }, [currentLevel, targetLevel])

  const refreshList = useCallback(async () => {
    setListLoading(true)
    try {
      const subRes = await weeklySpeakingApi.listMySubmissions(0, 20)
      setRows(subRes.data.content ?? [])
    } catch {
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
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
    const qp = (searchParams.get('cefBand') ?? '').trim().toUpperCase()
    type DashBoardMe = { streakDays?: number }
    type PlanMe = { plan?: { currentLevel?: string; targetLevel?: string } }
    const dashFallback: { data: DashBoardMe } = { data: {} }
    const planFallback: { data: PlanMe } = { data: {} }
    const [planRes, dashRes] = await Promise.all([
      api.get<PlanMe>('/plan/me').catch((err) => {
        console.warn('WeeklySpeaking: /plan/me failed', err)
        return planFallback
      }),
      api.get<DashBoardMe>('/student/dashboard').catch(() => dashFallback),
    ])
    const p = planRes.data?.plan
    const cur = typeof p?.currentLevel === 'string' ? p.currentLevel : null
    const tgt = typeof p?.targetLevel === 'string' ? p.targetLevel : 'A2'
    setCurrentLevel(cur)
    setTargetLevel(tgt)
    setStreakDays(Number(dashRes?.data?.streakDays ?? 0))

    const floor = normCurrent(cur)
    let ceil = tgt.trim().toUpperCase()
    if (!BANDS.includes(ceil as (typeof BANDS)[number])) ceil = floor
    let fi = idx(floor)
    let ci = idx(ceil)
    if (ci < fi) ci = fi
    const allowed = BANDS.slice(fi, ci + 1)
    const fromUrl =
      qp && allowed.includes(qp as (typeof BANDS)[number]) ? qp : floor
    setCefPick(fromUrl)

    await refreshList()
  }, [router, searchParams, refreshList])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const { data } = await weeklySpeakingApi.getMySubmission(id)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const initials = useMemo(() => {
    if (!me) return '?'
    return me.displayName
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [me])

  const handleLogout = () => {
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
      activeSection="weeklySpeaking"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t('weeklySpeakingTitle')}
      headerSubtitle={t('weeklySpeakingSubtitle')}
    >
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
          <label className="text-xs font-semibold text-[#64748B] block mb-2">
            {t('weeklySpeakingBand')}
          </label>
          <select
            value={cefPick}
            onChange={(e) => setCefPick(e.target.value)}
            className="w-full max-w-xs rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#121212] font-semibold"
          >
            {bandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_20px_rgba(0,48,94,0.08)] border border-[#E2E8F0]">
          <WeeklyChallengeCard key={cefPick} cefrBand={cefPick} onSubmitted={refreshList} />
        </div>

        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,48,94,0.06)]">
          <h2 className="font-semibold text-[#1A1A1A] mb-2">{t('weeklyHistoryTitle')}</h2>
          <p className="text-sm text-[#64748B] mb-4">{t('weeklyHistorySubtitle')}</p>

          {listLoading ? (
            <p className="text-[#64748B] text-sm">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-[#64748B] text-sm">{t('weeklyHistoryEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => void toggleExpand(row.id)}
                    className="w-full text-left px-3 py-2.5 flex flex-wrap justify-between gap-2 hover:bg-[#F1F5F9]"
                  >
                    <span className="font-medium text-[#121212] text-sm">{row.promptTitle}</span>
                    <span className="text-xs text-[#64748B]">
                      {row.weekStartDate} · {row.cefrBand}
                      {row.taskScoreOrNull != null ? ` · ${row.taskScoreOrNull}/5` : ''}
                    </span>
                  </button>
                  {expandedId === row.id && (
                    <div className="px-3 pb-3 border-t border-[#E2E8F0] bg-white">
                      {detailLoading && <p className="text-xs text-[#64748B] mt-2">{t('loading')}</p>}
                      {!detailLoading && detail && detail.id === row.id ? (
                        <div className="mt-2 space-y-2 text-sm">
                          {detail.rubricOrNull?.feedback_vi_summary && (
                            <p className="text-[#0F172A] leading-snug">{detail.rubricOrNull.feedback_vi_summary}</p>
                          )}
                          {detail.rubricOrNull?.grammar?.summary_de && (
                            <p className="text-[#475569] text-xs italic">{detail.rubricOrNull.grammar.summary_de}</p>
                          )}
                          {detail.rubricOrNull?.disclaimer_vi && (
                            <p className="text-[#94A3B8] text-xs">{detail.rubricOrNull.disclaimer_vi}</p>
                          )}
                          {!detail.rubricOrNull && detail.rubricPayloadRawOrNull && (
                            <pre className="text-[11px] text-[#64748B] whitespace-pre-wrap overflow-x-auto max-h-48">
                              {detail.rubricPayloadRawOrNull}
                            </pre>
                          )}
                          <p className="text-xs font-semibold text-[#121212]">{tSpeak('weeklyYourTranscript')}</p>
                          <p className="text-[#334155] text-xs whitespace-pre-wrap border border-[#E2E8F0] rounded-[8px] p-2 bg-[#FAFAFA]">
                            {detail.transcript}
                          </p>
                        </div>
                      ) : null}
                      {!detailLoading && expandedId === row.id && (!detail || detail.id !== row.id) ? (
                        <p className="text-xs text-red-600 mt-2">{t('weeklyDetailError')}</p>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StudentShell>
  )
}
