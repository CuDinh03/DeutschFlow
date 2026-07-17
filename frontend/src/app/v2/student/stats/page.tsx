'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, ChevronRight, ShieldAlert, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaBtn, GaCap, GaPageHdr, LoadingState, ErrorBanner, TkBadge, TkStatStrip } from '@/components/ui-v2'
import { GaSection, GaMultiBars, GaArea, GaBarRow } from '../../analyticsShared'

/**
 * /v2/student/stats — thống kê học tập cá nhân (vỏ Galerie).
 *
 * Port của /student/stats: GIỮ NGUYÊN 3 endpoint và cách gọi (Promise.allSettled → trang vẫn
 * render nếu một API lỗi):
 *   · GET /user/analytics        → KPI 7 ngày + hoạt động theo ngày + errorsByType + topWeakPoints
 *   · GET /user/error-analytics  → xu hướng lỗi 30 ngày + số lỗi đang mở
 *   · GET /user/recommendations  → gợi ý việc nên làm tiếp (RecommendationService)
 * Giữ event PostHog `feature_session` (usePageTimeTracker('stats')).
 *
 * KHÁC /v2/student/progress: trang kia là tiến độ LỚP (buổi đã dạy + knowledge points do GV cập
 * nhật). Trang này là số liệu HỌC TẬP CÁ NHÂN (từ đã học/ôn, phút nói, lỗi ngữ pháp).
 *
 * ⚠️ Bỏ khối "Abzeichen" (AchievementBadges) của v1: /v2/student/achievements đã hiển thị đúng
 * dữ liệu đó (GET /achievements/me) trong vỏ v2 và có sẵn trên nav → thay bằng link sang trang ấy,
 * thay vì import component v1 (components/analytics/*) vốn nằm trong danh sách xoá ở Đợt 3.
 *
 * ⚠️ actionUrl của /user/recommendations vẫn trỏ path V1 (xem RecommendationService.java:36,47,61,71:
 * "/vocabulary/review", "/speaking/drill?focus=…", "/speaking", "/vocabulary") — hai cái đầu 404 SẴN
 * ngay cả trên v1. Không sửa backend trong đợt này (đợt port FE); thay vào đó ánh xạ theo `type` —
 * trường ổn định của contract — sang route v2. actionUrl chỉ được dùng trực tiếp nếu đã là /v2/*.
 */

// ─── Types (giữ nguyên contract v1) ───────────────────────────────────────────

type DayStats = { date: string; wordsLearned: number; wordsReviewed: number; speakingMinutes: number }

type AnalyticsSummary = {
  totalWordsLearned: number
  totalWordsReviewed: number
  totalSpeakingMinutes: number
  totalSessionsCompleted: number
  wordsDueForReview: number
  weeklyBreakdown: DayStats[]
  errorsByType: Record<string, number>
  topWeakPoints: string[]
}

type RecommendationItem = {
  type: string
  title: string
  description: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  actionUrl: string
}

type Recommendations = { items: RecommendationItem[] }

type ErrorAnalytics = {
  mostCommonErrors: Array<{ errorCode: string; label: string; count: number; severity: string }>
  errorTrend: Array<{ date: string; errorCount: number }>
  totalErrorsThisWeek: number
  openErrors: number
}

// ─── Recommendation → route v2 ────────────────────────────────────────────────

/** `type` là phần ổn định của contract; actionUrl của backend vẫn là path v1 (sắp bị xoá). */
const REC_ROUTE: Record<string, string> = {
  VOCABULARY_REVIEW: '/v2/student/review',
  GRAMMAR_DRILL: '/v2/student/errors',
  SPEAKING_PRACTICE: '/v2/student/speaking',
  NEW_VOCABULARY: '/v2/student/vocabulary',
}

