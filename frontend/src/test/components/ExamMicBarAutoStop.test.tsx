/**
 * MicBar — tự dừng và gửi khi đã nói rồi im 2 giây (Đợt 5 phòng thi nói). Recorder giả có AnalyserNode
 * giả; test đặt mức âm từng lúc và đẩy đồng hồ giả.
 */
import React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { MicBar } from '@/components/features/exam-speaking/MicBar'

const rec = vi.hoisted(() => ({ level: 128, stop: vi.fn(), cancel: vi.fn() }))
vi.mock('@/lib/voiceRecorder', () => ({
  DEFAULT_MAX_RECORDING_MS: 180_000,
  startRecorder: vi.fn(async () => ({
    stop: rec.stop,
    cancel: rec.cancel,
    stream: {} as MediaStream,
    mimeType: 'audio/webm',
    maxDurationMs: 180_000,
    analyser: {
      fftSize: 32,
      getByteTimeDomainData: (buf: Uint8Array) => buf.fill(rec.level),
    } as unknown as AnalyserNode,
  })),
}))
vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => 'granted' }))

function renderBar(autoStop: boolean) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <MicBar disabled={false} busy={false} allowText={false} onAudio={vi.fn()} onText={vi.fn()} autoStop={autoStop} />
    </NextIntlClientProvider>,
  )
}

async function startRecording() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('mic-start'))
  })
  expect(screen.getByTestId('mic-stop')).toBeInTheDocument()
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
  rec.level = 128
  rec.stop.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('MicBar — tự dừng khi im', () => {
  it('đã nói 1 giây rồi im 2 giây → tự dừng-và-gửi', async () => {
    renderBar(true)
    await startRecording()
    rec.level = 200 // đang nói
    await advance(1000)
    rec.level = 129 // im
    await advance(1900)
    expect(rec.stop).not.toHaveBeenCalled()
    await advance(300)
    expect(rec.stop).toHaveBeenCalledTimes(1)
  })

  it('bấm micro rồi chưa nói gì → không cắt', async () => {
    renderBar(true)
    await startRecording()
    await advance(10_000)
    expect(rec.stop).not.toHaveBeenCalled()
  })

  it('công tắc tắt → không tự dừng', async () => {
    renderBar(false)
    await startRecording()
    rec.level = 200
    await advance(1000)
    rec.level = 128
    await advance(5000)
    expect(rec.stop).not.toHaveBeenCalled()
  })
})
