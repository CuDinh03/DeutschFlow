import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * V-01 — tập id "lớp chưa ai dạy" phải LẤY HẾT.
 *
 * Nhãn từng dòng đọc tập này: id nằm ngoài tập bị gắn "đã có giáo viên". Tập thiếu vì phân trang
 * thì lại nói sai — đúng loại lỗi mà hàm này sinh ra để thay thế (`teacherId == null`).
 */
const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }))

import { getTeacherlessClassIds, TEACHERLESS_PROBE_MAX_PAGES } from '@/lib/orgApi'

const pageOf = (ids: number[], last: boolean, number = 0) => ({
  data: {
    content: ids.map((id) => ({ id, name: `Lớp ${id}`, inviteCode: null, teacherId: 7, createdAt: null })),
    number, size: 200, totalElements: ids.length, totalPages: 1, first: number === 0, last,
  },
})

// Thân có DẤU NGOẶC: `() => apiGet.mockReset()` trả về chính mock, và vitest coi hàm trả về từ
// beforeEach là cleanup hook — nó GỌI mock đó sau mỗi ca, sinh thêm một lượt gọi ma.
beforeEach(() => { apiGet.mockReset() })

describe('getTeacherlessClassIds', () => {
  it('trang duy nhất ⇒ đúng MỘT request', async () => {
    apiGet.mockResolvedValueOnce(pageOf([2, 5], true))

    expect(await getTeacherlessClassIds()).toEqual(new Set([2, 5]))
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][1].params).toMatchObject({ page: 0, withoutTeacher: true })
  })

  it('còn trang sau ⇒ nối tiếp cho tới hết, không bỏ sót id trang 2', async () => {
    apiGet
      .mockResolvedValueOnce(pageOf([1, 2], false, 0))
      .mockResolvedValueOnce(pageOf([3], true, 1))

    expect(await getTeacherlessClassIds()).toEqual(new Set([1, 2, 3]))
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('máy chủ không bao giờ nói hết ⇒ dừng ở trần trang, không lặp vô hạn', async () => {
    // Bẫy ném lỗi ở lượt VƯỢT trần: vòng lặp không chặn sẽ ĐỎ ngay thay vì treo tới hết timeout —
    // test treo là test không nói gì (xem bẫy đã ghi lại ở các đợt trước).
    let calls = 0
    apiGet.mockImplementation(() => {
      calls += 1
      if (calls > TEACHERLESS_PROBE_MAX_PAGES) throw new Error('vòng lặp vượt trần trang')
      return Promise.resolve(pageOf([calls], false, calls - 1))
    })

    const ids = await getTeacherlessClassIds()
    expect(ids).toBeInstanceOf(Set)
    expect(apiGet).toHaveBeenCalledTimes(TEACHERLESS_PROBE_MAX_PAGES)
  })
})
