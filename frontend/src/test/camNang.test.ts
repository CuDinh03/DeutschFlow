/**
 * Cẩm nang (đợt D, 08/11/2026): câu hỏi trong bài phải là câu ĐÃ DUYỆT của sản phẩm, chép nguyên văn —
 * không được bịa câu "AI sẽ hỏi". Bộ câu hỏi chép từ ngân hàng ở `interviewSamples` (đã có test đối chiếu Java).
 */
import { describe, expect, it } from 'vitest'
import { ALL_GUIDE_ARTICLES, GUIDE_ARTICLES, guideArticle, guideDocumentTitle, publishedRelated } from '@/data/camNang'
import {
  INTERVIEW_SAMPLES,
  COMMON_FOUND_ROLE_QUESTION,
  COMMON_INTRO_QUESTION,
  COMMON_MOTIVATION_QUESTION,
  fillPosition,
} from '@/data/interviewSamples'

describe('Cẩm nang', () => {
  it('bài nghề bếp chép nguyên văn ba câu đầu của bộ câu Klaus đã duyệt', () => {
    const a = guideArticle('phong-van-tieng-duc-nghe-bep')!
    const bank = [COMMON_INTRO_QUESTION, ...INTERVIEW_SAMPLES.klaus].map((q) => fillPosition(q, a.occupationNameDe!))
    expect(a.questions.map((q) => q.de)).toEqual(bank.slice(0, a.questions.length))
  })

  it('bài giới thiệu bản thân chép nguyên văn ba câu dùng chung, ghép tên vị trí như app', () => {
    const a = guideArticle('gioi-thieu-ban-than-bang-tieng-duc')!
    expect(a.questions.map((q) => q.de)).toEqual([
      fillPosition(COMMON_INTRO_QUESTION, 'Pflegefachmann/-frau'),
      fillPosition(COMMON_MOTIVATION_QUESTION, 'Pflegefachmann/-frau'),
      COMMON_FOUND_ROLE_QUESTION,
    ])
  })

  it('bản nháp không vào danh sách công khai và không được bài khác dẫn link tới', () => {
    const drafts = ALL_GUIDE_ARTICLES.filter((a) => a.draft)
    for (const d of drafts) {
      expect(GUIDE_ARTICLES).not.toContain(d)
      for (const a of ALL_GUIDE_ARTICLES) expect(publishedRelated(a).map((r) => r.href)).not.toContain(`/cam-nang/${d.slug}/`)
    }
  })

  it('title tối đa 60 ký tự, mô tả 120–160 ký tự, có ít nhất 3 link nội bộ', () => {
    // Áp cho bài từ 13/11/2026 (sổ tay SEO); bài nghề bếp đăng trước đó giữ tiêu đề cũ.
    for (const a of ALL_GUIDE_ARTICLES.filter((g) => g.published >= '2026-11-13')) {
      expect(a.title.length, a.title).toBeLessThanOrEqual(60)
      expect(a.description.length, a.description).toBeGreaterThanOrEqual(120)
      expect(a.description.length, a.description).toBeLessThanOrEqual(160)
      expect(a.related!.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('slug duy nhất, ngày đăng hợp lệ, mỗi bài có FAQ và câu trả lời mẫu', () => {
    expect(new Set(ALL_GUIDE_ARTICLES.map((a) => a.slug)).size).toBe(ALL_GUIDE_ARTICLES.length)
    for (const a of ALL_GUIDE_ARTICLES) {
      expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.faqs.length).toBeGreaterThan(0)
      for (const q of a.questions) expect(q.sample.length).toBeGreaterThan(0)
    }
  })

  it('tiêu đề thẻ title có tên thương hiệu', () => {
    for (const a of GUIDE_ARTICLES) expect(guideDocumentTitle(a.title)).toMatch(/ · myDeutschFlow$/)
  })

  it('lời mở bài không khẳng định buổi luyện chỉ có ba chủ đề cố định', () => {
    for (const a of GUIDE_ARTICLES) expect(a.intro).not.toMatch(/câu hỏi xoay quanh/)
  })
})
