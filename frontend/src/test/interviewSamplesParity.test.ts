import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COMMON_INTRO_QUESTION, INTERVIEW_SAMPLES } from '@/data/interviewSamples'
import { PERSONA_LIST } from '@/lib/personas'

/**
 * Câu hỏi mẫu trên trang chủ phải là câu AI THẬT SỰ hỏi trong app (đợt 1 A+B+E, sổ lời hứa).
 * Đọc thẳng ngân hàng câu hỏi Java, ghép các chuỗi nối `" + pos + "` thành `{pos}` rồi so khớp.
 */
const BANK = join(__dirname, '..', '..', '..', 'backend', 'src', 'main', 'java', 'com', 'deutschflow',
  'speaking', 'interview', 'InterviewQuestionBank.java')

function bankText(): string {
  return readFileSync(BANK, 'utf8')
    .replace(/"\s*\+\s*pos\s*\+\s*"/g, '{pos}') // "… für " + pos + " …"  → "… für {pos} …"
    .replace(/"\s*\+\s*pos\s*\+?\s*\)/g, '{pos}")') // "… für " + pos)       → "… für {pos}")
    .replace(/"\s*\+\s*\r?\n\s*"/g, '') // chuỗi bẻ dòng
}

describe('câu hỏi mẫu trên landing khớp InterviewQuestionBank', () => {
  const bank = bankText()

  it('câu mở đầu dùng chung có trong bank', () => {
    expect(bank).toContain(`"${COMMON_INTRO_QUESTION}"`)
  })

  for (const [persona, questions] of Object.entries(INTERVIEW_SAMPLES)) {
    it(`câu hỏi của ${persona} có trong bank`, () => {
      for (const q of questions) expect(bank, q).toContain(q)
    })
  }

  it('mọi nhân vật có phỏng vấn trên web đều có câu hỏi mẫu', () => {
    const interviewPersonas = PERSONA_LIST.filter((p) => p.supportsInterview).map((p) => p.id).sort()
    expect(Object.keys(INTERVIEW_SAMPLES).sort()).toEqual(interviewPersonas)
  })
})
