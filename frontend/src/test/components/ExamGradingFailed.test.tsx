/**
 * ExamRoom — đường THẤT BẠI của chấm nền (gói vá F-01/F-19):
 *
 *   1. state GRADING_FAILED → thông báo lỗi thật + nút "Chấm lại" gọi API regrade và quay về
 *      màn GRADING (poll sẵn có tự nối) — trước bản vá học viên chỉ thấy spinner vĩnh viễn.
 *   2. state RESULTS nhưng tải phiếu lỗi → nút thử lại phải REFETCH thật (trước đây chỉ đóng
 *      banner, thân trang trống vĩnh viễn).
 *
 * Catalog vi THẬT → canh luôn các khoá i18n room.gradingFailed / regradeCta / retryResult.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { ExamRoom } from '@/components/features/exam-speaking/ExamRoom'

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  listBlueprints: vi.fn(),
  getResult: vi.fn(),
  textTurn: vi.fn(),
  audioTurn: vi.fn(),
  advance: vi.fn(),
  finish: vi.fn(),
  regrade: vi.fn(),
  choose: vi.fn(),
  saveNotes: vi.fn(),
}))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))
vi.mock('@/lib/exam/clientTurnId', () => ({ newClientTurnId: () => 'turn-test' }))

vi.mock('@/components/features/exam-speaking/examTts', () => ({
  speakExamLine: vi.fn(async () => {}),
  stopExamTts: vi.fn(),
  setExamTtsMuted: vi.fn(),
  isExamTtsMuted: vi.fn(() => false),
}))
vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => 'granted' }))
vi.mock('@/components/features/exam-speaking/Ergebnisbogen', () => ({
  Ergebnisbogen: () => <div data-testid="ergebnisbogen" />,
}))

const NOW = new Date()

function session(state: string, extra: Record<string, unknown> = {}) {
  return {
    id: 601,
    provider: 'GOETHE',
    level: 'A1',
    mode: 'MOCK',
    state,
    currentPart: 3,
    currentStep: 0,
    totalParts: 3,
    serverNow: NOW.toISOString(),
    prepDeadlineAt: null,
    partDeadlineAt: null,
    directive: null,
    lastTurnEval: null,
    notesText: null,
    gradingJobId: 9001,
    resultAvailable: false,
    ...extra,
  }
}

function renderRoom() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <ExamRoom sessionId={601} catalogHref="/v2/student/speaking/exam" />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listBlueprints.mockResolvedValue({ data: [] })
})

describe('ExamRoom — chấm nền thất bại (GRADING_FAILED)', () => {
  it('hiện thông báo lỗi + mô tả, KHÔNG phải spinner "đang chấm"', async () => {
    api.getSession.mockResolvedValue({ data: session('GRADING_FAILED') })
    renderRoom()

    expect(await screen.findByTestId('exam-grading-failed')).toBeInTheDocument()
    expect(screen.getByText(/Chấm điểm bị lỗi/)).toBeInTheDocument()
    expect(screen.getByText(/không phải thi lại/)).toBeInTheDocument()
    expect(screen.queryByTestId('exam-grading')).not.toBeInTheDocument()
  })

  it('bấm "Chấm lại" → gọi API regrade, quay về màn đang chấm (GRADING)', async () => {
    api.getSession.mockResolvedValue({ data: session('GRADING_FAILED') })
    api.regrade.mockResolvedValue({ data: session('GRADING', { gradingJobId: 9002 }) })
    renderRoom()

    const btn = await screen.findByTestId('regrade-btn')
    await act(async () => {
      await userEvent.click(btn)
    })

    expect(api.regrade).toHaveBeenCalledWith(601)
    expect(await screen.findByTestId('exam-grading')).toBeInTheDocument()
    expect(screen.queryByTestId('exam-grading-failed')).not.toBeInTheDocument()
  })

  it('F-08: gradingError=QUOTA_EXCEEDED → thông điệp hết ngân sách + link nạp/nâng cấp, vẫn có nút Chấm lại', async () => {
    api.getSession.mockResolvedValue({ data: session('GRADING_FAILED', { gradingError: 'QUOTA_EXCEEDED' }) })
    renderRoom()

    expect(await screen.findByTestId('exam-grading-failed')).toBeInTheDocument()
    expect(screen.getByText(/ngân sách AI của bạn đã hết/)).toBeInTheDocument()
    expect(screen.queryByText(/Chấm điểm bị lỗi/)).not.toBeInTheDocument()
    expect(screen.getByTestId('quota-upgrade-link')).toHaveAttribute('href', '/v2/student/tuition')
    expect(screen.getByTestId('regrade-btn')).toBeEnabled()
  })

  it('regrade lỗi (409/mạng) → banner lỗi, vẫn còn nút để thử tiếp', async () => {
    api.getSession.mockResolvedValue({ data: session('GRADING_FAILED') })
    api.regrade.mockRejectedValue(new Error('Network Error'))
    renderRoom()

    const btn = await screen.findByTestId('regrade-btn')
    await act(async () => {
      await userEvent.click(btn)
    })

    expect(await screen.findByTestId('exam-grading-failed')).toBeInTheDocument()
    expect(screen.getByTestId('regrade-btn')).toBeEnabled()
  })
})

describe('ExamRoom — RESULTS nhưng tải phiếu lỗi (F-19)', () => {
  it('nút thử lại REFETCH thật: lần hai thành công thì phiếu hiện ra', async () => {
    api.getSession.mockResolvedValue({ data: session('RESULTS') })
    api.getResult
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ data: { sessionId: 601, total: 20, max: 25, passed: true, scoreSheet: { parts: [] } } })
    renderRoom()

    // load() đầu: getResult lỗi → panel thử lại thay vì thân trang trống
    const panel = await screen.findByTestId('result-load-failed')
    expect(panel).toBeInTheDocument()

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Tải lại phiếu điểm/ }))
    })

    expect(api.getResult).toHaveBeenCalledTimes(2)
    expect(await screen.findByTestId('ergebnisbogen')).toBeInTheDocument()
    expect(screen.queryByTestId('result-load-failed')).not.toBeInTheDocument()
  })
})
