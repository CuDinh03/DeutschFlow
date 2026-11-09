import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A3 — thư viện bài tập bổ trợ (/v2/student/exercises/[id]) KHÔNG nhận đáp án trước khi nộp.
 *
 * Đề đến từ GET /practice/catalog/{id} (không `correctAnswer`/`explanation`); trang vẫn hiện đúng/sai,
 * phương án đúng và giải thích — nhưng chỉ SAU khi POST …/grade trả về.
 */

// Translator ỔN ĐỊNH theo namespace (như next-intl thật): trang đặt `t` vào deps của
// useCallback/useEffect, translator mới mỗi lần render sẽ làm effect tải đề chạy lặp vô hạn.
vi.mock('next-intl', async () => {
  const mock = (await import('@/test/intlCatalog')).nextIntlCatalogMock()
  const cache = new Map<string | undefined, ReturnType<typeof mock.useTranslations>>()
  return {
    ...mock,
    useTranslations: (ns?: string) => {
      if (!cache.has(ns)) cache.set(ns, mock.useTranslations(ns))
      return cache.get(ns)!
    },
  }
})

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '10' }),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackFeatureAction: vi.fn() }) }))

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  apiMessage: (e: unknown) => String(e),
}))

/** Đúng như backend PracticeQuizDto: KHÔNG có trường đáp án nào. */
const QUIZ = {
  id: 10,
  exerciseType: 'NORMAL',
  cefrLevel: 'A1',
  skillType: 'READING',
  examName: 'Artikel A1',
  sourceName: 'DeutschFlow',
  sourceUrl: null,
  xpReward: 100,
  title: 'Artikel',
  instructions: 'Wähle den Artikel.',
  readingText: null,
  gradableCount: 2,
  questions: [
    { id: 'q1', type: 'mc', question: '___ Haus', options: ['der', 'die', 'das'], gradable: true },
    { id: 'q2', type: 'mc', question: '___ Frau', options: ['der', 'die', 'das'], gradable: true },
  ],
}

const GRADE = {
  graded: true,
  correctCount: 1,
  total: 2,
  scorePercent: 50,
  questions: [
    { id: 'q1', correct: false, correctAnswer: 'das', explanation: 'Haus ist neutral.' },
    { id: 'q2', correct: true, correctAnswer: 'die', explanation: 'Frau ist feminin.' },
  ],
}

async function renderPage() {
  const { default: Page } = await import('@/app/v2/student/exercises/[id]/page')
  return render(<Page />)
}

describe('exercise runner (A3: no answer key before submit)', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiGet.mockImplementation((url: string) => {
      if (url === '/practice/catalog/10') return Promise.resolve({ data: QUIZ })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    apiPost.mockImplementation((url: string) => {
      if (url === '/practice/catalog/10/grade') return Promise.resolve({ data: GRADE })
      return Promise.reject(new Error(`unexpected POST ${url}`))
    })
  })

  it('renders the questions from the answer-free quiz and calls only the new endpoints', async () => {
    await renderPage()

    expect(await screen.findByText(/___ Haus/)).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/practice/catalog/10')
    expect(apiGet.mock.calls.map((c) => c[0])).not.toContain('/practice/exercises/10')
    // Trước khi nộp: không có phán quyết, không có giải thích.
    expect(screen.queryByText('Haus ist neutral.')).toBeNull()
    expect(screen.queryByText('Đúng')).toBeNull()
  })

  it('shows right/wrong and explanations only after the server grades the submission', async () => {
    const user = userEvent.setup()
    await renderPage()
    await screen.findByText(/___ Haus/)

    const dieButtons = screen.getAllByRole('button', { name: 'die' })
    await user.click(dieButtons[0]) // q1 — sai
    await user.click(dieButtons[1]) // q2 — đúng
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }))

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/practice/catalog/10/grade', { answers: { q1: 'die', q2: 'die' } }),
    )
    expect(await screen.findByText('Haus ist neutral.')).toBeInTheDocument()
    expect(screen.getByText('Frau ist feminin.')).toBeInTheDocument()
    expect(screen.getByText('Đúng 1/2 câu')).toBeInTheDocument()
    expect(screen.getByText('Sai')).toBeInTheDocument()
    expect(screen.getByText('Đúng')).toBeInTheDocument()
    // Không có lời gọi nào tới API cũ (trả contentJson kèm đáp án) hay POST /practice/submit tự báo điểm.
    expect(apiPost.mock.calls.map((c) => c[0])).not.toContain('/practice/submit')
  })

  it('shows the XP the server actually awarded (external resource: fixed small XP)', async () => {
    const external = { ...QUIZ, gradableCount: 0, questions: [], sourceUrl: 'https://example.org/aufgabe' }
    apiGet.mockImplementation(() => Promise.resolve({ data: external }))
    apiPost.mockImplementation(() =>
      Promise.resolve({
        data: { graded: false, correctCount: 0, total: 0, scorePercent: 100, xpEarned: 5, questions: [] },
      }),
    )
    const user = userEvent.setup()
    await renderPage()

    await user.click(await screen.findByRole('button', { name: 'Đánh dấu hoàn thành' }))

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/practice/catalog/10/grade', { answers: {}, scorePercent: 100 }),
    )
    expect(await screen.findByText('100% · +5 XP')).toBeInTheDocument()
    expect(screen.queryByText('100% · +100 XP')).toBeNull()
  })

  it('falls back to score × xpReward when the backend does not report xpEarned', async () => {
    apiPost.mockImplementation(() =>
      Promise.resolve({ data: { ...GRADE, xpEarned: undefined } }),
    )
    const user = userEvent.setup()
    await renderPage()
    await screen.findByText(/___ Haus/)

    const dasButtons = screen.getAllByRole('button', { name: 'das' })
    await user.click(dasButtons[0])
    await user.click(dasButtons[1])
    await user.click(screen.getByRole('button', { name: 'Nộp bài' }))

    // Điểm hiển thị là của server (50%), không phải tự chấm trên trình duyệt.
    expect(await screen.findByText('50% · +50 XP')).toBeInTheDocument()
  })
})
