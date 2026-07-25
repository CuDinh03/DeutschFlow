import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { chatStream } from "@/lib/aiSpeakingApi"

/**
 * Audit speaking 24/07 — R-B9 liệt "stream-error" vào vùng trắng test cho cả ba tầng.
 *
 * Đêm 23/07 web hiện chip "Connection error" trơ trọi vì backend `completeWithError` giữa stream:
 * SSE đã commit 200 nên client không nhận nổi ProblemDetail, chỉ thấy kết nối đứt (R-B2), rồi rơi
 * vào trạng thái `error` hút vĩnh viễn (R-W1). Bản vá đổi sang phát event `error` mang
 * `{code, message}` — bộ test này chốt phía client của hợp đồng đó: mã lỗi tới được lớp UI để
 * chọn đúng thông điệp (R-W5), và phần văn bản đã stream KHÔNG bị vứt khi lỗi xảy ra giữa chừng.
 */

const encoder = new TextEncoder()

/** Dựng một Response SSE giả từ danh sách frame thô. */
function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
}

function tokenFrame(text: string): string {
  return `event: token\ndata: ${text}\n\n`
}

/** Chờ chatStream chạy hết vòng đọc — nó không trả Promise nên poll cho tới khi có kết quả. */
async function flush(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("stream không kết thúc kịp")
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe("chatStream — hợp đồng event `error` (R-B2 ↔ R-W5)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    // chatStream đọc access token từ localStorage; jsdom trong repo này không dựng sẵn nó nên
    // thiếu stub thì mọi lượt gọi hỏng ngay ở dòng lấy token, không bao giờ tới nhánh SSE.
    vi.stubGlobal("localStorage", {
      getItem: () => "test-token",
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("bóc `code` + `message` tiếng Việt của backend thay vì để UI hiện chip generic", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([`event: error\ndata: {"code":"AI_BUSY","message":"Trợ lý AI đang bận, thử lại sau ít giây."}\n\n`])
    )
    const onError = vi.fn()

    chatStream(1, "Hallo", vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError).toHaveBeenCalledWith("AI_BUSY", {
      code: "AI_BUSY",
      message: "Trợ lý AI đang bận, thử lại sau ít giây.",
    })
  })

  it("phân biệt được hết quota với AI bận — hai mã, hai hành vi UI khác nhau", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([`event: error\ndata: {"code":"QUOTA_EXCEEDED","message":"Bạn đã dùng hết lượt AI."}\n\n`])
    )
    const onError = vi.fn()

    chatStream(1, "Hallo", vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError.mock.calls[0][1]?.code).toBe("QUOTA_EXCEEDED")
  })

  it("lỗi giữa chừng: giữ nguyên phần đã stream, không vứt câu AI đang dở", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        tokenFrame('{"ai_speech_de":"Guten '),
        tokenFrame('Tag"'),
        `event: error\ndata: {"code":"AI_UPSTREAM_UNAVAILABLE","message":"Dịch vụ AI tạm thời không khả dụng."}\n\n`,
      ])
    )
    const tokens: string[] = []
    const onError = vi.fn()

    chatStream(1, "Hallo", (delta) => tokens.push(delta), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(tokens.join("")).toContain("Guten")
    expect(onError.mock.calls[0][1]?.code).toBe("AI_UPSTREAM_UNAVAILABLE")
  })

  it("data không phải JSON: vẫn báo lỗi, không ném ra ngoài", async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse([`event: error\ndata: boom\n\n`]))
    const onError = vi.fn()

    chatStream(1, "Hallo", vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError.mock.calls[0][0]).toBe("boom")
    expect(onError.mock.calls[0][1]?.code).toBeUndefined()
  })

  it("chỉ báo lỗi MỘT lần dù stream còn frame lỗi phía sau", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        `event: error\ndata: {"code":"AI_BUSY","message":"bận"}\n\n`,
        `event: error\ndata: {"code":"INTERNAL","message":"lỗi khác"}\n\n`,
      ])
    )
    const onError = vi.fn()

    chatStream(1, "Hallo", vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]?.code).toBe("AI_BUSY")
  })

  it("`done` xong thì event lỗi tới sau không lật ngược lượt đã thành công", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        `event: done\ndata: {"sessionId":1,"aiSpeechDe":"Hallo"}\n\n`,
        `event: error\ndata: {"code":"INTERNAL","message":"muộn"}\n\n`,
      ])
    )
    const onDone = vi.fn()
    const onError = vi.fn()

    chatStream(1, "Hallo", vi.fn(), onDone, onError)
    await flush(() => onDone.mock.calls.length > 0)
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})
