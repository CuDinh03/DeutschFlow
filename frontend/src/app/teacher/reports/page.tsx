'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { BarChart2, Users, FileText, CheckCircle, GraduationCap, TrendingUp, Award, Loader2 } from 'lucide-react'

export default function TeacherReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [userName, setUserName] = useState('Giáo viên')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      if (me.data.name) setUserName(me.data.name)
      else if (me.data.email) setUserName(me.data.email.split('@')[0])

      const res = await api.get('/teacher/reports/overview')
      setOverview(res.data)
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      setError('Không thể tải báo cáo. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tổng hợp báo cáo...</p>
        </div>
      </div>
    )
  }

  return (
    <TeacherShell
      activeMenu="reports"
      userName={userName}
      onLogout={() => router.push('/')}
      headerTitle="Báo cáo & Thống kê"
      headerSubtitle="Theo dõi hiệu suất và tiến độ của học viên"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
            <span>{error}</span>
          </div>
        )}

        {!overview ? (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <BarChart2 size={32} className="text-slate-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-700">Chưa có dữ liệu báo cáo</h3>
             <p className="text-slate-500 mt-2 max-w-sm">Dữ liệu sẽ xuất hiện khi có học viên tham gia và hoàn thành các bài tập (Quiz).</p>
          </div>
        ) : (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Tổng Lớp Học</p>
                    <p className="text-4xl font-black text-slate-800">{overview.classCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Users size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-purple-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Tổng Bài Tập</p>
                    <p className="text-4xl font-black text-slate-800">{overview.quizCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shadow-inner">
                    <FileText size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Quiz Đang Mở</p>
                    <p className="text-4xl font-black text-slate-800">{overview.activeQuizCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                    <CheckCircle size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Tổng Học Viên</p>
                    <p className="text-4xl font-black text-slate-800">{overview.studentCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-inner">
                    <GraduationCap size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Score Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
               <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                 <TrendingUp size={300} />
               </div>
               
               <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
                 <div>
                   <div className="flex items-center gap-2 text-indigo-300 font-bold tracking-wider text-sm uppercase mb-2">
                     <Award size={18} /> Hiệu suất tổng thể
                   </div>
                   <h2 className="text-3xl font-black mb-4">Điểm trung bình toàn hệ thống</h2>
                   <p className="text-slate-400 max-w-md leading-relaxed text-sm">
                     Đây là điểm số trung bình của tất cả học viên trên toàn bộ các bài tập (bao gồm Trắc nghiệm, Ghép câu và Luyện nói AI). Dữ liệu được tính toán dựa trên thang điểm 10.
                   </p>
                 </div>
                 
                 <div className="flex justify-center md:justify-end">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-center min-w-[240px]">
                      <p className="text-6xl font-black bg-gradient-to-tr from-emerald-400 to-teal-300 text-transparent bg-clip-text drop-shadow-sm mb-2">
                        {Number(overview.avgScore ?? 0).toFixed(1)}
                      </p>
                      <p className="text-indigo-200 font-bold uppercase tracking-widest text-sm">Trên 10 Điểm</p>
                      
                      <div className="mt-6 h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                          style={{ width: `${(Number(overview.avgScore ?? 0) / 10) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Placeholder for future detailed charts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center mt-8">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
                 <BarChart2 size={24} className="text-slate-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-800">Biểu đồ phân tích chi tiết đang được phát triển</h3>
               <p className="text-slate-500 mt-2 max-w-lg mx-auto text-sm">
                 Trong các phiên bản tới, bạn sẽ có thể xem biểu đồ phổ điểm chi tiết, phân tích điểm yếu/mạnh của từng lớp và xuất báo cáo CSV/PDF.
               </p>
            </div>
          </>
        )}
      </div>
    </TeacherShell>
  )
}
