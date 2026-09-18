/**
 * Phần Viết kiểu đề telc trên app (17/09/2026): E-Mail của bạn in nguyên văn phía trên bài, bốn
 * Leitpunkte xáo thứ tự như tờ đề thật. Đề Goethe (không khai `stimulus`/`shuffle_points`) bóc
 * y như trước.
 */
import { describe, it, expect } from '@jest/globals'
import { parseExamSections } from '@/lib/examApi'
import { isWritingStimulus, orderedWritingPoints } from '@/lib/writingTask'

const POINTS = [
  'Reaktion auf Lenas Vorschlag: Passt der Besuch im Juli?',
  'Etwas über Ihre neue Stadt',
  'Ein Tipp, wo Lena günstig übernachten kann',
  'Was es bei Ihnen Neues gibt',
]

const exam = (teil: Record<string, unknown>) =>
  JSON.stringify({ format: 'TELC', sections: [{ name: 'SCHREIBEN', max_points: 45, teile: [teil] }] })

describe('phần Viết telc: E-Mail kích thích và Leitpunkte xáo', () => {
  const parsed = parseExamSections(exam({
    teil: 1,
    instruction_vi: 'Viết E-Mail trả lời bạn',
    prompt: 'Ihre Freundin Lena hat Ihnen geschrieben.',
    stimulus: { type: 'EMAIL', from: 'Lena', subject: 'Besuch im Juli?', body: 'Hallo!\n\nPasst dir der Juli?' },
    shuffle_points: true,
    writing_points: POINTS,
  }))
  const task = parsed.sections[0].writing[0]

  it('bóc được E-Mail của bạn với người gửi, chủ đề, thân thư', () => {
    expect(task.stimulus).toEqual({
      type: 'EMAIL', from: 'Lena', subject: 'Besuch im Juli?', body: 'Hallo!\n\nPasst dir der Juli?',
    })
    expect(task.answerKey).toBe('email_1')
  })

  it('bốn Leitpunkte đủ nhưng không theo thứ tự seed, và ổn định giữa hai lần bóc', () => {
    expect([...task.points!].sort()).toEqual([...POINTS].sort())
    expect(task.points).not.toEqual(POINTS)
    const again = parseExamSections(exam({ teil: 1, shuffle_points: true, writing_points: POINTS }))
    expect(again.sections[0].writing[0].points).toEqual(task.points)
  })

  it('văn bản kích thích thiếu thân thư thì coi như không có — không dựng khung rỗng', () => {
    const noBody = parseExamSections(exam({ teil: 1, prompt: 'Nur Prompt', stimulus: { type: 'EMAIL', from: 'Lena' } }))
    expect(noBody.sections[0].writing[0].stimulus).toBeUndefined()
    expect(noBody.sections[0].writing[0].prompt).toBe('Nur Prompt')
  })
})

describe('đề Goethe không đổi', () => {
  it('không khai stimulus/cờ xáo thì prompt và thứ tự ý y như cũ', () => {
    const parsed = parseExamSections(exam({
      teil: 2, input_email: 'Betreff: Neue Wohnung', writing_points: ['Wo du wohnst', 'Wann Sara kommt'],
    }))
    const task = parsed.sections[0].writing[0]
    expect(task.stimulus).toBeUndefined()
    expect(task.prompt).toBe('Betreff: Neue Wohnung')
    expect(task.points).toEqual(['Wo du wohnst', 'Wann Sara kommt'])
  })
})

describe('writingTask (bản app sinh đôi bản web)', () => {
  it('xáo thật, ổn định, không hỏng mảng gốc; hai ý luôn đảo', () => {
    const out = orderedWritingPoints(POINTS, true)
    expect(out).not.toEqual(POINTS)
    expect([...out].sort()).toEqual([...POINTS].sort())
    expect(orderedWritingPoints(POINTS, true)).toEqual(out)
    expect(orderedWritingPoints(POINTS, false)).toEqual(POINTS)
    expect(orderedWritingPoints(['a', 'b'], true)).toEqual(['b', 'a'])
  })

  it('isWritingStimulus cần thân văn bản không rỗng', () => {
    expect(isWritingStimulus({ body: 'Hallo' })).toBe(true)
    expect(isWritingStimulus({ body: ' ' })).toBe(false)
    expect(isWritingStimulus(null)).toBe(false)
  })
})
