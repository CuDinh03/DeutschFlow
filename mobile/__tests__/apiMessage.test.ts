/**
 * Hồi quy cho sự cố 21/07/2026: Groq khai tử model nói → backend trả 503 kèm câu tiếng Việt ở
 * `detail` (RFC-7807), nhưng apiMessage chỉ đọc `message`/`error` nên người dùng chỉ thấy chuỗi thô
 * "Request failed with status code 503". Bộ test này khoá thứ tự đọc trường lại.
 */
import { apiMessage } from '@/lib/api'

/** Lỗi axios tối thiểu — axios.isAxiosError() chỉ kiểm tra cờ isAxiosError. */
function axiosError(data: unknown, status = 503, message = 'Request failed with status code 503') {
  return { isAxiosError: true, message, response: { status, data } }
}

describe('apiMessage', () => {
  it('đọc `detail` của ProblemDetail thay vì chuỗi thô của axios', () => {
    const problem = {
      type: 'https://deutschflow.com/errors/ai-unavailable',
      title: 'AI Service Unavailable',
      status: 503,
      detail: 'Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.',
    }

    expect(apiMessage(axiosError(problem))).toBe(
      'Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau.',
    )
  })

  it('ưu tiên `detail` khi body có cả detail lẫn message', () => {
    const body = { detail: 'Câu cụ thể', message: 'câu chung chung' }

    expect(apiMessage(axiosError(body))).toBe('Câu cụ thể')
  })

  it('vẫn đọc được `message` của các endpoint không dùng ProblemDetail', () => {
    expect(apiMessage(axiosError({ message: 'Sai mật khẩu', status: 401 }, 401))).toBe('Sai mật khẩu')
  })

  it('vẫn đọc được `error` khi body chỉ có trường đó', () => {
    expect(apiMessage(axiosError({ error: 'Unauthorized' }, 401))).toBe('Unauthorized')
  })

  it('lùi về `title` trước khi lùi về chuỗi axios', () => {
    expect(apiMessage(axiosError({ title: 'Endpoint Not Found', status: 404 }, 404))).toBe(
      'Endpoint Not Found',
    )
  })

  it('bỏ qua trường rỗng hoặc chỉ có khoảng trắng', () => {
    expect(apiMessage(axiosError({ detail: '   ', message: 'Thông điệp thật' }))).toBe(
      'Thông điệp thật',
    )
  })

  it('bỏ qua trường không phải chuỗi', () => {
    expect(apiMessage(axiosError({ detail: { nested: 'object' }, message: 'Chuỗi hợp lệ' }))).toBe(
      'Chuỗi hợp lệ',
    )
  })

  it('lùi về message của axios khi body không có trường nào dùng được', () => {
    expect(apiMessage(axiosError({ timestamp: '2026-07-21T05:40:20' }))).toBe(
      'Request failed with status code 503',
    )
  })

  it('xử lý lỗi mạng (không có response)', () => {
    expect(apiMessage({ isAxiosError: true, message: 'Network Error' })).toBe('Network Error')
  })

  it('xử lý Error thường và giá trị lạ', () => {
    expect(apiMessage(new Error('bùm'))).toBe('bùm')
    expect(apiMessage(null)).toBe('Lỗi không xác định')
    expect(apiMessage('chuỗi trần')).toBe('Lỗi không xác định')
  })
})
