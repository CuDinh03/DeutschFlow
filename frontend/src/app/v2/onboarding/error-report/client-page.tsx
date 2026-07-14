'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { ArrowLeft, RefreshCw, Lock, CheckCircle2, Crown, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { GaCard, GaCardBody, GaCardHeader, GaCardTitle, GaBtn, GaCap, TkModal } from '@/components/ui-v2'
import { GaAuthShell } from '../../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/onboarding/error-report — Galerie 2.0 port of /onboarding/error-report.
// LOGIC IS 1:1: the same three-strategy report lookup (query id → localStorage
// fallback → GET /onboarding/placement-tests/latest), the same free/PRO gating of
// the error list (first 2 visible, the rest blurred). Only the shell/tokens and the
// outbound routes change (/onboarding/mock-exam → /v2/onboarding/mock-exam,
// /dashboard → /v2/student/dashboard, /student/settings → /v2/payment, which is the
// upgrade surface on v2).
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorItem {
  code: string
  message: string
  example: string
}

interface PlacementReport {
  id?: number
  estimated_cefr: string
  radar_chart: { grammar: number; pronunciation: number; vocabulary: number; fluency: number }
  top_errors: ErrorItem[]
  summary_vi?: string
}

const MOCK_EXAM_ROUTE = '/v2/onboarding/mock-exam'
const DASHBOARD_ROUTE = '/v2/student/dashboard'
const PRICING_ROUTE = '/v2/payment'

/** Score → semantic token: green ≥70, orange ≥40, red below. */
function scoreColor(score: number): string {
  if (score >= 70) return 'var(--ga-green)'
  if (score >= 40) return 'var(--ga-orange)'
  return 'var(--ga-red)'
}

