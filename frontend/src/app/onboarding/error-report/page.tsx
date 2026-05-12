'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

export default function ErrorReportPage() {
  const router = useRouter()
  const [report, setReport] = useState<any>(null)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => {
    const data = localStorage.getItem('mockExamReport')
    if (data) {
      setReport(JSON.parse(data))
    } else {
      // Fallback demo data
      setReport({
        estimated_cefr: "A2+",
        radar_chart: { grammar: 45, pronunciation: 70, vocabulary: 60, fluency: 55 },
        top_errors: [
          { code: "KASUS_AKK", message: "Sai mạo từ ở Akkusativ", example: "Ich sehe der Mann -> Ich sehe den Mann" },
          { code: "VERB_POS", message: "Động từ sai vị trí trong câu phụ", example: "Weil ich bin krank -> Weil ich krank bin" },
          { code: "PREP_DAT", message: "Sai giới từ đi với Dativ", example: "Mit den Zug -> Mit dem Zug" }
        ]
      })
    }
  }, [])

  if (!report) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  const radarData = [
    { subject: 'Ngữ pháp', A: report.radar_chart?.grammar || 0, fullMark: 100 },
    { subject: 'Phát âm', A: report.radar_chart?.pronunciation || 0, fullMark: 100 },
    { subject: 'Từ vựng', A: report.radar_chart?.vocabulary || 0, fullMark: 100 },
    { subject: 'Độ trôi chảy', A: report.radar_chart?.fluency || 0, fullMark: 100 },
  ]

  const unlockPlan = () => {
    // In a real app, this integrates with Stripe/Payment
    alert("Chuyển hướng đến cổng thanh toán PRO...")
  }

  const continueFree = () => {
    router.push('/student/review')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Báo Cáo Điểm Yếu Của Bạn</h1>
          <p className="mt-4 text-xl text-gray-500">
            Dựa trên 3 phút phân tích, AI đã lập hồ sơ năng lực của bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-xl text-center text-gray-700">Biểu Đồ Năng Lực</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" className="text-xs font-medium" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="Bạn" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 text-center">
                <span className="text-sm text-gray-500">Ước tính trình độ CEFR hiện tại:</span>
                <div className="text-4xl font-black text-primary mt-1">{report.estimated_cefr}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Top 3 Lỗi Ngữ Pháp Chí Mạng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-6">
                {report.top_errors?.map((err: any, idx: number) => (
                  <li key={idx} className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <div className="font-bold text-red-800">{err.message}</div>
                    <div className="text-sm text-red-600 mt-1 font-mono bg-white p-2 rounded">
                      {err.example}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center pt-8">
          <button 
            onClick={() => setShowPaywall(true)}
            className="bg-primary hover:bg-blue-700 text-white text-xl font-bold py-4 px-12 rounded-full shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-1 transition-all"
          >
            Tạo Lộ Trình Sửa Lỗi Ngay
          </button>
        </div>
      </div>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full shadow-2xl border-0 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
              <button onClick={() => setShowPaywall(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
              <h2 className="text-3xl font-extrabold mb-2">Đừng để lỗi sai kìm hãm bạn!</h2>
              <p className="text-blue-100">AI đã lưu lại lỗi của bạn. Hãy nâng cấp PRO để AI ép bạn sửa sạch 100% lỗi.</p>
            </div>
            
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Free Tier */}
                <div className="flex-1 border rounded-xl p-6 hover:border-gray-300 transition-colors">
                  <h3 className="text-lg font-bold text-gray-900">Gói FREE (Dùng thử)</h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    <p className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      Làm bài tập nói AI hàng ngày
                    </p>
                    <p className="flex items-start">
                      <span className="text-orange-500 mr-2">!</span>
                      <span className="font-medium">Chỉ được sửa tối đa 2 lỗi/ngày</span>
                    </p>
                    <p className="flex items-start text-gray-400">
                      <span className="mr-2">✕</span>
                      Các lỗi nghiêm trọng bị khóa
                    </p>
                  </div>
                  <button onClick={continueFree} className="mt-8 w-full py-2 border-2 border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50">
                    Tiếp tục miễn phí
                  </button>
                </div>

                {/* Pro Tier */}
                <div className="flex-1 border-2 border-primary rounded-xl p-6 relative bg-blue-50/50 shadow-sm">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Khuyên dùng
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Gói PRO</h3>
                  <div className="text-3xl font-black text-gray-900 mt-2">299k<span className="text-lg text-gray-500 font-normal">/tháng</span></div>
                  <div className="mt-4 space-y-3 text-sm text-gray-800">
                    <p className="flex items-start">
                      <span className="text-green-500 mr-2 font-bold">✓</span>
                      Mở khóa toàn bộ Hệ thống Sửa lỗi
                    </p>
                    <p className="flex items-start">
                      <span className="text-green-500 mr-2 font-bold">✓</span>
                      Không giới hạn số lỗi được ép sửa
                    </p>
                    <p className="flex items-start">
                      <span className="text-green-500 mr-2 font-bold">✓</span>
                      Phân tích chuyên sâu bởi AI
                    </p>
                  </div>
                  <button onClick={unlockPlan} className="mt-8 w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors">
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
