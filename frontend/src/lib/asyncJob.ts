import api from '@/lib/api'

/**
 * asyncJob — client cho hàng đợi job nền của backend (`/api/async-jobs`).
 *
 * Vì sao cần: các endpoint sinh bài bằng LLM đã được chuyển ra khỏi luồng Tomcat (S-5). Chúng
 * KHÔNG còn trả kết quả ngay mà trả `202 Accepted` + `{ jobId, status: "PENDING" }`
 * (xem PracticeNodeController#startPracticeSession / #generateNextGeneration). Client phải
 * poll `GET /async-jobs/{jobId}` tới khi COMPLETED rồi đọc `resultPayload` (chuỗi JSON).
 *
 * Trang v1 `/student/practice-session/[nodeId]/[skill]` KHÔNG xử lý nhánh 202 này — nó chỉ đọc
 * `data.sessions` / `data.sessionId`, nên khi bài chưa có sẵn (lần sinh đầu) và ở MỌI lần bấm
 * "Làm thêm bài mới" thì runner đứng im. Bản port /v2 dùng helper này để chạy đúng contract.
 */

export type AsyncJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

/** Bản ghi job trả về từ `GET /api/async-jobs/{jobId}` (mirror `AsyncJob` entity). */
export interface AsyncJobDto {
  id: string
  jobType: string
  status: AsyncJobStatus
  /** Chuỗi JSON kết quả khi COMPLETED. */
  resultPayload: string | null
  errorMessage: string | null
}

/** Thân của `202 Accepted` mà các endpoint sinh-bài trả về. */
export interface AsyncJobAccepted {
  jobId: string
  status: AsyncJobStatus
}

/** True khi response body là vé job (202) chứ không phải kết quả thật. */
export function isAsyncJobAccepted(data: unknown): data is AsyncJobAccepted {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { jobId?: unknown }).jobId === 'string'
  )
}

export class AsyncJobError extends Error {}

const POLL_INTERVAL_MS = 1500
/** Sinh bài bằng LLM có thể mất hàng chục giây — cho trần rộng rồi mới bỏ cuộc. */
const DEFAULT_TIMEOUT_MS = 120_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll một job tới khi COMPLETED rồi trả `resultPayload` đã parse.
 *
 * @throws {AsyncJobError} khi job FAILED, khi hết thời gian chờ, hoặc khi bị `signal` huỷ.
 */
export async function waitForAsyncJob<T>(
  jobId: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const signal = options?.signal
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (signal?.aborted) throw new AsyncJobError('aborted')

    const { data } = await api.get<AsyncJobDto>(`/async-jobs/${jobId}`)

    if (data.status === 'COMPLETED') {
      if (!data.resultPayload) throw new AsyncJobError('Job hoàn tất nhưng không có kết quả.')
      const payload = JSON.parse(data.resultPayload) as T
      // Lưới an toàn (QA 2026-09-01). Backend từng ghi job HỎNG là COMPLETED với errorMessage rỗng —
      // sự thật chỉ nằm trong payload. Khi đó nhánh FAILED bên dưới là code chết: câu lỗi tử tế của
      // backend bị nuốt, người dùng chỉ thấy thông báo chung, và mọi thống kê đếm job hỏng báo 0
      // trong khi 100% job hỏng ⇒ sự cố model AI 404 chạy âm thầm 11 tiếng không ai hay.
      // PracticeNodeService nay đã ghi đúng trạng thái; giữ lưới này để job kiểu cũ còn tồn đọng và
      // mọi call site tương lai lỡ lặp lại khuôn đó không âm thầm hỏng thêm lần nữa.
      const settled = payload as { status?: unknown; error?: unknown } | null
      if (settled && settled.status === 'FAILED') {
        throw new AsyncJobError(
          typeof settled.error === 'string' && settled.error.trim() ? settled.error : 'Job thất bại.',
        )
      }
      return payload
    }
    if (data.status === 'FAILED') {
      throw new AsyncJobError(data.errorMessage || 'Job thất bại.')
    }
    if (Date.now() >= deadline) {
      throw new AsyncJobError('Quá thời gian chờ sinh bài.')
    }

    await sleep(POLL_INTERVAL_MS)
  }
}
