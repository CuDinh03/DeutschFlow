'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { ArrowLeft, RefreshCw, Lock, CheckCircle2, Crown } from 'lucide-react'

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

export default function ErrorReportPage() {
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
        router.push('/onboarding/mock-exam')
        return
      }

      setLoading(false)
    }

    fetchReport()
  }, [searchParams, router])

  if (loading || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
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
      (report.radar_chart?.fluency || 0)) / 4
  )

  const continueFree = () => {
    router.push('/dashboard')
  }

  const upgradeClick = () => {
    router.push('/student/settings')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Back nav */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={16} /> Về Dashboard
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Báo Cáo Trình Độ Của Bạn
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Dựa trên bài nói 3 phút, AI đã đánh giá chi tiết năng lực của bạn.
          </p>
        </div>

        {/* CEFR Badge */}
        <div className="flex justify-center">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-8 py-5 flex items-center gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Trình độ ước tính</p>
              <p className="text-5xl font-black text-primary mt-1">{report.estimated_cefr}</p>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Điểm trung bình</p>
              <p className={`text-5xl font-black mt-1 ${
                avgScore >= 70 ? 'text-green-600' : avgScore >= 40 ? 'text-orange-500' : 'text-red-500'
              }`}>{avgScore}<span className="text-lg text-gray-400">/100</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg text-gray-700 text-center">Biểu Đồ Năng Lực</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" className="text-xs font-semibold" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Radar name="Bạn" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Score Bars */}
              <div className="mt-4 space-y-3">
                {radarData.map(item => (
                  <div key={item.subject} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-20">{item.subject}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          item.A >= 70 ? 'bg-green-500' : item.A >= 40 ? 'bg-orange-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${item.A}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-800 w-8 text-right">{item.A}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Errors */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Lỗi Ngữ Pháp Thường Gặp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {report.top_errors?.slice(0, 2).map((err, idx) => (
                  <li key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-red-600 font-bold text-sm">{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{err.message}</p>
                        <div className="text-sm text-gray-600 mt-2 font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          {err.example}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}

                {/* Locked errors */}
                {report.top_errors && report.top_errors.length > 2 && (
                  <>
                    {report.top_errors.slice(2).map((err, idx) => (
                      <li key={idx + 2} className="relative bg-gray-50 p-4 rounded-xl border border-gray-200 opacity-60">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-10">
                          <div className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                            <Lock size={14} />
                            PRO — Mở khóa để xem
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
                            <span className="text-gray-400 font-bold text-sm">{idx + 3}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-400">████████████████</p>
                            <div className="text-sm text-gray-300 mt-2 font-mono bg-gray-100 p-2.5 rounded-lg">
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
                <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-800 leading-relaxed">{report.summary_vi}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={() => setShowPaywall(true)}
            className="bg-primary hover:bg-blue-700 text-white text-lg font-bold py-4 px-10 rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.5)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <Crown size={20} />
            Mở khóa toàn bộ lỗi + Lộ trình sửa
          </button>
          <Link
            href="/onboarding/mock-exam"
            className="border-2 border-gray-200 text-gray-600 text-lg font-bold py-4 px-10 rounded-full hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Làm lại bài test
          </Link>
        </div>
      </div>

      {/* ─── Paywall Modal ───────────────────────────────────── */}
      {showPaywall && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full shadow-2xl border-0 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
              <h2 className="text-3xl font-extrabold mb-2">Đừng để lỗi sai kìm hãm bạn!</h2>
              <p className="text-blue-100 text-lg">
                AI đã phát hiện <strong>{report.top_errors?.length || 0} lỗi</strong>. 
                Nâng cấp PRO để mở khóa toàn bộ và được AI ép sửa sạch.
              </p>
            </div>

            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-6">

                {/* Free Tier */}
                <div className="flex-1 border rounded-xl p-6 hover:border-gray-300 transition-colors">
                  <h3 className="text-lg font-bold text-gray-900">Gói FREE</h3>
                  <div className="text-2xl font-black text-gray-900 mt-1">0đ</div>
                  <div className="mt-5 space-y-3 text-sm text-gray-600">
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      Xem 2 lỗi đầu tiên
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      Sửa tối đa 2 lỗi/ngày
                    </p>
                    <p className="flex items-start gap-2 text-gray-400">
                      <Lock size={16} className="mt-0.5 shrink-0" />
                      Các lỗi nghiêm trọng bị khóa
                    </p>
                    <p className="flex items-start gap-2 text-gray-400">
                      <Lock size={16} className="mt-0.5 shrink-0" />
                      Không có lộ trình cá nhân hóa
                    </p>
                  </div>
                  <button
                    onClick={continueFree}
                    className="mt-6 w-full py-2.5 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Tiếp tục miễn phí
                  </button>
                </div>

                {/* Pro Tier */}
                <div className="flex-1 border-2 border-primary rounded-xl p-6 relative bg-blue-50/50 shadow-sm">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Khuyên dùng
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Gói PRO</h3>
                  <div className="text-3xl font-black text-gray-900 mt-1">
                    299k<span className="text-base text-gray-500 font-normal">/tháng</span>
                  </div>
                  <div className="mt-5 space-y-3 text-sm text-gray-800">
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <strong>Mở khóa toàn bộ lỗi</strong>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <strong>Không giới hạn lượt sửa lỗi</strong>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      Lộ trình sửa lỗi cá nhân hóa bằng AI
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                      Phân tích chuyên sâu Radar Chart
                    </p>
                  </div>
                  <button
                    onClick={upgradeClick}
                    className="mt-6 w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors"
                  >
                    Nâng Cấp Ngay
                  </button>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
