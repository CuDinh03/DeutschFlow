/**
 * Cẩm nang (đợt D, 08/11/2026): câu hỏi trong bài phải là câu ĐÃ DUYỆT của sản phẩm, chép nguyên văn —
 * không được bịa câu "AI sẽ hỏi". Bộ câu hỏi chép từ ngân hàng ở `interviewSamples` (đã có test đối chiếu Java).
 */
import { describe, expect, it } from 'vitest'
import { GUIDE_ARTICLES, guideArticle } from '@/data/camNang'
import { INTERVIEW_SAMPLES, COMMON_INTRO_QUESTION, fillPosition } from '@/data/interviewSamples'

describe('Cẩm nang', () => {
  it('bài nghề bếp dùng đúng ba câu của Klaus, nguyên văn', () => {
    const a = guideArticle('phong-van-tieng-duc-nghe-bep')!
    const bank = [COMMON_INTRO_QUESTION, ...INTERVIEW_SAMPLES.klaus].map((q) => fillPosition(q, a.occupationNameDe))
    expect(a.questions.map((q) => q.de)).toEqual(bank.slice(0, a.questions.length))
  })

  it('slug duy nhất, ngày đăng hợp lệ, mỗi bài có FAQ và câu trả lời mẫu', () => {
    expect(new Set(GUIDE_ARTICLES.map((a) => a.slug)).size).toBe(GUIDE_ARTICLES.length)
    for (const a of GUIDE_ARTICLES) {
      expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.faqs.length).toBeGreaterThan(0)
      for (const q of a.questions) expect(q.sample.length).toBeGreaterThan(0)
    }
  })
})
