/**
 * Màn "Đang thi" của phòng thi nói theo mẫu 07/11/2026 (Đợt 1 phòng thi nói):
 *   - phòng toàn màn hình, hàng người (Giám khảo · Bạn thi AI · Bạn) — người đang nói có data-talking;
 *   - hội thoại có vạch "Teil n · tên" khi sang Teil mới;
 *   - thi thử: Kết thúc (X) và Sang Teil đều hỏi xác nhận; Teil cuối không có nút sang Teil;
 *   - luyện (drill): Kết thúc vẫn hỏi, "Sang phần kế" chạy ngay (lối thoát, xem ExamTurnGate.test).
 * Catalog vi THẬT → test canh luôn thiếu khoá i18n room.oral.*.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { ExamRoom } from '@/components/features/exam-speaking/ExamRoom'

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  listBlueprints: vi.fn(),
  getResult: vi.fn(),
  textTurn: vi.fn(),
  audioTurn: vi.fn(),
  advance: vi.fn(),
  finish: vi.fn(),
  choose: vi.fn(),
  saveNotes: vi.fn(),
}))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))

const tts = vi.hoisted(() => {
  const pending: Array<() => void> = []
  return {
    pending,
    speakExamLine: vi.fn(() => new Promise<void>((resolve) => pending.push(resolve))),
    stopExamTts: vi.fn(() => {
      pending.splice(0).forEach((resolve) => resolve())
    }),
    setExamTtsMuted: vi.fn(),
    isExamTtsMuted: vi.fn(() => false),
  }
})
vi.mock('@/components/features/exam-speaking/examTts', () => ({
  speakExamLine: tts.speakExamLine,
  stopExamTts: tts.stopExamTts,
  setExamTtsMuted: tts.setExamTtsMuted,
  isExamTtsMuted: tts.isExamTtsMuted,
}))

vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => 'granted' }))

const NOW = new Date()
const deadline = new Date(NOW.getTime() + 300_000).toISOString()

const BLUEPRINT = {
  id: 9,
  provider: 'TELC',
  level: 'B1',
  version: 1,
  title: 'telc Deutsch B1 · Mündliche Prüfung',
  prepSec: 1200,
  rubricScale: 'A_D',
  maxTotal: 75,
  speakingOnlyMin: 45,
  parts: [
    { teilNo: 1, archetype: 'CONTACT', title: 'Kontakt aufnehmen', durationSec: 180, flow: 'PAIR', hasPartner: true },
    { teilNo: 2, archetype: 'DEBATE', title: 'Über ein Thema sprechen', durationSec: 300, flow: 'PAIR', hasPartner: true },
    { teilNo: 3, archetype: 'PLAN', title: 'Gemeinsam etwas planen', durationSec: 360, flow: 'PAIR', hasPartner: true },
  ],
}

function mockSession(teil: number, mode: 'MOCK' | 'DRILL' = 'MOCK') {
  return {
    id: 701,
    provider: 'TELC',
    level: 'B1',
    mode,
    state: 'IN_PART',
    currentPart: teil,
    currentStep: 0,
    totalParts: 3,
    serverNow: NOW.toISOString(),
    prepDeadlineAt: null,
    prepSec: null,
    prepMaterials: null,
    partDeadlineAt: deadline,
    directive: {
      teilNo: teil,
      title: BLUEPRINT.parts[teil - 1].title,
      archetype: BLUEPRINT.parts[teil - 1].archetype,
      stepIndex: 0,
      stepCount: 6,
      candidateAction: 'SPEAK',
      hintVi: 'Nói theo đề.',
      hintKey: null,
      stimulus: null,
      prueferText: `Teil ${teil}: Bitte beginnen Sie.`,
      prueferVoice: 'PRUEFER',
      lastAiRole: null,
      lastAiText: null,
    },
    lastTurnEval: null,
    notesText: 'Freitag 15 Uhr?',
    gradingJobId: null,
    resultAvailable: false,
  }
}

function renderRoom() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi, ...chromeVi } }}>
      <ExamRoom sessionId={701} catalogHref="/v2/student/speaking/exam" />
    </NextIntlClientProvider>,
  )
}

async function finishSpeaking() {
  await waitFor(() => expect(tts.pending.length).toBeGreaterThan(0), { timeout: 5000 })
  tts.pending.shift()!()
}

beforeEach(() => {
  vi.clearAllMocks()
  tts.pending.splice(0)
  api.getSession.mockResolvedValue({ data: mockSession(1) })
  api.listBlueprints.mockResolvedValue({ data: [BLUEPRINT] })
})

describe('Phòng thi nói — màn Đang thi', () => {
  it('toàn màn hình, ẩn thanh điều hướng; hàng người đánh dấu ai đang nói', async () => {
    renderRoom()
    await screen.findByTestId('oral-room')
    expect(document.body.getAttribute('data-immersive-mode')).toBe('on')

    const people = screen.getByTestId('oral-people')
    expect(within(people).getByText('Giám khảo')).toBeInTheDocument()
    expect(within(people).getByText('Bạn thi')).toBeInTheDocument()
    await waitFor(() => expect(people.querySelector('[data-person="PRUEFER"]')).toHaveAttribute('data-talking', 'true'))
    expect(screen.getByTestId('turn-status').textContent).toContain('Giám khảo đang nói')

    await finishSpeaking()
    await waitFor(() => expect(people.querySelector('[data-person="PRUEFER"]')).toHaveAttribute('data-talking', 'false'))
    expect(screen.getByTestId('turn-status').textContent).toContain('Đến lượt bạn nói')
    expect(screen.getByTestId('turn-status').textContent).toContain('Nói theo đề')
    expect(screen.getByTestId('turn-count').textContent).toContain('1/6')
  })

  it('hội thoại có vạch Teil kèm tên Teil; thẻ đề có gợi ý và ghi chú nháp', async () => {
    renderRoom()
    const divider = await screen.findByTestId('transcript-teil')
    expect(divider.textContent).toContain('Teil 1 · Kontakt aufnehmen')
    expect(screen.getByTestId('exam-transcript').textContent).toContain('Teil 1: Bitte beginnen Sie.')
    expect(screen.getByTestId('directive-hint').textContent).toBe('Nói theo đề.')
    expect(screen.getByTestId('oral-task-card').textContent).toContain('Freitag 15 Uhr?')
  })

  it('thi thử: Kết thúc hỏi xác nhận — Thi tiếp thì không gọi finish, Kết thúc và chấm thì gọi', async () => {
    api.finish.mockResolvedValue({ data: { ...mockSession(1), state: 'GRADING', directive: null } })
    const user = userEvent.setup()
    renderRoom()
    await screen.findByTestId('oral-room')

    await user.click(screen.getByTestId('finish-session'))
    expect(await screen.findByText('Kết thúc phần nói?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thi tiếp' }))
    expect(api.finish).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('finish-session'))
    await user.click(await screen.findByRole('button', { name: 'Kết thúc và chấm' }))
    await waitFor(() => expect(api.finish).toHaveBeenCalledWith(701))
    expect(await screen.findByTestId('exam-grading')).toBeInTheDocument()
  })

  it('thi thử: Sang Teil hỏi xác nhận rồi mới gọi advance', async () => {
    api.advance.mockResolvedValue({ data: mockSession(2) })
    const user = userEvent.setup()
    renderRoom()
    await screen.findByTestId('oral-room')

    await user.click(screen.getByTestId('advance-part'))
    expect(api.advance).not.toHaveBeenCalled()
    expect(await screen.findByText('Không quay lại Teil 1 được nữa.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sang Teil 2' }))
    await waitFor(() => expect(api.advance).toHaveBeenCalledWith(701))
  })

  it('thi thử ở Teil cuối: không có nút sang Teil', async () => {
    api.getSession.mockResolvedValue({ data: mockSession(3) })
    renderRoom()
    await screen.findByTestId('oral-room')
    expect(screen.queryByTestId('advance-part')).not.toBeInTheDocument()
  })

  it('luyện: Kết thúc vẫn hỏi xác nhận với lời của chế độ luyện', async () => {
    api.getSession.mockResolvedValue({ data: mockSession(2, 'DRILL') })
    const user = userEvent.setup()
    renderRoom()
    await screen.findByTestId('oral-room')
    await user.click(screen.getByTestId('finish-session'))
    expect(await screen.findByText('Kết thúc buổi luyện?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Luyện tiếp' })).toBeInTheDocument()
  })
})
