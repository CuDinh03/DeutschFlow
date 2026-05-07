'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'

export default function TeacherReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const me = await api.get('/auth/me')
        if (me.data.role !== 'TEACHER') {
          router.push(`/${String(me.data.role).toLowerCase()}`)
          return
        }
        const res = await api.get('/teacher/reports/overview')
        setOverview(res.data)
      } catch (e: unknown) {
        if (httpStatus(e) === 401) {
          router.push('/login')
          return
        }
        setError('Khong the tai bao cao.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  if (loading) {
    return <div className="page-shell text-muted-foreground">Dang tai bao cao...</div>
  }

  return (
    <div className="page-shell">
      <div className="page-container max-w-4xl">
        <div className="page-header">
          <h1 className="page-title">Bao cao giao vien</h1>
          <button className="btn-outline btn-sm" onClick={() => router.push('/teacher')}>
            Ve dashboard
          </button>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}

        {!overview ? (
          <div className="empty-state">Khong co du lieu.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="section-card">
              <p className="text-muted-foreground text-sm">So lop hoc</p>
              <p className="text-2xl font-bold">{overview.classCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">So quiz</p>
              <p className="text-2xl font-bold">{overview.quizCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Quiz dang active</p>
              <p className="text-2xl font-bold">{overview.activeQuizCount}</p>
            </div>
            <div className="section-card">
              <p className="text-muted-foreground text-sm">Tong hoc vien</p>
              <p className="text-2xl font-bold">{overview.studentCount}</p>
            </div>
            <div className="section-card md:col-span-2">
              <p className="text-muted-foreground text-sm">Diem trung binh quiz</p>
              <p className="text-2xl font-bold">{Number(overview.avgScore ?? 0).toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

