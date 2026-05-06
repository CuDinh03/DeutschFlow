'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'
import { clearTokens, logout } from '@/lib/authSession'

export default function TeacherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      const [ov, cls, qz] = await Promise.all([
        api.get('/teacher/reports/overview'),
        api.get('/teacher/classes'),
        api.get('/teacher/quizzes'),
      ])
      setOverview(ov.data)
      setClasses(cls.data ?? [])
      setQuizzes(qz.data ?? [])
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        logout()
        return
      }
      setError('Khong the tai du lieu giao vien.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleLogout = () => {
    clearTokens()
    router.push('/')
  }

  const quickCreateClass = async () => {
    if (!name.trim()) return
    setError('')
    try {
      await api.post('/teacher/classes', { name: name.trim() })
      setName('')
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  if (loading) return <div className="page-shell text-muted-foreground">Dang tai dashboard...</div>

  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Teacher Dashboard</h1>
            <p className="page-subtitle">Du lieu thuc tu classes, quizzes, reports.</p>
          </div>
          <div className="form-row">
            <button className="btn-outline btn-sm" onClick={() => router.push('/teacher/classes')}>
              Quan ly lop
            </button>
            <button className="btn-outline btn-sm" onClick={() => router.push('/teacher/quizzes')}>
              Quan ly quiz
            </button>
            <button className="btn-outline btn-sm" onClick={() => router.push('/teacher/reports')}>
              Bao cao
            </button>
            <button className="btn-secondary btn-sm" onClick={handleLogout}>
              Dang xuat
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 alert-error">{error}</div> : null}

        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <div className="section-card">
            <p className="text-muted-foreground text-xs">So lop</p>
            <p className="text-2xl font-bold">{overview?.classCount ?? 0}</p>
          </div>
          <div className="section-card">
            <p className="text-muted-foreground text-xs">So quiz</p>
            <p className="text-2xl font-bold">{overview?.quizCount ?? 0}</p>
          </div>
          <div className="section-card">
            <p className="text-muted-foreground text-xs">Quiz active</p>
            <p className="text-2xl font-bold">{overview?.activeQuizCount ?? 0}</p>
          </div>
          <div className="section-card">
            <p className="text-muted-foreground text-xs">Tong hoc vien</p>
            <p className="text-2xl font-bold">{overview?.studentCount ?? 0}</p>
          </div>
          <div className="section-card">
            <p className="text-muted-foreground text-xs">Diem TB</p>
            <p className="text-2xl font-bold">{Number(overview?.avgScore ?? 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="section-card mb-6">
          <p className="font-semibold text-foreground mb-2">Quick create class</p>
          <div className="form-row">
            <input className="input flex-1" placeholder="Ten lop" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary btn-md" onClick={quickCreateClass}>
              Tao lop
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Lop hoc gan day</h2>
              <button className="text-primary text-sm" onClick={() => router.push('/teacher/classes')}>
                Xem tat ca
              </button>
            </div>
            {classes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Chua co lop nao.</p>
            ) : (
              <div className="space-y-2">
                {classes.slice(0, 5).map((c) => (
                  <div key={c.id} className="list-item">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Hoc vien: {c.studentCount} · Quiz: {c.quizCount}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Quiz gan day</h2>
              <button className="text-primary text-sm" onClick={() => router.push('/teacher/quizzes')}>
                Xem tat ca
              </button>
            </div>
            {quizzes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Chua co quiz nao.</p>
            ) : (
              <div className="space-y-2">
                {quizzes.slice(0, 5).map((q) => (
                  <div key={q.id} className="list-item">
                    <p className="font-medium text-foreground">{q.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.quizType} · {q.status} · PIN {q.pinCode}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

