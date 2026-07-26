import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

/**
 * Audit speaking 24/07 — R-W8: transcript của mic về MUỘN thì `setInputText` ghi đè ô nhập người
 * dùng đang soạn (chính là hiện tượng "text cũ quay lại ô nhập" trong ảnh ④), và các `setState`
 * vẫn chạy sau khi rời trang vì không có sequence-guard, không huỷ promise khi unmount.
 *
 * Bộ test giữ transcribe ở trạng thái "đang bay" rồi mới bắt đầu lượt mới / cleanup — đúng cửa sổ
 * mà lỗi xảy ra thật.
 */

const transcribeMock = vi.fn()
const evaluatePhonemeMock = vi.fn()
/** Hàm mà voiceRecorder gọi khi có blob — test tự giữ để bắn đúng thời điểm mình muốn. */
let onBlob: ((blob: Blob) => void | Promise<void>) | null = null
const stopMock = vi.fn()

vi.mock("@/lib/aiSpeakingApi", () => ({
  aiSpeakingApi: { transcribe: (...args: unknown[]) => transcribeMock(...args) },
}))
vi.mock("@/lib/phonemeApi", () => ({
  evaluatePhoneme: (...args: unknown[]) => evaluatePhonemeMock(...args),
}))
vi.mock("@/lib/voiceRecorder", () => ({
  startRecorder: async (cb: (blob: Blob) => void | Promise<void>) => {
    onBlob = cb
    return { stop: stopMock }
  },
}))
vi.mock("@/lib/api", () => ({ httpStatus: () => 500 }))
vi.mock("@/lib/micErrors", () => ({
  classifyMicError: () => ({ kind: "denied", messageKey: "micDenied" }),
}))

import { useSpeakingRecorderMic } from "@/hooks/useSpeakingRecorderMic"

const t = (key: string) => key

/** Promise điều khiển được từ bên ngoài — giữ transcribe "đang bay" bao lâu tuỳ ý. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("useSpeakingRecorderMic — sequence guard (R-W8)", () => {
  beforeEach(() => {
    onBlob = null
    transcribeMock.mockReset()
    evaluatePhonemeMock.mockReset()
    stopMock.mockReset()
    evaluatePhonemeMock.mockResolvedValue({ score: 80 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("đang transcribe thì bấm mic lần nữa KHÔNG mở lượt thu mới — không có hai lượt chồng nhau", async () => {
    const slow = deferred<{ data: { transcript: string } }>()
    transcribeMock.mockReturnValueOnce(slow.promise)

    const { result } = renderHook(() => useSpeakingRecorderMic(t))

    await act(async () => {
      result.current.toggleMic(vi.fn())
    })
    await act(async () => {
      void onBlob!(new Blob(["a"]))
      await Promise.resolve()
    })

    // Đang chờ transcribe: hook chặn mở lượt mới (isTranscribing) — startRecorder không được gọi lại.
    onBlob = null
    await act(async () => {
      result.current.toggleMic(vi.fn())
    })
    expect(onBlob).toBeNull()

    await act(async () => {
      slow.resolve({ data: { transcript: "xong" } })
      await Promise.resolve()
    })
  })

  it("transcript của lượt hiện tại vẫn vào ô nhập bình thường", async () => {
    transcribeMock.mockResolvedValue({ data: { transcript: "Guten Tag" } })

    const onTranscript = vi.fn()
    const { result } = renderHook(() => useSpeakingRecorderMic(t))

    await act(async () => {
      result.current.toggleMic(onTranscript)
    })
    await act(async () => {
      await onBlob!(new Blob(["a"]))
    })

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith("Guten Tag"))
  })

  it("cleanup (rời trang) huỷ kết quả đang bay — không setState sau unmount", async () => {
    const slow = deferred<{ data: { transcript: string } }>()
    transcribeMock.mockReturnValueOnce(slow.promise)

    const onTranscript = vi.fn()
    const { result, unmount } = renderHook(() => useSpeakingRecorderMic(t))

    await act(async () => {
      result.current.toggleMic(onTranscript)
    })
    const handler = onBlob!
    await act(async () => {
      void handler(new Blob(["a"]))
    })

    act(() => {
      result.current.cleanup()
    })
    unmount()

    await act(async () => {
      slow.resolve({ data: { transcript: "về sau khi đã rời trang" } })
      await Promise.resolve()
    })

    expect(onTranscript).not.toHaveBeenCalled()
  })

  it("chấm phát âm về muộn sau cleanup cũng bị bỏ", async () => {
    transcribeMock.mockResolvedValue({ data: { transcript: "Hallo" } })
    const slowEval = deferred<{ score: number }>()
    evaluatePhonemeMock.mockReturnValueOnce(slowEval.promise)

    const onPhonemeScored = vi.fn()
    const { result } = renderHook(() => useSpeakingRecorderMic(t, onPhonemeScored))

    await act(async () => {
      result.current.toggleMic(vi.fn())
    })
    await act(async () => {
      void onBlob!(new Blob(["a"]))
      await Promise.resolve()
    })

    act(() => {
      result.current.cleanup()
    })

    await act(async () => {
      slowEval.resolve({ score: 90 })
      await Promise.resolve()
    })

    expect(onPhonemeScored).not.toHaveBeenCalled()
  })
})
