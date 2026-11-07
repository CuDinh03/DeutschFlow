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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  getTranscript: vi.fn(),
}))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))

const tours = vi.hoisted(() => ({ seen: new Set<string>(['exam.oral']), markTourSeen: vi.fn() }))
vi.mock('@/lib/uiToursApi', () => ({
  loadSeenTours: () => Promise.resolve(tours.seen),
  markTourSeen: tours.markTourSeen,
}))

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
      <ExamRoom sessionId={701} returnHref="/v2/student/exam" />
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
  tours.seen = new Set(['exam.oral'])
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

function prepSession(chosenIndex: number | null) {
  return {
    ...mockSession(1),
    state: 'PREP',
    directive: null,
    partDeadlineAt: null,
    prepDeadlineAt: new Date(NOW.getTime() + 600_000).toISOString(),
    prepSec: 1200,
    notesText: 'Freitag?',
    prepMaterials: [
      {
        teilNo: 2,
        title: 'Über ein Thema sprechen',
        archetype: 'DEBATE',
        choiceRequired: true,
        chosenIndex,
        stimuli: [
          { type: 'PROMPT_CARD', thema: 'Handy in der Schule', prompts: ['Vorteile?'] },
          { type: 'PROMPT_CARD', thema: 'Homeoffice', prompts: ['Nachteile?'] },
        ],
      },
    ],
  }
}

describe('Phòng thi nói — màn Chuẩn bị', () => {
  it('toàn màn hình, đề bên trái + thứ tự thi bên phải; phải chọn chủ đề rồi mới vào thi', async () => {
    api.getSession.mockResolvedValue({ data: prepSession(null) })
    api.choose.mockResolvedValue({ data: prepSession(1) })
    api.advance.mockResolvedValue({ data: mockSession(1) })
    const user = userEvent.setup()
    renderRoom()

    expect(await screen.findByTestId('oral-prep-room')).toBeInTheDocument()
    expect(document.body.getAttribute('data-immersive-mode')).toBe('on')
    expect(screen.getByRole('heading', { level: 1, name: 'Chuẩn bị' })).toBeInTheDocument()
    const order = screen.getByTestId('prep-order')
    expect(order.textContent).toContain('Kontakt aufnehmen')
    expect(order.textContent).toContain('6 phút')
    expect(screen.getByTestId('prep-notes')).toHaveValue('Freitag?')

    expect(screen.getByTestId('prep-enter')).toBeDisabled()
    await user.click(screen.getByTestId('choose-2-1'))
    await waitFor(() => expect(api.choose).toHaveBeenCalledWith(701, 2, 1))
    await waitFor(() => expect(screen.getByTestId('prep-enter')).toBeEnabled())
    await user.click(screen.getByTestId('prep-enter'))
    await waitFor(() => expect(api.advance).toHaveBeenCalledWith(701))
    expect(await screen.findByTestId('oral-room')).toBeInTheDocument()
  })

  it('X hỏi trước khi rời phòng chuẩn bị; Rời phòng thì về trang đã vào', async () => {
    api.getSession.mockResolvedValue({ data: prepSession(0) })
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } })
    try {
      const user = userEvent.setup()
      renderRoom()
      await user.click(await screen.findByTestId('prep-leave'))
      expect(await screen.findByText('Rời phòng chuẩn bị?')).toBeInTheDocument()
      expect(screen.getByText(/không được chấm/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Ở lại' }))
      expect(assign).not.toHaveBeenCalled()
      await user.click(screen.getByTestId('prep-leave'))
      await user.click(await screen.findByRole('button', { name: 'Rời phòng' }))
      expect(assign).toHaveBeenCalledWith('/v2/student/exam')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})

describe('Phòng thi nói — sau khi thi', () => {
  it('luyện đã xong mà mở lại trang → tổng kết dựng từ hội thoại đã lưu', async () => {
    api.getSession.mockResolvedValue({ data: { ...mockSession(2, 'DRILL'), state: 'DONE', directive: null } })
    api.getTranscript.mockResolvedValue({
      data: [
        { teilNo: 2, seq: 0, role: 'PRUEFER', text: 'Teil 2: Bitte beginnen Sie.', eval: null },
        { teilNo: 2, seq: 1, role: 'CANDIDATE', text: 'Ich finde Handys in der Schule gut.', eval: { score: 8, feedbackVi: 'Ý rõ.' } },
      ],
    })
    renderRoom()
    expect(await screen.findByTestId('oral-drill-done')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Luyện xong Teil 2')
    await waitFor(() => expect(api.getTranscript).toHaveBeenCalledWith(701))
    expect((await screen.findByTestId('drill-summary')).textContent).toContain('8')
    expect(document.body.getAttribute('data-immersive-mode')).toBeNull()
  })

  it('đang chấm → thẻ trạng thái có lối quay lại', async () => {
    api.getSession.mockResolvedValue({ data: { ...mockSession(3), state: 'GRADING', directive: null } })
    renderRoom()
    const card = await screen.findByTestId('exam-grading')
    expect(card.textContent).toContain('Giám khảo đang chấm')
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/v2/student/exam')
  })
})

describe('Phòng thi nói — hướng dẫn lần đầu', () => {
  // jsdom không có layout: giả cho mọi vùng có kích thước để hướng dẫn tìm được chỗ khoanh.
  const rects = Element.prototype.getClientRects
  beforeEach(() => {
    Element.prototype.getClientRects = function () {
      return [{}] as unknown as DOMRectList
    }
  })
  afterEach(() => {
    Element.prototype.getClientRects = rects
  })

  it('lần đầu vào Đang thi: hướng dẫn tự mở, giám khảo chờ tới khi đóng', async () => {
    tours.seen = new Set()
    const user = userEvent.setup()
    renderRoom()
    const dialog = await screen.findByRole('dialog', {}, { timeout: 3000 })
    expect(dialog.textContent).toContain('Ba phần thi')
    expect(dialog.textContent).toContain('Đồng hồ vẫn chạy')
    expect(tours.markTourSeen).toHaveBeenCalledWith('exam.oral')
    expect(tts.speakExamLine).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledWith('PRUEFER', 'Teil 1: Bitte beginnen Sie.'))
  })

  it('đã xem: không tự mở, nút dấu hỏi mở lại', async () => {
    const user = userEvent.setup()
    renderRoom()
    await screen.findByTestId('oral-room')
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }))
    expect((await screen.findByRole('dialog')).textContent).toContain('Ba phần thi')
  })
})
