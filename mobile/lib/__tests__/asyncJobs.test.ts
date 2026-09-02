// Khoá hợp đồng poll job chấm nền (soát 02/09, F-10b): finish trả 202+jobId,
// client PHẢI chờ job COMPLETED rồi mới đọc kết quả — GET ngay sau 202 là đọc
// bản ghi chưa chấm.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

import api from '@/lib/api'
import { AsyncJobFailedError, AsyncJobTimeoutError, isJobTerminal, pollAsyncJob } from '@/lib/asyncJobs'

const get = api.get as unknown as jest.Mock

const job = (status: string, extra: Record<string, unknown> = {}) => ({
  data: { id: 'j1', jobType: 'FINISH_EXAM', status, resultPayload: null, errorMessage: null, ...extra },
})

beforeEach(() => {
  jest.useFakeTimers()
  get.mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('isJobTerminal', () => {
  test.each([
    ['PENDING', false],
    ['PROCESSING', false],
    ['COMPLETED', true],
    ['FAILED', true],
  ])('%s → %s', (status, expected) => {
    expect(isJobTerminal(status)).toBe(expected)
  })
})

describe('pollAsyncJob', () => {
  test('chờ qua PENDING → PROCESSING rồi trả job khi COMPLETED', async () => {
    get
      .mockResolvedValueOnce(job('PENDING'))
      .mockResolvedValueOnce(job('PROCESSING'))
      .mockResolvedValueOnce(job('COMPLETED'))

    const p = pollAsyncJob('j1', { intervalMs: 1000, timeoutMs: 60_000 })
    await jest.advanceTimersByTimeAsync(1000) // sau PENDING
    await jest.advanceTimersByTimeAsync(1500) // sau PROCESSING (backoff ×1.5)

    await expect(p).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenCalledWith('/async-jobs/j1')
  })

  test('FAILED → ném AsyncJobFailedError ngay, không poll thêm', async () => {
    get.mockResolvedValueOnce(job('FAILED', { errorMessage: 'boom' }))

    await expect(pollAsyncJob('j1')).rejects.toBeInstanceOf(AsyncJobFailedError)
    expect(get).toHaveBeenCalledTimes(1)
  })

  test('quá trần chờ mà job chưa xong → AsyncJobTimeoutError', async () => {
    get.mockResolvedValue(job('PROCESSING'))

    const p = pollAsyncJob('j1', { intervalMs: 1000, maxIntervalMs: 1000, timeoutMs: 3000 })
    const assertion = expect(p).rejects.toBeInstanceOf(AsyncJobTimeoutError)
    await jest.advanceTimersByTimeAsync(4000)

    await assertion
  })

  test('lỗi mạng thoáng qua giữa chừng không giết lượt chờ', async () => {
    get
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(job('COMPLETED'))

    const p = pollAsyncJob('j1', { intervalMs: 1000, timeoutMs: 60_000 })
    await jest.advanceTimersByTimeAsync(1000)
    await jest.advanceTimersByTimeAsync(1500)

    await expect(p).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  test('quá 3 lỗi fetch LIÊN TIẾP → ném lỗi gốc ra ngoài', async () => {
    get.mockRejectedValue(new Error('offline hẳn'))

    const p = pollAsyncJob('j1', { intervalMs: 1000, timeoutMs: 60_000 })
    const assertion = expect(p).rejects.toThrow('offline hẳn')
    await jest.advanceTimersByTimeAsync(1000)
    await jest.advanceTimersByTimeAsync(1500)
    await jest.advanceTimersByTimeAsync(2250)

    await assertion
  })
})
