/**
 * ExamRoom — đường nộp lượt AUDIO (QA prod 26/08: banner "Tệp tải lên vượt quá giới hạn 25MB").
 *
 *   1. Không nộp trùng: hai blob về gần như cùng lúc thì chỉ MỘT lượt lên máy chủ. `busy` là
 *      state React nên cả hai đều thấy `false` trong cùng một tick — phải có chốt ref.
 *   2. 413 từ backend không được hiện nguyên văn thông điệp của Materials Library ("dùng luồng
 *      tải trực tiếp / presigned upload") — người học không có luồng đó, lời khuyên ấy vô nghĩa.
 *   3. Blob vượt trần phiên âm (8MB) bị chặn NGAY tại client: không đốt băng thông 3G của học
 *      viên để đổi lấy một lỗi đã biết trước.
 *
 * Catalog vi THẬT → canh luôn khoá i18n room.audioTooLarge.
 */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { ExamRoom } from '@/components/features/exam-speaking/ExamRoom'
import { MAX_TRANSCRIBE_BYTES } from '@/lib/voiceRecorder'

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
/** Khoá idempotency đoán được để assert "Gửi lại" dùng đúng khoá cũ. */
let turnSeq = 0
vi.mock('@/lib/exam/clientTurnId', () => ({ newClientTurnId: () => `turn-${++turnSeq}` }))

vi.mock('@/components/features/exam-speaking/examTts', () => ({
  speakExamLine: vi.fn(async () => {}),
  stopExamTts: vi.fn(),
  setExamTtsMuted: vi.fn(),
  isExamTtsMuted: vi.fn(() => false),
}))
vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => 'granted' }))

/** Bắt `onAudio` mà ExamRoom truyền xuống MicBar để gọi thẳng, không cần dựng MediaRecorder giả. */
let submitAudio: ((blob: Blob) => Promise<void>) | null = null
vi.mock('@/components/features/exam-speaking/MicBar', () => ({
  MicBar: (props: { onAudio: (blob: Blob) => Promise<void> }) => {
    submitAudio = props.onAudio
    return <div data-testid="mic-bar" />
  },
}))

const NOW = new Date()

const session = {
  id: 501,
  provider: 'GOETHE',
  level: 'A2',
  mode: 'DRILL',
  state: 'IN_PART',
  currentPart: 2,
  currentStep: 0,
  totalParts: 3,
  serverNow: NOW.toISOString(),
  prepDeadlineAt: null,
  partDeadlineAt: new Date(NOW.getTime() + 180_000).toISOString(),
  directive: {
    teilNo: 2,
    title: 'Von sich erzählen',
    archetype: 'ABOUT_ME',
    stepIndex: 0,
    stepCount: 3,
    candidateAction: 'SPEAK',
    hintVi: 'Kể về bản thân theo câu hỏi.',
    stimulus: { type: 'PROMPT_CARD', frage: 'Was machen Sie in Ihrer Freizeit?' },
    prueferText: null,
    prueferVoice: 'PRUEFER',
    lastAiRole: null,
    lastAiText: null,
  },
  lastTurnEval: null,
  notesText: null,
  gradingJobId: null,
  resultAvailable: false,
}

const turnResponse = {
  data: {
    transcript: 'Ich spiele gern Fußball.',
    aiRole: 'PRUEFER',
    aiText: 'Danke schön.',
    aiVoice: 'PRUEFER',
    turnEval: null,
    aiTurns: [],
    session,
  },
}

function axios413() {
  return Object.assign(new Error('Request failed with status code 413'), {
    isAxiosError: true,
    response: {
      status: 413,
      data: {
        detail: 'Tệp tải lên vượt quá giới hạn 25MB. Với tệp lớn hơn, hãy dùng luồng tải trực tiếp (presigned upload).',
      },
    },
  })
}

async function renderRoom() {
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <ExamRoom sessionId={501} catalogHref="/v2/student/speaking/exam" />
    </NextIntlClientProvider>,
  )
  await screen.findByTestId('mic-bar')
  expect(submitAudio, 'ExamRoom phải truyền onAudio xuống MicBar').toBeTruthy()
}

