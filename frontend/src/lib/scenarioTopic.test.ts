import { describe, expect, test } from 'vitest'
import { SESSION_TOPIC_MAX, scenarioTopic } from './studentClassesApi'

describe('scenarioTopic — trần 200 ký tự của CreateSessionRequest.topic', () => {
  test('ngắn → giữ nguyên định dạng Chủ đề / Mô tả chi tiết / Gợi ý', () => {
    const s = scenarioTopic({ topic: 'Im Restaurant', scenarioDescription: 'Bestellen.', followUpQuestions: 'Was?' })
    expect(s).toBe('Chủ đề: Im Restaurant\n\nMô tả chi tiết: Bestellen.\n\nGợi ý: Was?')
    expect(s.length).toBeLessThanOrEqual(SESSION_TOPIC_MAX)
  })
  test('dài → ≤ 200, giữ chủ đề + đầu mô tả kết thúc …, bỏ Gợi ý', () => {
    const desc = 'Sie sind im Restaurant und möchten bestellen. '.repeat(8)
    const s = scenarioTopic({ topic: 'Im Restaurant bestellen', scenarioDescription: desc, followUpQuestions: 'Was möchten Sie trinken?' })
    expect(s.length).toBeLessThanOrEqual(SESSION_TOPIC_MAX)
    expect(s.startsWith('Chủ đề: Im Restaurant bestellen\n\nMô tả chi tiết: Sie sind im Restaurant')).toBe(true)
    expect(s.endsWith('…')).toBe(true)
    expect(s).not.toContain('Gợi ý')
  })
  test('null → chuỗi rỗng thay vì "null"', () => {
    expect(scenarioTopic({ topic: 'T', scenarioDescription: null, followUpQuestions: null })).toBe('Chủ đề: T\n\nMô tả chi tiết: \n\nGợi ý: ')
  })
})