export default function V2ErrorReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [report, setReport] = useState<PlacementReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true)

      // Strategy 1: Try to get by ID from query param
      const reportId = searchParams.get('id')
      if (reportId) {
        try {
          const { data } = await api.get(`/onboarding/placement-tests/latest`)
          setReport(data)
          setLoading(false)
          return
        } catch {
          // fall through to localStorage
        }
      }

      // Strategy 2: Fallback to localStorage (backward compat)
      const localData = localStorage.getItem('mockExamReport')
      if (localData) {
        try {
          setReport(JSON.parse(localData))
          localStorage.removeItem('mockExamReport') // Clean up after use
          setLoading(false)
          return
        } catch {
          // fall through
        }
      }

      // Strategy 3: Fetch latest from server
      try {
        const { data } = await api.get('/onboarding/placement-tests/latest')
        setReport(data)
      } catch {
        // No test found at all — redirect to mock exam
        router.push(MOCK_EXAM_ROUTE)
        return
      }

      setLoading(false)
    }

    fetchReport()
  }, [searchParams, router])

  if (loading || !report) {
    return (
      <GaAuthShell showBackToLanding={false}>
        <div className="flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-ga-pill border-4 border-ga-line border-t-ga-accent" />
        </div>
      </GaAuthShell>
    )
  }

  const radarData = [
    { subject: 'Ngữ pháp', A: report.radar_chart?.grammar || 0, fullMark: 100 },
    { subject: 'Phát âm', A: report.radar_chart?.pronunciation || 0, fullMark: 100 },
    { subject: 'Từ vựng', A: report.radar_chart?.vocabulary || 0, fullMark: 100 },
    { subject: 'Trôi chảy', A: report.radar_chart?.fluency || 0, fullMark: 100 },
  ]

  const avgScore = Math.round(
    ((report.radar_chart?.grammar || 0) +
      (report.radar_chart?.pronunciation || 0) +
      (report.radar_chart?.vocabulary || 0) +
      (report.radar_chart?.fluency || 0)) / 4,
  )

  const continueFree = () => {
    router.push(DASHBOARD_ROUTE)
  }

  const upgradeClick = () => {
    router.push(PRICING_ROUTE)
  }

  return (
    <GaAuthShell wide showBackToLanding={false}>
      <div className="space-y-8">
        {/* Back nav */}
        <Link href={DASHBOARD_ROUTE} className="ga-ui inline-flex items-center gap-2 text-[13px] text-ga-muted transition-colors hover:text-ga-ink">
          <ArrowLeft size={16} /> Về Dashboard
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="m-0 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">
            Báo Cáo Trình Độ Của Bạn
          </h1>
          <p className="mt-3 text-[15px] text-ga-muted">
            Dựa trên bài nói 3 phút, AI đã đánh giá chi tiết năng lực của bạn.
          </p>
        </div>

        {/* CEFR Badge */}
        <div className="flex justify-center">
          <GaCard className="flex items-center gap-6 px-8 py-5">
            <div>
              <GaCap>Trình độ ước tính</GaCap>
              <p className="mt-1 font-ga-display text-[44px] font-medium leading-none text-ga-accent">{report.estimated_cefr}</p>
            </div>
            <div className="h-12 w-px bg-ga-line" />
            <div>
              <GaCap>Điểm trung bình</GaCap>
              <p className="mt-1 font-ga-display text-[44px] font-medium leading-none" style={{ color: scoreColor(avgScore) }}>
                {avgScore}<span className="text-[16px] text-ga-subtle">/100</span>
              </p>
            </div>
          </GaCard>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Radar Chart */}
          <GaCard>
            <GaCardHeader>
              <GaCardTitle>Biểu Đồ Năng Lực</GaCardTitle>
            </GaCardHeader>
            <GaCardBody>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="var(--ga-line)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--ga-muted)', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--ga-subtle)', fontSize: 10 }} />
                    <Radar name="Bạn" dataKey="A" stroke="var(--ga-accent)" fill="var(--ga-accent)" fillOpacity={0.35} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Score Bars */}
              <div className="mt-4 space-y-3">
                {radarData.map((item) => (
                  <div key={item.subject} className="flex items-center gap-3">
                    <span className="ga-ui w-20 text-[13px] font-medium text-ga-muted">{item.subject}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-ga-pill bg-ga-surface">
                      <div
                        className="h-full rounded-ga-pill transition-all duration-700"
                        style={{ width: `${item.A}%`, background: scoreColor(item.A) }}
                      />
                    </div>
                    <span className="ga-ui w-8 text-right text-[13px] font-bold text-ga-ink">{item.A}</span>
                  </div>
                ))}
              </div>
            </GaCardBody>
          </GaCard>

          {/* Top Errors */}
          <GaCard>
            <GaCardHeader>
              <GaCardTitle className="flex items-center gap-2 text-ga-red">
                <AlertTriangle size={18} /> Lỗi Ngữ Pháp Thường Gặp
              </GaCardTitle>
            </GaCardHeader>
            <GaCardBody>
              <ul className="space-y-4">
                {report.top_errors?.slice(0, 2).map((err, idx) => (
                  <li key={idx} className="rounded-ga border border-ga-line bg-ga-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-ga bg-ga-red-soft">
                        <span className="ga-ui text-[13px] font-bold text-ga-red">{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="ga-ui text-[14px] font-bold text-ga-ink">{err.message}</p>
                        <div className="mt-2 rounded-ga border border-ga-line bg-ga-surface p-2.5 font-mono text-[13px] text-ga-muted">
                          {err.example}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}

                {/* Locked errors — FREE sees the first 2 only; the rest are blurred behind PRO. */}
                {report.top_errors && report.top_errors.length > 2 && (
                  <>
                    {report.top_errors.slice(2).map((err, idx) => (
                      <li key={idx + 2} className="relative rounded-ga border border-ga-line bg-ga-surface p-4 opacity-60">
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-ga bg-ga-card/60 backdrop-blur-[2px]">
                          <div className="ga-ui flex items-center gap-2 rounded-ga-pill bg-ga-ink px-4 py-2 text-[13px] font-bold text-ga-bg">
                            <Lock size={14} />
                            PRO — Mở khóa để xem
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-ga bg-ga-line">
                            <span className="ga-ui text-[13px] font-bold text-ga-subtle">{idx + 3}</span>
                          </div>
                          <div className="flex-1">
                            <p className="ga-ui font-bold text-ga-faint">████████████████</p>
                            <div className="mt-2 rounded-ga bg-ga-surface p-2.5 font-mono text-[13px] text-ga-faint">
                              ████ → ████████
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </>
                )}
              </ul>

              {report.summary_vi && (
                <div className="mt-6 rounded-ga border border-ga-line bg-ga-blue-soft p-4">
                  <p className="text-[13.5px] leading-relaxed text-ga-ink">{report.summary_vi}</p>
                </div>
              )}
            </GaCardBody>
          </GaCard>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row">
          <GaBtn variant="yellow" size="lg" onClick={() => setShowPaywall(true)}>
            <Crown size={18} />
            Mở khóa toàn bộ lỗi + Lộ trình sửa
          </GaBtn>
          <GaBtn variant="ghost" size="lg" asChild>
            <Link href={MOCK_EXAM_ROUTE}>
              <RefreshCw size={16} />
              Làm lại bài test
            </Link>
          </GaBtn>
        </div>
      </div>

      {/* ─── Paywall Modal ───────────────────────────────────── */}
      <TkModal
        open={showPaywall}
        onOpenChange={setShowPaywall}
        title="Đừng để lỗi sai kìm hãm bạn!"
        description={`AI đã phát hiện ${report.top_errors?.length || 0} lỗi. Nâng cấp PRO để mở khóa toàn bộ và được AI ép sửa sạch.`}
      >
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Free Tier */}
          <div className="flex-1 rounded-ga border border-ga-line p-6">
            <h3 className="ga-ui text-[16px] font-bold text-ga-ink">Gói FREE</h3>
            <div className="mt-1 font-ga-display text-[26px] font-medium text-ga-ink">0đ</div>
            <div className="mt-5 space-y-3 text-[13.5px] text-ga-muted">
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                Xem 2 lỗi đầu tiên
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                Sửa tối đa 2 lỗi/ngày
              </p>
              <p className="flex items-start gap-2 text-ga-subtle">
                <Lock size={16} className="mt-0.5 shrink-0" />
                Các lỗi nghiêm trọng bị khóa
              </p>
              <p className="flex items-start gap-2 text-ga-subtle">
                <Lock size={16} className="mt-0.5 shrink-0" />
                Không có lộ trình cá nhân hóa
              </p>
            </div>
            <GaBtn variant="ghost" size="lg" className="mt-6 w-full" onClick={continueFree}>
              Tiếp tục miễn phí
            </GaBtn>
          </div>

          {/* Pro Tier */}
          <div className="relative flex-1 rounded-ga border border-ga-gold bg-ga-yellow-soft p-6">
            <div className="ga-ui absolute -top-3 left-1/2 -translate-x-1/2 rounded-ga-pill bg-ga-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ga-ink">
              Khuyên dùng
            </div>
            <h3 className="ga-ui text-[16px] font-bold text-ga-ink">Gói PRO</h3>
            <div className="mt-1 font-ga-display text-[30px] font-medium text-ga-ink">
              299k<span className="text-[15px] text-ga-muted">/tháng</span>
            </div>
            <div className="mt-5 space-y-3 text-[13.5px] text-ga-ink">
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                <strong>Mở khóa toàn bộ lỗi</strong>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                <strong>Không giới hạn lượt sửa lỗi</strong>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                Lộ trình sửa lỗi cá nhân hóa bằng AI
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ga-green" />
                Phân tích chuyên sâu Radar Chart
              </p>
            </div>
            <GaBtn variant="yellow" size="lg" className="mt-6 w-full" onClick={upgradeClick}>
              Nâng Cấp Ngay
            </GaBtn>
          </div>
        </div>
      </TkModal>
    </GaAuthShell>
  )
}
