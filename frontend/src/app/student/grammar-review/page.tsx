'use client'

import React, { useEffect, useState } from 'react'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { logout } from '@/lib/authSession'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PremiumGate } from '@/components/ui/PremiumGate'
import { motion, AnimatePresence } from 'framer-motion'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'

interface GrammarReviewTask {
  id: number
  errorCode: string
  taskType: string
}

export default function GrammarReviewPage() {
  usePageTimeTracker('grammar_review');
  const router = useRouter()
  const { me, loading: meLoading, targetLevel, streakDays, initials } = useStudentPracticeSession()

  const [tasks, setTasks] = useState<GrammarReviewTask[]>([])
  const [loading, setLoading] = useState(true)
  const [lockedCount, setLockedCount] = useState(0)

  useEffect(() => {
    if (!me) return
    loadTasks()
  }, [me])

  const loadTasks = async () => {
    try {
      const res = await api.get('/review-tasks/me/today')
      if (res.data?.tasks) {
        setTasks(res.data.tasks)
        setLockedCount(res.data.lockedCount || 0)
      } else if (Array.isArray(res.data)) {
        setTasks(res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const completeTask = async (taskId: number) => {
    try {
      await api.post(`/review-tasks/${taskId}/complete`, { passed: true })
      setTasks(tasks.filter(t => t.id !== taskId))
    } catch (e) {
      console.error(e)
      toast.error("Lỗi khi hoàn thành bài tập")
    }
  }

  if (meLoading || !me) return null

  return (
    <StudentShell
      activeSection="review"
      user={me}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => logout()}
      headerTitle="Sửa Lỗi Ngữ Pháp"
      headerSubtitle="Spaced Repetition"
    >
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-gray-900">Danh Sách Lỗi Cần Khắc Phục</h2>
          <p className="text-gray-500 mt-2 text-sm">AI tự động lên lịch nhắc lại các lỗi ngữ pháp bạn hay mắc phải để giúp bạn sửa tận gốc.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tasks.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border p-8 text-center shadow-sm"
          >
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-800">Không còn lỗi nào!</h3>
            <p className="text-gray-500 mt-2">Bạn đã ôn tập hết các lỗi ngữ pháp cần sửa cho hôm nay.</p>
            <button 
              onClick={() => router.push('/student/roadmap')}
              className="mt-6 bg-primary text-white font-bold py-2 px-6 rounded-xl"
            >
              Tiếp tục học
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {tasks.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="shadow-sm border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex justify-between items-center">
                        <span className="font-mono text-red-600 bg-red-50 px-2 py-1 rounded text-sm font-bold" title={t.errorCode}>
                          {getErrorSnippet(t.errorCode, 'vi').title}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Dạng: {t.taskType}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 mb-6 font-medium text-sm">
                        Bạn có hay mắc lỗi này không? Hãy chú ý tự tạo một câu mới sử dụng đúng cấu trúc này và ghi nhớ nhé.
                      </p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => completeTask(t.id)}
                          className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition-colors"
                        >
                          Đã hiểu & Ghi nhớ
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {lockedCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
            <PremiumGate
              requires="PRO"
              variant="banner"
              title={`Bạn đang bị khóa ${lockedCount} lỗi nghiêm trọng!`}
              description="Tài khoản FREE chỉ cho phép sửa tối đa 2 lỗi mỗi ngày. Nâng cấp PRO để mở khóa toàn bộ Hệ thống Sửa lỗi và đẩy nhanh quá trình tiến bộ."
            />
          </motion.div>
        )}
      </div>
    </StudentShell>
  )
}
