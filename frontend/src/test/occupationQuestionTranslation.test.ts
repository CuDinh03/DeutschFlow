/** K4 A+B+E: bản dịch câu hỏi nghề theo ngôn ngữ trang. */
import { describe, expect, it } from 'vitest'
import { questionTranslation } from '@/lib/occupationTypes'

const Q = { questionDe: 'Wie lagern Sie Medikamente?', questionVi: 'Bạn bảo quản thuốc thế nào?', questionEn: 'How do you store medication?' }

describe('questionTranslation', () => {
  it('vi → tiếng Việt, en → tiếng Anh, de → không có', () => {
    expect(questionTranslation(Q, 'vi')).toBe('Bạn bảo quản thuốc thế nào?')
    expect(questionTranslation(Q, 'en')).toBe('How do you store medication?')
    expect(questionTranslation(Q, 'de')).toBeNull()
  })

  it('chưa dịch (null, rỗng, backend cũ không có trường) → null', () => {
    expect(questionTranslation({ questionDe: 'x', questionVi: null }, 'vi')).toBeNull()
    expect(questionTranslation({ questionDe: 'x', questionEn: '  ' }, 'en')).toBeNull()
    expect(questionTranslation({ questionDe: 'x' }, 'vi')).toBeNull()
  })
})
