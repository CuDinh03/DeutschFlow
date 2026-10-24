/**
 * Đợt 3b — giáo viên đọc lời học viên trong bài nói (màn báo cáo học viên, tab Luyện nói).
 * Mock next-intl (trả về key, kèm tham số), next/navigation và lớp mạng `@/lib/api`;
 * TkTabs (Radix) và GaBtn chạy thật.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => {
  const t = (k: string, p?: Record<string, unknown>) => (p ? `${k}:${Object.values(p).join('|')}` : k)
  return { useLocale: () => 'vi', useTranslations: () => t }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '10', studentId: '200' }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('name=Lan'),
}))

const get = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))

import Page from '@/app/v2/teacher/classes/[id]/students/[studentId]/page'

const base = {
  cefrLevel: 'B1', status: 'ENDED', messageCount: 6, aiScore: 72, teacherScore: null,
  startedAt: '2026-10-20T09:00:00',
}
const SESSIONS = [
  { ...base, id: 30, topic: 'Bài nói 1', sessionMode: 'COMMUNICATION', assignmentId: 50 },
  { ...base, id: 31, topic: 'Luyện ở nhà', sessionMode: 'COMMUNICATION', assignmentId: null },
  { ...base, id: 32, topic: 'Phỏng vấn Pflege', sessionMode: 'INTERVIEW', assignmentId: null },
]

beforeEach(() => {
  get.mockReset()
  get.mockImplementation((url: string) => {
    if (url.endsWith('/speaking-sessions')) return Promise.resolve({ data: SESSIONS })
    if (url.endsWith('/assignments')) return Promise.resolve({ data: [] })
    if (url === '/v2/teacher/speaking-sessions/30') {
      return Promise.resolve({
        data: {
          ...SESSIONS[0],
          transcript: [
            { role: 'ASSISTANT', text: 'Erzählen Sie etwas über sich.', correction: null, createdAt: '2026-10-20T09:00:05' },
            { role: 'USER', text: 'Ich bin Pflegerin seit drei Jahre.', correction: 'Ich bin seit drei Jahren Pflegerin.', createdAt: '2026-10-20T09:00:20' },
          ],
        },
      })
    }
    return new Promise(() => {})
  })
})

async function openSpeakingTab() {
  const user = userEvent.setup()
  render(<Page />)
  await waitFor(() => expect(get).toHaveBeenCalledWith('/v2/teacher/students/200/speaking-sessions'))
  await user.click(screen.getByRole('tab', { name: /tabSpeaking/ }))
  await screen.findByText('Bài nói 1')
  return user
}

describe('V2 teacher student report — 3b transcript', () => {
  it('chỉ phiên gắn bài mới có nút xem lời học viên; nhãn phân biệt bài giao / luyện tự do / phỏng vấn', async () => {
    await openSpeakingTab()

    expect(screen.getAllByRole('button', { name: /transcriptShow/ })).toHaveLength(1)
    expect(screen.getByText(/^tagAssigned ·/)).toBeInTheDocument()
    expect(screen.getByText(/^tagFreePractice ·/)).toBeInTheDocument()
    expect(screen.getByText(/^tagInterview ·/)).toBeInTheDocument()
  })

  it('bấm xem → tải chi tiết đúng một lần, hiện lời học viên kèm câu sửa', async () => {
    const user = await openSpeakingTab()

    await user.click(screen.getByRole('button', { name: /transcriptShow/ }))

    expect(await screen.findByText('Ich bin Pflegerin seit drei Jahre.')).toBeInTheDocument()
    expect(screen.getByText('Erzählen Sie etwas über sich.')).toBeInTheDocument()
    expect(screen.getByText('transcriptCorrection:Ich bin seit drei Jahren Pflegerin.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/v2/teacher/speaking-sessions/30')

    // Ẩn rồi mở lại: dùng bản đã tải, không gọi mạng lần nữa.
    await user.click(screen.getByRole('button', { name: /transcriptHide/ }))
    await user.click(screen.getByRole('button', { name: /transcriptShow/ }))
    expect(get.mock.calls.filter(([u]) => u === '/v2/teacher/speaking-sessions/30')).toHaveLength(1)
  })

  it('lỗi tải chi tiết → hiện lỗi và cho thử lại', async () => {
    get.mockImplementation((url: string) => {
      if (url.endsWith('/speaking-sessions')) return Promise.resolve({ data: SESSIONS })
      if (url.endsWith('/assignments')) return Promise.resolve({ data: [] })
      return Promise.reject(new Error('Session không tồn tại'))
    })
    const user = await openSpeakingTab()

    await user.click(screen.getByRole('button', { name: /transcriptShow/ }))

    expect(await screen.findByText('Session không tồn tại')).toBeInTheDocument()
  })
})
