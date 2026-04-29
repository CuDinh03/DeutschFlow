'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Quiz = {
  id: number
  title: string
  quizType: 'COLOR_RACE' | 'SENTENCE_BATTLE'
  status: 'DRAFT' | 'WAITING' | 'ACTIVE' | 'FINISHED'
  pinCode: string
  questionCount: number
  classroomName?: string | null
}

export default function TeacherQuizzesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Quiz[]>([])
  const [title, setTitle] = useState('')
  const [quizType, setQuizType] = useState<'COLOR_RACE' | 'SENTENCE_BATTLE'>('COLOR_RACE')
  const [questionText, setQuestionText] = useState<Record<number, string>>({})
  const [choiceA, setChoiceA] = useState<Record<number, string>>({})
  const [choiceB, setChoiceB] = useState<Record<number, string>>({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const me = await api.get('/auth/me')
      if (me.data.role !== 'TEACHER') {
        router.push(`/${String(me.data.role).toLowerCase()}`)
        return
      }
      const res = await api.get('/teacher/quizzes')
      setItems(res.data ?? [])
    } catch (e: any) {
      if (e?.response?.status === 401) {
        router.push('/login')
        return
      }
      setError('Khong the tai danh sach quiz.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createQuiz = async () => {
    if (!title.trim()) return
    setError('')
    try {
      await api.post('/teacher/quizzes', { title: title.trim(), quizType })
      setTitle('')
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Tao quiz that bai.')
    }
  }

  const updateStatus = async (id: number, action: 'publish' | 'start' | 'finish') => {
    setError('')
    try {
      await api.post(`/teacher/quizzes/${id}/${action}`)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Cap nhat trang thai that bai.')
    }
  }

  const addQuestion = async (id: number) => {
    const question = (questionText[id] ?? '').trim()
    const a = (choiceA[id] ?? '').trim()
    const b = (choiceB[id] ?? '').trim()
    if (!question || !a || !b) return
    setError('')
    try {
      await api.post(`/teacher/quizzes/${id}/questions`, {
        question,
        choices: [
          { content: a, isCorrect: true },
          { content: b, isCorrect: false },
        ],
      })
      setQuestionText((prev) => ({ ...prev, [id]: '' }))
      setChoiceA((prev) => ({ ...prev, [id]: '' }))
      setChoiceB((prev) => ({ ...prev, [id]: '' }))
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Them cau hoi that bai.')
    }
  }

  if (loading) {
    return <div className="page-shell text-muted-foreground">Dang tai quiz...</div>
  }

  return (
    <div className="page-shell">
      <div className="page-container max-w-5xl">
        <div className="page-header">
          <h1 className="page-title">Quan ly quiz</h1>
          <button className="btn-outline btn-sm" onClick={() => router.push('/teacher')}>
            Ve dashboard
          </button>
        </div>

        {error ? <div className="mb-4 alert-error">{error}</div> : null}

        <div className="section-card mb-6 form-grid">
          <input
            className="input md:col-span-2 lg:col-span-2"
            placeholder="Tieu de quiz"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="input" value={quizType} onChange={(e) => setQuizType(e.target.value as any)}>
            <option value="COLOR_RACE">COLOR_RACE</option>
            <option value="SENTENCE_BATTLE">SENTENCE_BATTLE</option>
          </select>
          <button className="btn-primary btn-md" onClick={createQuiz}>
            Tao quiz
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">Chua co quiz nao.</div>
        ) : (
          <div className="space-y-4">
            {items.map((q) => (
              <div key={q.id} className="section-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{q.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {q.quizType} · {q.status} · PIN {q.pinCode} · Cau hoi: {q.questionCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-outline btn-sm" onClick={() => updateStatus(q.id, 'publish')}>
                      Publish
                    </button>
                    <button className="btn-outline btn-sm" onClick={() => updateStatus(q.id, 'start')}>
                      Start
                    </button>
                    <button className="btn-outline btn-sm" onClick={() => updateStatus(q.id, 'finish')}>
                      Finish
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid md:grid-cols-4 gap-2">
                  <input
                    className="input md:col-span-2"
                    placeholder="Noi dung cau hoi"
                    value={questionText[q.id] ?? ''}
                    onChange={(e) => setQuestionText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Dap an dung"
                    value={choiceA[q.id] ?? ''}
                    onChange={(e) => setChoiceA((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Dap an sai"
                    value={choiceB[q.id] ?? ''}
                    onChange={(e) => setChoiceB((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                </div>
                <div className="mt-2">
                  <button className="btn-secondary btn-sm" onClick={() => addQuestion(q.id)}>
                    Them cau hoi 2 lua chon
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