/** Gọi đúng đường mà MicBar gọi, có bọc act để React flush hết state của lượt nộp. */
async function send(blob: Blob) {
  await act(async () => {
    await submitAudio!(blob)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  turnSeq = 0
  submitAudio = null
  api.getSession.mockResolvedValue({ data: session })
  api.listBlueprints.mockResolvedValue({ data: [] })
})

describe('ExamRoom — retry idempotent (F-06)', () => {
  it('timeout/rớt mạng → banner "Gửi lại" giữ nguyên blob; gửi lại dùng CÙNG clientTurnId, lượt mới sau đó mới lấy khoá mới', async () => {
    api.audioTurn.mockRejectedValueOnce(Object.assign(new Error('timeout of 45000ms exceeded'), { isAxiosError: true, code: 'ECONNABORTED' }))
    api.audioTurn.mockResolvedValue(turnResponse)
    await renderRoom()

    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    await send(blob)
    expect(api.audioTurn).toHaveBeenCalledTimes(1)
    expect(api.audioTurn.mock.calls[0][4]).toBe('turn-1')
    const banner = await screen.findByTestId('turn-retry-banner')
    expect(banner).toHaveTextContent('gửi lại sẽ không bị tính thành lượt mới')

    await act(async () => {
      screen.getByRole('button', { name: 'Gửi lại lượt vừa rồi' }).click()
    })
    await waitFor(() => expect(api.audioTurn).toHaveBeenCalledTimes(2))
    expect(api.audioTurn.mock.calls[1][1]).toBe(blob)
    expect(api.audioTurn.mock.calls[1][4]).toBe('turn-1')
    await waitFor(() => expect(screen.queryByTestId('turn-retry-banner')).toBeNull())

    await send(blob)
    expect(api.audioTurn.mock.calls[2][4]).toBe('turn-2')
  })

  it('lỗi 4xx dứt khoát (413) → KHÔNG giữ lượt để gửi lại', async () => {
    api.audioTurn.mockRejectedValue(axios413())
    await renderRoom()
    await send(new Blob([new Uint8Array(1024)], { type: 'audio/webm' }))
    expect(screen.queryByTestId('turn-retry-banner')).toBeNull()
  })
})

describe('ExamRoom — nộp lượt audio', () => {
  it('hai blob về cùng lúc → chỉ MỘT lần gọi máy chủ (không trừ quota AI hai lần)', async () => {
    let release: (() => void) | null = null
    api.audioTurn.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(turnResponse)
        }),
    )
    await renderRoom()

    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    let first!: Promise<void>
    let second!: Promise<void>
    await act(async () => {
      first = submitAudio!(blob)
      second = submitAudio!(blob) // lượt thứ hai trong cùng tick — phải bị chốt ref chặn
    })

    expect(api.audioTurn).toHaveBeenCalledTimes(1)
    await act(async () => {
      release!()
      await Promise.all([first, second])
    })
    expect(api.audioTurn).toHaveBeenCalledTimes(1)
  })

  it('lượt xong thì mở khoá cho lượt kế tiếp', async () => {
    api.audioTurn.mockResolvedValue(turnResponse)
    await renderRoom()

    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    await send(blob)
    await send(blob)

    expect(api.audioTurn).toHaveBeenCalledTimes(2)
  })

  it('backend trả 413 → hiện lời giải thích của phòng thi, KHÔNG phải lời khuyên presigned upload', async () => {
    api.audioTurn.mockRejectedValue(axios413())
    await renderRoom()

    await send(new Blob([new Uint8Array(1024)], { type: 'audio/webm' }))

    const banner = await screen.findByText(/Bản ghi quá dài nên không gửi được/)
    expect(banner).toBeInTheDocument()
    expect(screen.queryByText(/presigned/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/25MB/)).not.toBeInTheDocument()
  })

  it('blob vượt trần phiên âm → chặn tại client, không gửi lên mạng', async () => {
    api.audioTurn.mockResolvedValue(turnResponse)
    await renderRoom()

    const huge = { size: MAX_TRANSCRIBE_BYTES + 1, type: 'audio/webm' } as Blob
    await send(huge)

    await waitFor(() => expect(screen.getByText(/Bản ghi quá dài nên không gửi được/)).toBeInTheDocument())
    expect(api.audioTurn).not.toHaveBeenCalled()
  })

  it('blob vừa đúng trần vẫn được gửi (guard không chặn nhầm lượt hợp lệ)', async () => {
    api.audioTurn.mockResolvedValue(turnResponse)
    await renderRoom()

    await send({ size: MAX_TRANSCRIBE_BYTES, type: 'audio/webm' } as Blob)

    expect(api.audioTurn).toHaveBeenCalledTimes(1)
  })
})
