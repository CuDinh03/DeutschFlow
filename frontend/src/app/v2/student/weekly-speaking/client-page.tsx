'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Mic } from 'lucide-react'
import api from '@/lib/api'
import { WeeklyChallengeCard } from '@/components/speaking/WeeklyChallengeCard'
import {
  weeklySpeakingApi,
  type WeeklySubmissionDetailDto,
  type WeeklySubmissionListItem,
} from '@/lib/weeklySpeakingApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { EmptyState, GaCap, GaCard, GaPageHdr, LoadingState, TkBadge, TkSeg } from '@/components/ui-v2'

/**
 * Bản v2 (vỏ Galerie) của /student/weekly-speaking.
 *
 * Đây là ĐƯỜNG DUY NHẤT để học viên nộp bài nói theo tuần mà admin ra đề ở
 * /v2/admin/weekly-speaking. Trước đợt này, ô "Speaking tuần" ở /v2/student/speaking trỏ vào màn
 * setup free-talk → admin ra đề nhưng học viên không có cửa nộp (tính năng đứt).
 *
 * Port 1:1 logic của trang v1: cùng endpoint (weeklySpeakingApi + GET /plan/me), cùng cách chọn
 * dải CEFR (floor = trình độ hiện tại, ceil = trình độ mục tiêu), cùng hợp đồng query `?cefBand`
 * (backend TodayPlan.recommendedWeeklySpeaking sinh ra link này), cùng event PostHog
 * `feature_session` với tên feature `weekly_speaking`. Thẻ nộp bài vẫn là <WeeklyChallengeCard>
 * dùng chung (thu âm → transcribe → submit → rubric) — TÁI DÙNG, không copy lại, để hai bề mặt
 * không thể lệch nhau.
 *
 * Khác v1: bỏ 2 lệnh gọi chỉ phục vụ khung v1 (GET /auth/me + /student/dashboard cho tên/streak
 * trên StudentShell) — GaShell đã lo phần chrome đó; và bỏ điều hướng role thủ công vì middleware
 * đã chặn /v2/* theo role.
 */

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

/** Dải band cho phép: từ trình độ hiện tại → trình độ mục tiêu (giống hệt v1). */
function allowedBands(currentLevel: string | null, targetLevel: string): readonly string[] {
  const floor = normCurrent(currentLevel)
  let ceil = (targetLevel ?? 'A2').trim().toUpperCase()
  if (!BANDS.includes(ceil as (typeof BANDS)[number])) ceil = floor
  const fi = idx(floor)
  let ci = idx(ceil)
  if (ci < fi) ci = fi
  return BANDS.slice(fi, ci + 1)
}

type PlanMe = { plan?: { currentLevel?: string; targetLevel?: string } }

