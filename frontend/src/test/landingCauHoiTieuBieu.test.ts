/**
 * Sổ lời hứa (08/11/2026): câu hỏi phỏng vấn trên trang công khai chỉ là câu "tiêu biểu".
 * Buổi luyện thật lấy câu từ lớp câu theo nghề, bảng `interview_question` và bộ câu tĩnh, cộng các phần
 * mở đầu/kết thúc (`PersonaInterviewRegistry.pickQuestion`), nên trang không được hứa "AI sẽ hỏi đúng câu này".
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const PROMISES: Record<string, RegExp[]> = {
  vi: [/AI sẽ hỏi/i, /câu họ sẽ hỏi/i, /câu hỏi thật/i, /câu nữa trong buổi thử/i],
  en: [/AI will ask/i, /real questions/i, /in the trial session/i],
  de: [/stellt Ihnen Fragen/i, /Fragen stellt die KI/i, /echte Fragen/i, /in der Probesitzung/i],
}

function load(locale: string) {
  const file = path.resolve(__dirname, `../../messages/v2/landing.${locale}.json`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

describe('Trang công khai: câu hỏi phỏng vấn chỉ là câu tiêu biểu', () => {
  for (const [locale, patterns] of Object.entries(PROMISES)) {
    it(`${locale}: ô xem trước nghề, khối người phỏng vấn và trang nghề không hứa câu hỏi chính xác`, () => {
      const msg = load(locale)
      const parts = [msg.landing.explorer, msg.landing.cast, msg.landing.occupationPages]
      for (const part of parts) expect(part).toBeTruthy()
      const text = JSON.stringify(parts)
      for (const p of patterns) expect(text).not.toMatch(p)
    })
  }
})
