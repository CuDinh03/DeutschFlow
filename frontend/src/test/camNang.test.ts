/**
 * Cẩm nang (đợt D, 08/11/2026): câu hỏi trong bài phải là câu ĐÃ DUYỆT của sản phẩm, chép nguyên văn —
 * không được bịa câu "AI sẽ hỏi". Bộ câu hỏi chép từ ngân hàng ở `interviewSamples` (đã có test đối chiếu Java).
 */
import { describe, expect, it } from 'vitest'
import { GUIDE_ARTICLES, guideArticle, guideDocumentTitle, guideUpdated } from '@/data/camNang'
import { INTERVIEW_SAMPLES, COMMON_INTRO_QUESTION, fillPosition } from '@/data/interviewSamples'

describe('Cẩm nang', () => {
  it('bài nghề bếp chép nguyên văn ba câu đầu của bộ câu Klaus đã duyệt', () => {
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

  it('tiêu đề thẻ title ≤ 60 ký tự; có tên thương hiệu khi còn chỗ', () => {
    for (const a of GUIDE_ARTICLES) {
      const t = guideDocumentTitle(a.title)
      expect(t.length).toBeLessThanOrEqual(60)
      if (`${a.title} · myDeutschFlow`.length <= 60) expect(t).toMatch(/ · myDeutschFlow$/)
    }
    expect(guideDocumentTitle('Ngắn')).toBe('Ngắn · myDeutschFlow')
  })

  it('lời mở bài không khẳng định buổi luyện chỉ có ba chủ đề cố định', () => {
    for (const a of GUIDE_ARTICLES) expect(a.intro).not.toMatch(/câu hỏi xoay quanh/)
  })

  it('tên bài ≤ 44 ký tự để title luôn giữ đuôi thương hiệu (đặc tả SEO 18/11, M2)', () => {
    for (const a of GUIDE_ARTICLES) {
      expect(a.title.length, a.slug).toBeLessThanOrEqual(44)
      expect(guideDocumentTitle(a.title)).toBe(`${a.title} · myDeutschFlow`)
    }
  })

  it('bài theo nghề không tranh cụm từ khoá của trang nghề (M7)', () => {
    const fold = (t: string) => t.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    for (const a of GUIDE_ARTICLES) {
      const t = fold(a.title)
      expect(t, a.slug).not.toMatch(/^phong van tieng duc (nghe|nganh)/)
      expect(t, a.slug).not.toContain('cau hoi')
      expect(t, a.slug).toMatch(/tra loi|mau cau|tu vung/)
      expect(a.title, a.slug).not.toBe(a.h1)
    }
  })

  it('ngày cập nhật hợp lệ và không trước ngày đăng', () => {
    for (const a of GUIDE_ARTICLES) {
      const u = guideUpdated(a)
      expect(u).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(u >= a.published, a.slug).toBe(true)
    }
    expect(guideUpdated({ published: '2026-01-02' })).toBe('2026-01-02')
  })

  it('không nêu yêu cầu trình độ hay câu "7 ngày Pro" khi chưa có nguồn/chưa đúng sản phẩm', () => {
    for (const a of GUIDE_ARTICLES) {
      const text = JSON.stringify(a)
      expect(text, a.slug).not.toMatch(/7 ngày Pro/)
      expect(text, a.slug).not.toMatch(/yêu cầu (từ )?B[12]/)
    }
  })
})
