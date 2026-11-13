/**
 * Liên kết nội bộ của trang nghề (cụm chủ đề, SEO 13/11/2026): trang tổng `/phong-van/` là trang trụ,
 * mỗi trang nghề dẫn sang các nghề cùng nơi làm việc, bài Cẩm nang cùng nghề và kỳ thi chuyên ngành.
 * Module thuần — trang server truyền dữ liệu vào, test gọi thẳng.
 */
import { GUIDE_ARTICLES, type GuideArticle } from '@/data/camNang'
import type { IndexableOccupation, OccupationDetail, OccupationSummary, Workplace } from '@/lib/occupationTypes'

export const MAX_RELATED = 5

/**
 * Tối đa `MAX_RELATED` nghề cùng nơi làm việc, bỏ chính nó, giữ thứ tự danh mục. Chỉ dẫn tới trang
 * được lập chỉ mục — link sang trang `noindex` phí lượt crawl. Backend không trả danh sách lập chỉ mục
 * (`null`) thì lùi về nghề có bộ câu hỏi viết tay, chắc chắn đã duyệt (cùng cách sitemap lùi).
 */
export function relatedOccupations(
  self: Pick<OccupationSummary, 'code' | 'workplace'>,
  all: OccupationSummary[] | null,
  indexable: IndexableOccupation[] | null,
): OccupationSummary[] {
  if (!all) return []
  const ok = indexable ? new Set(indexable.map((i) => i.code)) : null
  return all
    .filter((o) => o.workplace === self.workplace && o.code !== self.code)
    .filter((o) => (ok ? ok.has(o.code) : o.questionSet === 'CURATED'))
    .slice(0, MAX_RELATED)
}

/** Bài Cẩm nang đã đăng (không phải nháp) viết riêng cho nghề này — chỉ tiếng Việt. */
export function guideForOccupation(code: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((a) => a.occupationCode === code)
}

/** Kỳ thi chuyên ngành theo nơi làm việc (sổ tay SEO 4c: telc Pflege ↔ trang nghề điều dưỡng). */
const WORKPLACE_EXAMS: Partial<Record<Workplace, { slug: string; name: string }>> = {
  pflege: { slug: 'telc-pflege-b1-b2', name: 'telc Deutsch B1·B2 Pflege' },
}

export function examForWorkplace(workplace: Workplace): { slug: string; name: string } | undefined {
  return WORKPLACE_EXAMS[workplace]
}

/**
 * Câu ví dụ cho câu trả lời ngắn "nghề này thường hỏi gì": câu tiêu biểu đầu tiên KHÔNG phải câu mời
 * giới thiệu (đã nói trong câu trả lời), rồi tới câu lớp nghề đã duyệt. Không có thì `null` — câu
 * trả lời bỏ phần ví dụ thay vì bịa câu.
 */
export function exampleQuestion(detail: Pick<OccupationDetail, 'sampleQuestions' | 'occupationQuestions'>): string | null {
  const sample = detail.sampleQuestions.find((q) => q.phase !== 'INTRO')
  if (sample) return sample.questionDe
  const approved = detail.occupationQuestions.find((q) => q.status === 'APPROVED')
  return approved ? approved.questionDe : null
}