export default function WeeklySpeakingClient() {
  usePageTimeTracker('weekly_speaking')
  const t = useTranslations('v2.student.weeklySpeaking')
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState<string | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [cefPick, setCefPick] = useState<string>('A1')

  const [rows, setRows] = useState<WeeklySubmissionListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<WeeklySubmissionDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const bandOptions = useMemo(
    () => allowedBands(currentLevel, targetLevel),
    [currentLevel, targetLevel],
  )

  const refreshList = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await weeklySpeakingApi.listMySubmissions(0, 20)
      setRows(res.data.content ?? [])
    } catch {
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    const qp = (searchParams.get('cefBand') ?? '').trim().toUpperCase()
    const planFallback: { data: PlanMe } = { data: {} }
    const planRes = await api.get<PlanMe>('/plan/me').catch((err) => {
      console.warn('WeeklySpeaking: /plan/me failed', err)
      return planFallback
    })
    const p = planRes.data?.plan
    const cur = typeof p?.currentLevel === 'string' ? p.currentLevel : null
    const tgt = typeof p?.targetLevel === 'string' ? p.targetLevel : 'A2'
    setCurrentLevel(cur)
    setTargetLevel(tgt)

    const allowed = allowedBands(cur, tgt)
    setCefPick(qp && allowed.includes(qp) ? qp : normCurrent(cur))
    setLoading(false)

    await refreshList()
  }, [searchParams, refreshList])

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

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a
            href="/v2/student/speaking"
            className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink transition-colors hover:bg-ga-surface"
          >
            <Mic size={14} aria-hidden /> {t('backToSpeaking')}
          </a>
        }
      />

      <div className="flex-1 px-10 py-6">
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-[22px]">
            <section>
              <GaCap className="mb-2 block">{t('bandCap')}</GaCap>
              <TkSeg
                aria-label={t('bandCap')}
                options={bandOptions.map((b) => ({ value: b, label: b }))}
                value={cefPick}
                onValueChange={setCefPick}
              />
            </section>

            {/* key={cefPick}: đổi band ⇒ remount để tải lại đề tuần đúng band (hành vi v1). */}
            <WeeklyChallengeCard key={cefPick} cefrBand={cefPick} onSubmitted={refreshList} />

            <GaCard className="p-6">
              <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">
                {t('historyTitle')}
              </h2>
              <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{t('historySubtitle')}</p>

              {listLoading ? (
                <LoadingState variant="skeleton" rows={3} label={t('loading')} className="mt-4" />
              ) : rows.length === 0 ? (
                <EmptyState icon="mic" title={t('historyEmpty')} description={t('historyEmptyDesc')} />
              ) : (
                <ul className="mt-4 space-y-2">
                  {rows.map((row) => {
                    const open = expandedId === row.id
                    const shown = open && !detailLoading && detail?.id === row.id ? detail : null
                    return (
                      <li
                        key={row.id}
                        className="overflow-hidden rounded-ga border border-ga-line bg-ga-surface"
                      >
                        <button
                          type="button"
                          onClick={() => void toggleExpand(row.id)}
                          aria-expanded={open}
                          className="ga-ui flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-ga-side-active"
                        >
                          <span className="text-[14px] font-semibold text-ga-ink">
                            {row.promptTitle}
                          </span>
                          <span className="flex items-center gap-2 text-[12.5px] text-ga-muted">
                            {row.weekStartDate} · {row.cefrBand}
                            {row.taskScoreOrNull != null && (
                              <TkBadge tone="teal">{row.taskScoreOrNull}/5</TkBadge>
                            )}
                          </span>
                        </button>

                        {open && (
                          <div className="border-t border-ga-line bg-ga-card px-4 pb-4">
                            {detailLoading && (
                              <p className="ga-ui mt-3 text-[12.5px] text-ga-muted">{t('loading')}</p>
                            )}
                            {shown ? (
                              <div className="mt-3 space-y-2">
                                {shown.rubricOrNull?.feedback_vi_summary && (
                                  <p className="ga-ui text-[13.5px] leading-relaxed text-ga-ink">
                                    {shown.rubricOrNull.feedback_vi_summary}
                                  </p>
                                )}
                                {shown.rubricOrNull?.grammar?.summary_de && (
                                  <p className="ga-ui text-[12.5px] italic text-ga-muted">
                                    {shown.rubricOrNull.grammar.summary_de}
                                  </p>
                                )}
                                {shown.rubricOrNull?.disclaimer_vi && (
                                  <p className="ga-ui text-[11.5px] text-ga-subtle">
                                    {shown.rubricOrNull.disclaimer_vi}
                                  </p>
                                )}
                                {!shown.rubricOrNull && shown.rubricPayloadRawOrNull && (
                                  <pre className="ga-ui max-h-48 overflow-x-auto whitespace-pre-wrap text-[11px] text-ga-muted">
                                    {shown.rubricPayloadRawOrNull}
                                  </pre>
                                )}
                                <GaCap className="pt-1">{t('yourTranscript')}</GaCap>
                                <p className="ga-ui whitespace-pre-wrap rounded-ga border border-ga-line bg-ga-surface p-3 text-[12.5px] text-ga-ink">
                                  {shown.transcript}
                                </p>
                              </div>
                            ) : null}
                            {!detailLoading && !shown ? (
                              <p className="ga-ui mt-3 text-[12.5px] text-ga-red">
                                {t('detailError')}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </GaCard>
          </div>
        )}
      </div>
    </div>
  )
}
