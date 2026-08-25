/**
 * Cơ chế lượt trong phòng thi nói (turn-gate):
 *   1. AI (Prüfer/Partner) đang nói → dải trạng thái báo "đang nói", nút nói/text bị khoá.
 *   2. TTS phát xong → dải chuyển "Đến lượt bạn nói!", nút mở lại.
 *   3. Gửi lượt text → partner AI trả lời → mic khoá suốt lúc partner nói, mở lại khi xong.
 * TTS được mock bằng deferred promise để điều khiển "đang nói / nói xong" tất định;
 * stopExamTts mock giữ đúng hợp đồng thật: resolve mọi promise đang treo.
 * Catalog vi THẬT → test canh luôn thiếu khoá i18n turn.*.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
  choose: vi.fn(),
  saveNotes: vi.fn(),
}))
vi.mock('@/lib/examSpeakingApi', () => ({ examSpeakingApi: api }))

const tts = vi.hoisted(() => {
  const pending: Array<() => void> = []
  return {
    pending,
    speakExamLine: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve)
        }),
    ),
    // Hợp đồng thật của stopExamTts: promise đang treo PHẢI resolve (nếu không mic khoá vĩnh viễn).
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

/** Phát xong lời AI đang treo đầu hàng đợi. */
async function finishSpeaking() {
  const resolve = tts.pending.shift()
  expect(resolve, 'phải có một lời AI đang phát').toBeTruthy()
  resolve!()
}

const NOW = new Date()
const deadline = new Date(NOW.getTime() + 240_000).toISOString()

function drillSession(step: number) {
  return {
    id: 501,
    provider: 'GOETHE',
    level: 'A1',
    mode: 'DRILL',
    state: 'IN_PART',
    currentPart: 2,
    currentStep: step,
    totalParts: 1,
    serverNow: NOW.toISOString(),
    prepDeadlineAt: null,
    partDeadlineAt: deadline,
    directive: {
      teilNo: 2,
      title: 'Um Informationen bitten',
      archetype: 'CARD_QA',
      stepIndex: step,
      stepCount: 4,
      candidateAction: 'ASK',
      hintVi: 'Đặt MỘT câu hỏi về từ trên thẻ.',
      stimulus: { type: 'THEME_CARD', thema: 'Essen', wort: 'Brot' },
      prueferText: 'Teil 2: Ihre erste Karte.',
      prueferVoice: 'PRUEFER',
      lastAiRole: null,
      lastAiText: null,
    },
    lastTurnEval: null,
    notesText: null,
    gradingJobId: null,
    resultAvailable: false,
  }
}

function renderRoom() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <ExamRoom sessionId={501} catalogHref="/v2/student/speaking/exam" />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  tts.pending.splice(0)
  api.getSession.mockResolvedValue({ data: drillSession(0) })
  api.listBlueprints.mockResolvedValue({ data: [] })
})

describe('Cơ chế lượt phòng thi nói', () => {
  it('Prüfer đang nói → khoá mic + báo trạng thái; nói xong → "Đến lượt bạn"', async () => {
    renderRoom()

    // Lời chào Teil của Prüfer bắt đầu phát → dải trạng thái + mic khoá.
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledWith('PRUEFER', 'Teil 2: Ihre erste Karte.'))
    const status = await screen.findByTestId('turn-status')
    expect(status.textContent).toContain('Giám khảo đang nói')
    expect(screen.getByTestId('mic-start')).toBeDisabled()

    // Phát xong → mở khoá + thông báo đến lượt.
    await finishSpeaking()
    await waitFor(() => expect(screen.getByTestId('turn-status').textContent).toContain('Đến lượt bạn nói'))
    expect(screen.getByTestId('mic-start')).toBeEnabled()
  })

  it('gửi lượt text → partner AI nói → khoá đến khi partner nói xong', async () => {
    api.textTurn.mockResolvedValue({
      data: {
        transcript: 'Isst du gern Brot?',
        aiRole: 'PARTNER',
        aiText: 'Ja, ich esse gern Brot.',
        aiVoice: 'PARTNER',
        turnEval: null,
        session: drillSession(1),
      },
    })
    const user = userEvent.setup()
    renderRoom()

    await screen.findByTestId('turn-status')
    await finishSpeaking() // Prüfer chào xong
    await waitFor(() => expect(screen.getByTestId('mic-start')).toBeEnabled())

    // Drill cho phép gõ text thay mic.
    await user.click(screen.getByTestId('mic-text-mode'))
    await user.type(screen.getByTestId('mic-text-input'), 'Isst du gern Brot?')
    await user.click(screen.getByTestId('mic-text-send'))

    // Partner bắt đầu nói → trạng thái + input khoá.
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledWith('PARTNER', 'Ja, ich esse gern Brot.'))
    expect(screen.getByTestId('turn-status').textContent).toContain('Bạn thi (AI) đang nói')
    expect(screen.getByTestId('mic-text-input')).toBeDisabled()
    expect(screen.getByTestId('mic-text-send')).toBeDisabled()

    // Partner nói xong → đến lượt mình.
    await finishSpeaking()
    await waitFor(() => expect(screen.getByTestId('turn-status').textContent).toContain('Đến lượt bạn nói'))
    expect(screen.getByTestId('mic-text-input')).toBeEnabled()
  })

  it('bấm "Sang phần kế" khi AI đang nói → cắt lời, không kẹt khoá', async () => {
    api.advance.mockResolvedValue({ data: drillSession(2) })
    const user = userEvent.setup()
    renderRoom()

    await screen.findByTestId('turn-status')
    expect(screen.getByTestId('turn-status').textContent).toContain('Giám khảo đang nói')

    // Nút advance là lối thoát: không bị khoá bởi aiSpeaking.
    await user.click(screen.getByTestId('advance-part'))
    expect(tts.stopExamTts).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('mic-start')).toBeEnabled())
  })
})
