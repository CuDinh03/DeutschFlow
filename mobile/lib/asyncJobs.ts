// Poll job chấm nền của backend (bảng async_jobs, AsyncJobController).
//
// Hợp đồng (S-5 backend, soát 02/09 F-10): các thao tác chấm nặng trả 202 kèm
// jobId ngay — ví dụ POST /mock-exams/attempts/{id}/finish — rồi client poll
// GET /api/async-jobs/{jobId} tới khi job kết thúc. Trước bản vá này mobile GET
// kết quả NGAY sau 202 nên đọc phải bản ghi chưa chấm (điểm null → hiện 0).
//
// Backend cũng có SSE /async-jobs/{id}/stream; chọn poll vì client axios hiện
// không có hạ tầng SSE và một bài chấm chỉ kéo dài giây-tới-phút.

import api from './api'

/** Gương entity AsyncJob (serialize mặc định camelCase, không @JsonProperty). */
export interface AsyncJobDto {
  id: string
  jobType: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | (string & {})
  resultPayload: string | null
  errorMessage: string | null
}

export const isJobTerminal = (status: string): boolean =>
  status === 'COMPLETED' || status === 'FAILED'

/** Job kết thúc với status FAILED — errorMessage là chuỗi kỹ thuật, đừng hiện thô. */
export class AsyncJobFailedError extends Error {
  constructor(readonly job: AsyncJobDto) {
    super(job.errorMessage ?? 'async job failed')
    this.name = 'AsyncJobFailedError'
  }
}

/** Quá trần chờ mà job chưa kết thúc — job vẫn có thể xong muộn trên server. */
export class AsyncJobTimeoutError extends Error {
  constructor(readonly jobId: string) {
    super(`async job ${jobId} still running after deadline`)
    this.name = 'AsyncJobTimeoutError'
  }
}

export interface PollOptions {
  /** Nhịp poll đầu tiên; sau đó giãn ×1.5 tới trần `maxIntervalMs`. */
  intervalMs?: number
  maxIntervalMs?: number
  /** Tổng thời gian chờ trước khi ném AsyncJobTimeoutError. */
  timeoutMs?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Poll tới khi job COMPLETED (trả job) / FAILED (ném AsyncJobFailedError) /
 * quá hạn (ném AsyncJobTimeoutError).
 *
 * Một cú GET lỗi mạng thoáng qua giữa chừng KHÔNG được phép giết cả lượt chờ
 * (mobile network chập chờn là thường): chịu tối đa 3 lỗi fetch LIÊN TIẾP rồi
 * mới ném lỗi đó ra ngoài.
 */
export async function pollAsyncJob(jobId: string, opts: PollOptions = {}): Promise<AsyncJobDto> {
  const { intervalMs = 1200, maxIntervalMs = 4000, timeoutMs = 120_000 } = opts
  const startedAt = Date.now()
  let interval = intervalMs
  let consecutiveFetchErrors = 0

  for (;;) {
    try {
      const { data } = await api.get<AsyncJobDto>(`/async-jobs/${jobId}`)
      consecutiveFetchErrors = 0
      if (data.status === 'COMPLETED') return data
      if (data.status === 'FAILED') throw new AsyncJobFailedError(data)
    } catch (err) {
      if (err instanceof AsyncJobFailedError) throw err
      consecutiveFetchErrors += 1
      if (consecutiveFetchErrors > 3) throw err
    }
    if (Date.now() - startedAt >= timeoutMs) throw new AsyncJobTimeoutError(jobId)
    await sleep(interval)
    interval = Math.min(maxIntervalMs, Math.round(interval * 1.5))
  }
}
