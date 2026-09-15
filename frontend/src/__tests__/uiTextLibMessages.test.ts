import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '@/lib/api'
import { uiText } from '@/lib/i18n/clientLocale'
import { waitForAsyncJob } from '@/lib/asyncJob'
import { syncMomoOrder } from '@/lib/paymentApi'

/**
 * Đợt 3 audit UTF-8/i18n (06/09/2026): thông điệp cố định của các lib ngoài React (asyncJob,
 * curriculumImportApi, paymentApi, interviewReportApi, jobSseApi) đi qua uiText({vi,en,de}) đọc cookie
 * `locale` — cùng cơ chế với apiMessage (xem apiMessageLocale.test.ts). Mặc định không cookie = vi.
 */
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const sample = { vi: 'Job thất bại.', en: 'The job failed.', de: 'Der Job ist fehlgeschlagen.' }

afterEach(() => {
  document.cookie = 'locale=; max-age=0; path=/'
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
})

describe('uiText — thông điệp lib ngoài React theo cookie locale', () => {
  it('không có cookie → vi; cookie de → bản Đức', () => {
    expect(uiText(sample)).toBe('Job thất bại.')
    document.cookie = 'locale=de; path=/'
    expect(uiText(sample)).toBe('Der Job ist fehlgeschlagen.')
  })

  it('asyncJob: job COMPLETED không có payload → câu lỗi tiếng Đức khi locale=de', async () => {
    document.cookie = 'locale=de; path=/'
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { id: 'j1', jobType: 'PRACTICE', status: 'COMPLETED', resultPayload: null, errorMessage: null },
    })
    await expect(waitForAsyncJob('j1')).rejects.toThrow('Der Job ist abgeschlossen, hat aber kein Ergebnis geliefert.')
  })

  it('asyncJob: job FAILED không có errorMessage → "Job thất bại." khi không có cookie', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { id: 'j2', jobType: 'PRACTICE', status: 'FAILED', resultPayload: null, errorMessage: null },
    })
    await expect(waitForAsyncJob('j2')).rejects.toThrow('Job thất bại.')
  })

  it('paymentApi: backend không kèm message → câu dự phòng tiếng Anh khi locale=en', async () => {
    document.cookie = 'locale=en; path=/'
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 502, data: {} } })
    await expect(syncMomoOrder('order-1')).rejects.toThrow('Could not sync the payment status')
  })
})