/** Giữ ý định deep-link `?focus=<grammarPoint>` của v1 — sổ lỗi v2 đọc nó để lọc sẵn. */
function recHref(item: RecommendationItem): string | null {
  const base = REC_ROUTE[item.type]
  if (base) {
    const focus = item.actionUrl.split('focus=')[1]
    return focus ? `${base}?focus=${focus}` : base
  }
  // Backend sau này trả thẳng path /v2 thì dùng luôn; còn lại: không điều hướng vào cây v1.
  return item.actionUrl.startsWith('/v2/') ? item.actionUrl : null
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: 'var(--ga-red)',
  MEDIUM: 'var(--ga-orange)',
  LOW: 'var(--ga-subtle)',
}

/** Nhãn lỗi: giữ nguyên cách rút gọn của v1 ("CASE.AKKUSATIV" → "AKKUSATIV"). */
const shortErrorLabel = (code: string) => code.split('.').pop()?.replace(/_/g, ' ') ?? code

export default function V2StudentStatsPage() {
  usePageTimeTracker('stats')
  const t = useTranslations('v2.student.stats')
  const router = useRouter()

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    const [analyticsRes, recRes, errRes] = await Promise.allSettled([
      api.get<AnalyticsSummary>('/user/analytics'),
      api.get<Recommendations>('/user/recommendations'),
      api.get<ErrorAnalytics>('/user/error-analytics'),
    ])
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data)
    else setFailed(true)
    if (recRes.status === 'fulfilled') setRecommendations(recRes.value.data.items ?? [])
    if (errRes.status === 'fulfilled') setErrorAnalytics(errRes.value.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const weekly = (analytics?.weeklyBreakdown ?? []).map((d) => ({
    label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    learned: d.wordsLearned,
    reviewed: d.wordsReviewed,
    speaking: d.speakingMinutes,
  }))

  const topErrors = Object.entries(analytics?.errorsByType ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
  const maxErr = topErrors[0]?.[1] ?? 0

  const trend = (errorAnalytics?.errorTrend ?? []).map((d) => ({
    label: d.date.slice(5),
    value: d.errorCount,
  }))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/errors')}>
            {t('openErrorBook')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="mx-auto max-w-4xl space-y-[22px]">
          {loading ? (
            <LoadingState label={t('loading')} />
          ) : !analytics ? (
            <ErrorBanner variant="page" title={t('loadErrorTitle')} message={t('loadErrorDesc')} onRetry={load} />
          ) : (
            <>
              {failed && <ErrorBanner message={t('partialError')} onRetry={load} />}

              {/* KPI 7 ngày */}
              <TkStatStrip
                items={[
                  { label: t('kpi.learned'), value: analytics.totalWordsLearned, sub: t('kpi.thisWeek'), color: '#2F6FC9' },
                  { label: t('kpi.reviewed'), value: analytics.totalWordsReviewed, sub: t('kpi.words'), color: '#1E9E61' },
                  { label: t('kpi.speaking'), value: `${analytics.totalSpeakingMinutes}′`, sub: t('kpi.thisWeek'), color: '#E07B39' },
                  {
                    label: t('kpi.due'),
                    value: analytics.wordsDueForReview,
                    sub: t('kpi.toReview'),
                    color: '#DA291C',
                    alert: analytics.wordsDueForReview > 0,
                  },
                ]}
              />

              {/* Hoạt động 7 ngày */}
              <GaSection title={t('weeklyTitle')}>
                {weekly.length === 0 ? (
                  <p className="ga-ui py-8 text-center text-[13.5px] text-ga-muted">{t('noActivity')}</p>
                ) : (
                  <>
                    <GaMultiBars
                      data={weekly}
                      series={[
                        { key: 'learned', name: t('series.learned'), color: '#2F6FC9' },
                        { key: 'reviewed', name: t('series.reviewed'), color: '#1E9E61' },
                        { key: 'speaking', name: t('series.speaking'), color: '#E07B39' },
                      ]}
                    />
                    <div className="mt-3 flex justify-center gap-5">
                      {[
                        ['#2F6FC9', t('series.learned')],
                        ['#1E9E61', t('series.reviewed')],
                        ['#E07B39', t('series.speaking')],
                      ].map(([color, label]) => (
                        <span key={label} className="ga-ui flex items-center gap-1.5 text-[12px] text-ga-muted">
                          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </GaSection>

              <div className="grid gap-[22px] md:grid-cols-2">
                {/* Lỗi thường gặp (7 ngày) */}
                <GaSection title={t('commonErrorsTitle')}>
                  {topErrors.length === 0 ? (
                    <p className="ga-ui py-8 text-center text-[13.5px] text-ga-muted">{t('noErrorsRecorded')}</p>
                  ) : (
                    <div>
                      {topErrors.map(([code, count]) => (
                        <GaBarRow key={code} label={shortErrorLabel(code)} value={count} max={maxErr} color="#DA291C" />
                      ))}
                    </div>
                  )}
                </GaSection>

                {/* Điểm yếu */}
                <GaSection
                  title={
                    <span className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-ga-gold" aria-hidden />
                      {t('weakPointsTitle')}
                    </span>
                  }
                >
                  {analytics.topWeakPoints.length === 0 ? (
                    <p className="ga-ui py-8 text-center text-[13.5px] text-ga-muted">{t('noWeakPoints')}</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {analytics.topWeakPoints.map((point, i) => (
                        <li key={point} className="flex items-center gap-2.5 text-[14px] text-ga-ink">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ga-yellow-soft text-[10px] font-bold text-ga-gold">
                            {i + 1}
                          </span>
                          {/* Giữ nguyên cách hiển thị của v1: "CASE.AKKUSATIV" → "CASE → AKKUSATIV" */}
                          <span className="min-w-0 break-words">{point.replace('.', ' → ').replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </GaSection>
              </div>

              {/* Xu hướng lỗi 30 ngày */}
              {trend.length > 0 && (
                <GaSection
                  title={t('errorTrendTitle')}
                  right={
                    (errorAnalytics?.openErrors ?? 0) > 0 ? (
                      <TkBadge tone="red">
                        <ShieldAlert size={12} aria-hidden /> {t('openErrors', { count: errorAnalytics!.openErrors })}
                      </TkBadge>
                    ) : (
                      <TkBadge tone="green">{t('allFixed')}</TkBadge>
                    )
                  }
                >
                  <GaArea data={trend} color="#DA291C" />
                </GaSection>
              )}

              {/* Gợi ý (RecommendationService) */}
              {recommendations.length > 0 && (
                <GaSection title={t('recommendationsTitle')} bodyClassName="p-0">
                  <ul>
                    {recommendations.map((item, i) => {
                      const href = recHref(item)
                      const body = (
                        <>
                          <span
                            className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                            style={{ background: PRIORITY_COLOR[item.priority] ?? 'var(--ga-subtle)' }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-ga-ink">{item.title}</span>
                            <span className="ga-ui mt-0.5 block text-[12.5px] text-ga-muted">{item.description}</span>
                          </span>
                          {href && <ChevronRight size={16} className="mt-1 shrink-0 text-ga-subtle" aria-hidden />}
                        </>
                      )
                      return (
                        <li key={`${item.type}-${i}`} className={i ? 'border-t border-ga-border' : ''}>
                          {href ? (
                            <Link href={href} className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-ga-surface">
                              {body}
                            </Link>
                          ) : (
                            <div className="flex w-full items-start gap-3 px-5 py-4">{body}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </GaSection>
              )}

              {/* Huy hiệu sống ở /v2/student/achievements — không dựng lại ở đây */}
              <div className="flex items-center gap-3 border border-ga-line bg-ga-card px-5 py-4">
                <Trophy size={20} className="shrink-0 text-ga-gold" aria-hidden />
                <div className="min-w-0 flex-1">
                  <GaCap className="block">{t('badgesCap')}</GaCap>
                  <p className="ga-ui mt-0.5 text-[13px] text-ga-muted">{t('badgesHint')}</p>
                </div>
                <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/student/achievements')}>
                  {t('badgesCta')}
                </GaBtn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
