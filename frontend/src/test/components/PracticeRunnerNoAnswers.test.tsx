import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A3 — runner luyện kỹ năng (/v2/student/practice/[nodeId]/[skill]) KHÔNG nhận đáp án trước khi trả lời.
 *
 * Đề đến từ GET …/quiz (không `correct_index`/`correct_answer`/giải thích). Đúng/sai từng câu do
 * server chấm qua POST …/check ngay sau khi trả lời; giải thích chỉ về qua GET …/review sau khi nộp.
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

vi.mock('next/navigation', () => ({
  useParams: () => ({ nodeId: '106', skill: 'lesen' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('@/hooks/usePageTimeTracker', () => ({ usePageTimeTracker: () => {} }))
// `me` phải ổn định giữa các lần render — nó nằm trong deps của effect tải đề.
const ME = { id: 1, email: 'hocvien@example.com' }
vi.mock('@/hooks/useStudentPracticeSession', () => ({
  useStudentPracticeSession: () => ({ me: ME, loading: false }),
}))

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}))

/** Đúng như backend PracticeSessionQuizService.quiz: đã ẩn đáp án, có `answer_mode`. */
const QUIZ = {
  sessionId: 42,
  skillType: 'LESEN',
  generation: 1,
  status: 'ACTIVE',
  scorePercent: 0,
  sourceNodeTitle: 'Einladung',
  sourceNodeTitleVi: 'Lời mời',
  exercises: {
    reading_passage: { text_type: 'E-Mail', text_de: 'Liebe Nachbarn, wir feiern am Samstag.' },
    exercises: [
      {
        type: 'READ_AND_CHOOSE',
        instruction_de: 'Lies und wähle.',
        question_de: 'Wen lädt Frau Weber ein?',
        options: ['Die Kollegen', 'Die Nachbarn', 'Die Familie'],
        answer_mode: 'choice',
      },
      {
        type: 'READ_AND_FILL',
        instruction_de: 'Ergänze.',
        sentence_with_blank: 'Die Party ist am ___.',
        answer_mode: 'text',
      },
    ],
  },
}

const REVIEW = {
  sessionId: 42,
  status: 'COMPLETED',
  exercises: [
    { correct_index: 1, explanation_vi: 'Trong thư nói: Liebe Nachbarn = hàng xóm.' },
    { correct_answer: 'Samstag', explanation_vi: 'am Samstag = vào thứ Bảy.' },
  ],
}

async function renderPage() {
  const { default: Page } = await import('@/app/v2/student/practice/[nodeId]/[skill]/page')
  return render(<Page />)
}

describe('skill practice runner (A3: no answer key before answering)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    apiGet.mockReset()
    apiPost.mockReset()
    apiGet.mockImplementation((url: string) => {
      if (url === '/skill-tree/practice/42/quiz') return Promise.resolve({ data: QUIZ })
      if (url === '/skill-tree/practice/42/review') return Promise.resolve({ data: REVIEW })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    apiPost.mockImplementation((url: string, body: { answers?: Record<string, unknown> }) => {
      if (url === '/skill-tree/106/practice/LESEN/start') return Promise.resolve({ data: { sessionId: 42 } })
      if (url === '/skill-tree/practice/42/check') {
        const results: Record<string, unknown> = {}
        for (const [idx, answer] of Object.entries(body.answers ?? {})) {
          results[idx] = idx === '0' ? { correct: answer === 1, correctIndex: 1 } : { correct: answer === 'Samstag' }
        }
        return Promise.resolve({ data: { results } })
      }
      if (url === '/skill-tree/practice/42/submit') {
        return Promise.resolve({ data: { scorePercent: 50, xpEarned: 0, status: 'COMPLETED' } })
      }
      return Promise.reject(new Error(`unexpected POST ${url}`))
    })
  })

  it('renders the answer-free quiz without touching the legacy detail endpoint', async () => {
    await renderPage()

    expect(await screen.findByText('Wen lädt Frau Weber ein?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nhập câu trả lời…')).toBeInTheDocument() // answer_mode: text
    expect(apiGet.mock.calls.map((c) => c[0])).not.toContain('/skill-tree/practice/42')
    expect(screen.queryByText(/hàng xóm/)).toBeNull()
  })

  it('grades each answer on the server and reveals explanations only after submit', async () => {
    const user = userEvent.setup()
    await renderPage()
    await screen.findByText('Wen lädt Frau Weber ein?')

    await user.click(screen.getByRole('radio', { name: /Die Kollegen/ }))
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/skill-tree/practice/42/check', { answers: { 0: 0 } }),
    )
    // Server bảo sai và chỉ phương án đúng → nút đó bị khoá (đã trả lời).
    await waitFor(() => expect(screen.getByRole('radio', { name: /Die Nachbarn/ })).toHaveAttribute('aria-disabled', 'true'))
    // A7: đúng/sai nói bằng chữ trong tên nút, không chỉ bằng màu viền.
    expect(screen.getByRole('radio', { name: /Die Kollegen.*Bạn chọn · sai/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Die Nachbarn.*Đáp án đúng/ })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Nhập câu trả lời…'), 'Samstag')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/skill-tree/practice/42/check', { answers: { 1: 'Samstag' } }),
    )

    // Chưa nộp → chưa có giải thích.
    expect(screen.queryByText(/hàng xóm/)).toBeNull()

    await user.click(await screen.findByRole('button', { name: /Nộp bài · 1\/2 đúng/ }))

    expect(await screen.findByText('Trong thư nói: Liebe Nachbarn = hàng xóm.')).toBeInTheDocument()
    expect(screen.getByText('am Samstag = vào thứ Bảy.')).toBeInTheDocument()
    expect(screen.getByText('Chưa đúng')).toBeInTheDocument()
    expect(screen.getByText('Chính xác!')).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/skill-tree/practice/42/review')
  })

  it('keeps the item unanswered when the check call fails', async () => {
    apiPost.mockImplementation((url: string) => {
      if (url === '/skill-tree/106/practice/LESEN/start') return Promise.resolve({ data: { sessionId: 42 } })
      return Promise.reject(new Error('network'))
    })
    const user = userEvent.setup()
    await renderPage()
    await screen.findByText('Wen lädt Frau Weber ein?')

    await user.click(screen.getByRole('radio', { name: /Die Kollegen/ }))

    expect(await screen.findByText('Chưa chấm được câu này — thử trả lời lại.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Die Nachbarn/ })).not.toHaveAttribute('aria-disabled')
  })
})
