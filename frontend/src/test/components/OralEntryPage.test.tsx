/**
 * Lối vào phòng thi nói `/v2/student/mock-exam/oral` (Đợt 2 phòng thi nói):
 *   - thi thử, lần đầu (chưa qua màn kiểm tra) → màn Kiểm tra micro, CHƯA tạo phiên;
 *   - thi thử, micro đã cho phép + đã qua màn kiểm tra → tạo phiên ngay, chuyển vào phòng kèm return;
 *   - luyện Teil → tạo phiên ngay với đúng Teil;
 *   - tạo phiên lỗi → thông báo + thử lại.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import OralEntryPage from '@/app/v2/student/mock-exam/oral/page'

const api = vi.hoisted(() => ({ listBlueprints: vi.fn(), createSession: vi.fn() }))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))
vi.mock('@/lib/api', () => ({ apiMessage: () => 'Hết lượt thi thử trong tháng', default: {} }))

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const tours = vi.hoisted(() => ({ seen: new Set<string>(), markTourSeen: vi.fn() }))
vi.mock('@/lib/uiToursApi', () => ({
  loadSeenTours: () => Promise.resolve(tours.seen),
  markTourSeen: tours.markTourSeen,
}))

const perm = vi.hoisted(() => ({ state: 'granted' as string }))
vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => perm.state }))
vi.mock('@/components/features/exam-speaking/examTts', () => ({ speakExamLine: vi.fn(() => Promise.resolve()), stopExamTts: vi.fn() }))

function setUrl(search: string) {
  window.history.replaceState(null, '', `/v2/student/mock-exam/oral${search}`)
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi, ...chromeVi } }}>
      <OralEntryPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  tours.seen = new Set()
  perm.state = 'granted'
  api.listBlueprints.mockResolvedValue({ data: [{ id: 9, provider: 'TELC', level: 'B1', title: 'telc Deutsch B1', prepSec: 1200, parts: [] }] })
  api.createSession.mockResolvedValue({ data: { id: 88 } })
})
afterEach(() => setUrl(''))

describe('Lối vào phòng thi nói', () => {
  it('thi thử lần đầu → màn Kiểm tra micro, chưa tạo phiên; nút vào khoá tới khi micro đạt', async () => {
    setUrl('?provider=TELC&level=B1&mode=MOCK')
    renderPage()
    expect(await screen.findByTestId('oral-mic-check')).toBeInTheDocument()
    expect(screen.getByText('Kiểm tra trước khi thi nói')).toBeInTheDocument()
    expect(screen.getByTestId('oral-entry-go')).toBeDisabled()
    expect(screen.getByTestId('oral-entry-go').textContent).toContain('Vào phòng chuẩn bị')
    expect(api.createSession).not.toHaveBeenCalled()
    expect(document.body.getAttribute('data-immersive-mode')).toBe('on')
  })

  it('thi thử, micro đã cho phép và đã qua màn kiểm tra → tạo phiên ngay, vào phòng kèm return', async () => {
    tours.seen = new Set(['exam.oralMicCheck'])
    setUrl('?provider=TELC&level=B1&mode=MOCK&return=%2Fv2%2Fstudent%2Fmock-exam%2Fpractice%3FexamId%3D7')
    renderPage()
    await waitFor(() => expect(api.createSession).toHaveBeenCalledWith({ provider: 'TELC', level: 'B1', mode: 'MOCK', teil: undefined, prepMode: undefined }))
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/v2/student/mock-exam/oral/88?return=%2Fv2%2Fstudent%2Fmock-exam%2Fpractice%3FexamId%3D7'),
    )
    expect(screen.queryByTestId('oral-mic-check')).not.toBeInTheDocument()
  })

  it('đã qua màn kiểm tra nhưng micro bị chặn → vẫn phải kiểm tra lại', async () => {
    tours.seen = new Set(['exam.oralMicCheck'])
    perm.state = 'denied'
    setUrl('?mode=MOCK')
    renderPage()
    expect(await screen.findByTestId('oral-mic-check')).toBeInTheDocument()
    expect(api.createSession).not.toHaveBeenCalled()
  })

  it('luyện Teil → tạo phiên ngay với đúng Teil, không qua màn kiểm tra', async () => {
    perm.state = 'prompt'
    setUrl('?provider=GOETHE&level=A1&mode=DRILL&teil=2')
    renderPage()
    await waitFor(() => expect(api.createSession).toHaveBeenCalledWith({ provider: 'GOETHE', level: 'A1', mode: 'DRILL', teil: 2, prepMode: undefined }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/v2/student/mock-exam/oral/88?return=%2Fv2%2Fstudent%2Fexam'))
  })

  it('tạo phiên lỗi → báo lỗi, bấm thử lại thì tạo lại', async () => {
    api.createSession.mockRejectedValueOnce(new Error('quota'))
    setUrl('?mode=DRILL&teil=1')
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByTestId('oral-entry-error')).toBeInTheDocument()
    expect(screen.getByText('Hết lượt thi thử trong tháng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Thử lại/ }))
    await waitFor(() => expect(api.createSession).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(router.replace).toHaveBeenCalled())
  })
})
