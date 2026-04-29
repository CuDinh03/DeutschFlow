'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus, apiMessage } from '@/lib/api'

type Classroom = {
  id: number
  name: string
  studentCount: number
  quizCount: number
}

export default function TeacherClassesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Classroom[]>([])
  const [newName, setNewName] = useState('')
  const [studentEmail, setStudentEmail] = useState<Record<number, string>>({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      const res = await api.get('/teacher/classes')
      setItems(res.data ?? [])
    } catch (e: unknown) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      setError('Khong the tai danh sach lop.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createClass = async () => {
    if (!newName.trim()) return
    setError('')
    try {
      await api.post('/teacher/classes', { name: newName.trim() })
      setNewName('')
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const deleteClass = async (id: number) => {
    setError('')
    try {
      await api.delete(`/teacher/classes/${id}`)
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  const addStudent = async (id: number) => {
    const email = (studentEmail[id] ?? '').trim()
    if (!email) return
    setError('')
    try {
      await api.post(`/teacher/classes/${id}/students`, { email })
      setStudentEmail((prev) => ({ ...prev, [id]: '' }))
      await load()
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }

  if (loading) {
    return <div className="page-shell text-muted-foreground">Dang tai lop hoc...</div>
  }

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl">
        <div className="page-header">
          <h1 className="page-title">Quan ly lop hoc</h1>
          <button className="btn-outline btn-sm" onClick={() => router.push('/teacher')}>
            Ve dashboard
          </button>
        </div>

        {error ? <div className="mb-4 alert-error">{error}</div> : null}

        <div className="section-card mb-6 form-row">
          <input
            className="input flex-1"
            placeholder="Ten lop moi"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-primary btn-md" onClick={createClass}>
            Tao lop
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">Chua co lop hoc nao.</div>
        ) : (
          <div className="space-y-4">
            {items.map((c) => (
              <div key={c.id} className="section-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      Hoc vien: {c.studentCount} · Quiz: {c.quizCount}
                    </p>
                  </div>
                  <button className="btn-outline btn-sm" onClick={() => deleteClass(c.id)}>
                    Xoa lop
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Email hoc vien"
                    value={studentEmail[c.id] ?? ''}
                    onChange={(e) => setStudentEmail((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  />
                  <button className="btn-secondary btn-sm" onClick={() => addStudent(c.id)}>
                    Them hoc vien
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

