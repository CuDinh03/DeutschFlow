import { describe, expect, test } from 'vitest'
import { classifyTheoryCompletionError } from '@/lib/theoryNodeCompletion'

/**
 * Chuỗi lấy NGUYÊN VĂN từ `SkillTreeService.markNodeComplete` — nếu backend đổi câu chữ thì test
 * này đỏ, đúng chỗ cần đỏ: nhánh im lặng sẽ rơi xuống `failed` và học viên bắt đầu thấy thông báo
 * thừa. Đỏ ở đây rẻ hơn nhiều so với việc phát hiện qua báo cáo người dùng.
 */
const BE = {
  alreadyDone: 'Bạn đã hoàn thành bài này rồi',
  graded: 'Bài này có bài tập chấm điểm — hãy làm bài và nộp để hoàn thành.',
  dependency: 'Bạn cần hoàn thành các bài học trước đó trước',
}

describe('classifyTheoryCompletionError', () => {
  test('node đã hoàn thành từ trước là chuyện bình thường — không phiền học viên', () => {
    expect(classifyTheoryCompletionError(400, BE.alreadyDone)).toEqual({
      outcome: 'alreadyDone',
      message: null,
    })
  })

  test('node có bài chấm điểm hoàn thành qua đường nộp bài — cũng không phải lỗi', () => {
    expect(classifyTheoryCompletionError(400, BE.graded)).toEqual({
      outcome: 'gradedNode',
      message: null,
    })
  })

  test('chưa đủ điều kiện tiên quyết PHẢI hiện ra, kèm nguyên văn lý do của backend', () => {
    expect(classifyTheoryCompletionError(400, BE.dependency)).toEqual({
      outcome: 'failed',
      message: BE.dependency,
    })
  })

  test('lỗi máy chủ hiện ra chứ không nuốt', () => {
    expect(classifyTheoryCompletionError(500, 'Hệ thống đang bận, vui lòng thử lại sau ít phút.')).toEqual({
      outcome: 'failed',
      message: 'Hệ thống đang bận, vui lòng thử lại sau ít phút.',
    })
  })

  test('mất mạng (không có status) vẫn báo hỏng', () => {
    expect(classifyTheoryCompletionError(0, 'Mất kết nối mạng. Kiểm tra đường truyền rồi thử lại.')).toEqual({
      outcome: 'failed',
      message: 'Mất kết nối mạng. Kiểm tra đường truyền rồi thử lại.',
    })
  })

  test('không có lý do nào thì message là null chứ không phải chuỗi rỗng', () => {
    expect(classifyTheoryCompletionError(503, '')).toEqual({ outcome: 'failed', message: null })
  })

  test('cùng câu chữ nhưng status khác 400 vẫn tính là hỏng — chỉ 400 mới là nhánh nghiệp vụ', () => {
    expect(classifyTheoryCompletionError(500, BE.alreadyDone).outcome).toBe('failed')
  })
})
