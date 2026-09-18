/**
 * Thứ tự in Leitpunkte phần Viết telc (17/09/2026). Đề thật in bốn ý XÁO thứ tự và chấm việc thí
 * sinh tự sắp; seed lưu thứ tự hợp lý cho AI. Ba điều phải đúng: xáo ổn định (vẽ lại không nhảy),
 * xáo THẬT (không trùng thứ tự gốc), và đề không khai cờ thì giữ nguyên như cũ.
 */
import { describe, it, expect } from 'vitest'
import { isWritingStimulus, orderedWritingPoints } from '@/components/exam/telc/writingTask'

const POINTS = [
  'Reaktion auf Lenas Vorschlag',
  'Etwas über Ihre neue Stadt',
  'Ein Tipp für die Übernachtung',
  'Was es Neues gibt',
]

describe('orderedWritingPoints', () => {
  it('không xáo khi đề không khai cờ (đề Goethe y như trước)', () => {
    expect(orderedWritingPoints(POINTS, undefined)).toEqual(POINTS)
    expect(orderedWritingPoints(POINTS, false)).toEqual(POINTS)
  })

  it('xáo thật: khác thứ tự gốc nhưng vẫn đủ đúng bốn ý', () => {
    const out = orderedWritingPoints(POINTS, true)
    expect(out).not.toEqual(POINTS)
    expect([...out].sort()).toEqual([...POINTS].sort())
  })

  it('xáo ổn định: cùng nội dung ⇒ cùng thứ tự ở mọi lần gọi', () => {
    expect(orderedWritingPoints(POINTS, true)).toEqual(orderedWritingPoints([...POINTS], true))
  })

  it('không làm hỏng mảng gốc và không xáo đề chỉ có một ý', () => {
    const copy = [...POINTS]
    orderedWritingPoints(copy, true)
    expect(copy).toEqual(POINTS)
    expect(orderedWritingPoints(['einzig'], true)).toEqual(['einzig'])
  })

  it('hai ý luôn ra thứ tự đảo (xáo trùng gốc thì xoay một bước)', () => {
    expect(orderedWritingPoints(['a', 'b'], true)).toEqual(['b', 'a'])
  })
})

describe('isWritingStimulus', () => {
  it('cần thân văn bản không rỗng; kiểu/from/subject là tuỳ chọn', () => {
    expect(isWritingStimulus({ type: 'EMAIL', from: 'Lena', body: 'Hallo!' })).toBe(true)
    expect(isWritingStimulus({ body: 'Nur Text' })).toBe(true)
    expect(isWritingStimulus({ type: 'EMAIL', body: '   ' })).toBe(false)
    expect(isWritingStimulus('Hallo')).toBe(false)
    expect(isWritingStimulus(undefined)).toBe(false)
  })
})
