'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Presentation } from 'lucide-react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { logout } from '@/lib/authSession'
import { apiMessage } from '@/lib/api'
import { fetchMyClasses, type MyClassroom } from '@/lib/studentClassesApi'
import { ClassCard } from './components/ClassCard'
import { JoinClassDialog } from './components/JoinClassDialog'

export default function ClassesClientPage() {
  usePageTimeTracker('classes')
  const { me: user, loading: userLoading, streakDays, initials, targetLevel } =
    useStudentPracticeSession({ requireStudent: true })

  const [classes, setClasses] = useState<MyClassroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchMyClasses()
      setClasses(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refresh()
  }, [user, refresh])

  if (!user || userLoading) return null

  return (
    <StudentShell
      activeSection="classes"
      user={{ displayName: user.displayName, role: user.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => { void logout() }}
      headerTitle="Lớp của tôi"
      headerSubtitle="Danh sách lớp bạn đang tham gia, bài tập và tiến độ"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {classes.length > 0
              ? `Bạn đang tham gia ${classes.length} lớp`
              : 'Bạn chưa tham gia lớp nào'}
          </p>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <Plus size={16} />
            Tham gia lớp
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <div className="font-semibold mb-1">Không tải được danh sách lớp</div>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => { setLoading(true); void refresh() }}
              className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Presentation className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có lớp nào</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Nhập mã mời từ giáo viên để gửi yêu cầu tham gia lớp. Giáo viên sẽ duyệt trước khi bạn vào lớp.
            </p>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              Tham gia lớp
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <ClassCard key={c.id} classroom={c} />
            ))}
          </div>
        )}
      </div>

      <JoinClassDialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={() => { void refresh() }}
      />
    </StudentShell>
  )
}
