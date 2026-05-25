'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { usePendingGradingCount } from '@/hooks/usePendingGradingCount'
import { BarChart2, Users, FileText, CheckCircle, GraduationCap, TrendingUp, Award, Loader2, Download, Printer, TableProperties } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function exportToCSV(overview: any, classes: any[], userName: string) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('vi-VN')
  const timeStr = now.toLocaleTimeString('vi-VN')

  const rows: string[][] = []

  // Header
  rows.push(['BÁO CÁO THỐNG KÊ - DEUTSCHFLOW TEACHER PORTAL'])
  rows.push([`Giáo viên: ${userName}`])
  rows.push([`Xuất lúc: ${dateStr} ${timeStr}`])
  rows.push([])

  // Overview section
  rows.push(['--- TỔNG QUAN ---'])
  rows.push(['Chỉ số', 'Giá trị'])
  rows.push(['Tổng số lớp học', overview?.classCount ?? 0])
  rows.push(['Tổng số bài tập (Quiz)', overview?.quizCount ?? 0])
  rows.push(['Quiz đang mở', overview?.activeQuizCount ?? 0])
  rows.push(['Tổng số học viên', overview?.studentCount ?? 0])
  rows.push(['Điểm trung bình toàn hệ thống', Number(overview?.avgScore ?? 0).toFixed(2)])
  rows.push([])

  // Classes section
  if (classes && classes.length > 0) {
    rows.push(['--- DANH SÁCH LỚP HỌC ---'])
    rows.push(['Tên lớp', 'Số học viên', 'Số bài tập (Quiz)', 'Mã lớp'])
    classes.forEach((cls: any) => {
      rows.push([
        cls.name ?? '',
        cls.studentCount ?? 0,
        cls.quizCount ?? 0,
        cls.inviteCode ?? cls.code ?? '',
      ])
    })
  }

  const csvContent = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `BaoCao_DeutschFlow_${now.toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function TeacherReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [userName, setUserName] = useState('Giáo viên')
  const { count: pendingGradingCount } = usePendingGradingCount()
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [classReport, setClassReport] = useState<any>(null)
  const [classReportLoading, setClassReportLoading] = useState(false)

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

      const [overviewRes, classesRes] = await Promise.all([
        api.get('/teacher/reports/overview'),
        api.get('/v2/teacher/classes').catch(() => ({ data: [] }))
      ])
      
      setOverview(overviewRes.data)
      setClasses(classesRes.data)
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

  const fetchClassReport = async (classId: string) => {
    if (!classId) { setClassReport(null); return; }
    setClassReportLoading(true);
    try {
      const res = await api.get(`/teacher/reports/classes/${classId}`);
      setClassReport(res.data);
    } catch {
      setClassReport(null);
    } finally {
      setClassReportLoading(false);
    }
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    fetchClassReport(id);
  };

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
      pendingGradingCount={pendingGradingCount}
      onLogout={() => void logout()}
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
            {/* Export Toolbar */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5">
              <div className="flex items-center gap-2 text-slate-600">
                <BarChart2 size={18} className="text-indigo-600" />
                <span className="font-semibold text-sm">Báo cáo tổng hợp</span>
                <span className="text-slate-400 text-xs">· Cập nhật theo thời gian thực</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToCSV(overview, classes, userName)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-bold shadow-sm"
                  title="Tải xuống file CSV, có thể mở bằng Excel hoặc Google Sheets"
                >
                  <TableProperties size={15} />
                  Xuất CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-bold shadow-sm"
                  title="In trang hoặc lưu dưới dạng PDF"
                >
                  <Printer size={15} />
                  In / PDF
                </button>
              </div>
            </div>

            {/* Class Drill-Down */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <Users size={18} className="text-indigo-600" />
                <span className="font-bold text-slate-800 text-sm">Báo cáo chi tiết theo lớp</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedClassId}
                  onChange={e => handleClassChange(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-slate-700 font-medium"
                >
                  <option value="">-- Chọn một lớp học --</option>
                  {classes.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              {classReportLoading && (
                <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Đang tải báo cáo lớp...
                </div>
              )}

              {classReport && !classReportLoading && (
                <div className="mt-4 grid grid-cols-3 gap-4 animate-in fade-in duration-300">
                  <div className="bg-indigo-50 rounded-2xl p-4 text-center border border-indigo-100">
                    <p className="text-3xl font-black text-indigo-600">{classReport.studentCount ?? 0}</p>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Học viên</p>
                  </div>
                  <div className="bg-purple-50 rounded-2xl p-4 text-center border border-purple-100">
                    <p className="text-3xl font-black text-purple-600">{classReport.quizCount ?? 0}</p>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Quiz đã tổ chức</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                    <p className="text-3xl font-black text-amber-600">{Number(classReport.avgScore ?? 0).toFixed(1)}</p>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Điểm TB</p>
                  </div>
                </div>
              )}

              {selectedClassId && !classReport && !classReportLoading && (
                <p className="mt-4 text-slate-500 text-sm text-center py-4 border border-dashed border-slate-200 rounded-xl">
                  Lớp này chưa có dữ liệu quiz nào.
                </p>
              )}
            </div>

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

            {/* Detailed Charts */}
            {classes && classes.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Students per Class Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Users size={20} className="text-indigo-600" />
                    Phân bố học viên theo lớp
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classes}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <Tooltip 
                          cursor={{ fill: '#F1F5F9' }} 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="studentCount" name="Số học viên" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Quizzes per Class Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-purple-600" />
                    Số lượng bài tập theo lớp
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classes}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <Tooltip 
                          cursor={{ fill: '#F1F5F9' }} 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="quizCount" name="Số bài tập (Quiz)" fill="#A855F7" radius={[6, 6, 0, 0]} maxBarSize={50} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TeacherShell>
  )
}
