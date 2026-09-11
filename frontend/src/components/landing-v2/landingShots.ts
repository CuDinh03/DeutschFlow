import type { StaticImageData } from 'next/image'

import classReportVi from '../../assets/landing/vi/teacher-class-report.webp'
import classReportEn from '../../assets/landing/en/teacher-class-report.webp'
import classReportDe from '../../assets/landing/de/teacher-class-report.webp'
import gradingVi from '../../assets/landing/vi/teacher-grading.webp'
import gradingEn from '../../assets/landing/en/teacher-grading.webp'
import gradingDe from '../../assets/landing/de/teacher-grading.webp'
import roadmapVi from '../../assets/landing/vi/student-roadmap-tree.webp'
import roadmapEn from '../../assets/landing/en/student-roadmap-tree.webp'
import roadmapDe from '../../assets/landing/de/student-roadmap-tree.webp'
import examVi from '../../assets/landing/vi/student-mock-exam.webp'
import examEn from '../../assets/landing/en/student-mock-exam.webp'
import examDe from '../../assets/landing/de/student-mock-exam.webp'

/**
 * Ảnh chụp THẬT từ sản phẩm dùng trên trang chủ, tra theo locale.
 *
 * Chữ trong ảnh được "nướng cứng" vào file, mà landing thì dịch cả ba thứ tiếng — nên mỗi màn có
 * ba bản. Khách xem trang tiếng Đức phải thấy giao diện tiếng Đức, không phải ảnh tiếng Việt.
 *
 * Import TĨNH (không phải chuỗi đường dẫn) là cố ý: next/image lấy sẵn kích thước thật từ đây nên
 * ô ảnh giữ đúng chỗ ngay từ khung hình đầu, không đẩy nội dung khi ảnh tải xong (CLS = 0), và
 * một file thiếu sẽ làm ĐỔ BUILD thay vì thành ảnh 404 lặng lẽ trên production.
 *
 * Dữ liệu trong ảnh là minh hoạ (lớp K30 dựng sẵn), không phải người thật. Chụp lại:
 *   npx playwright test tests/e2e/landing/__product-shots.spec.ts
 *   node scripts/build-landing-shots.mjs
 *
 * Ảnh nằm ở `src/assets/`, KHÔNG phải `public/`: import tĩnh đã đưa chúng vào `_next/static/`,
 * để trong `public/` nữa thì mỗi bản deploy mang HAI bản của cùng 12 tấm mà bản kia không ai gọi.
 */
export type ShotName = 'classReport' | 'grading' | 'roadmap' | 'exam'

const SHOTS: Record<ShotName, Record<string, StaticImageData>> = {
  classReport: { vi: classReportVi, en: classReportEn, de: classReportDe },
  grading: { vi: gradingVi, en: gradingEn, de: gradingDe },
  roadmap: { vi: roadmapVi, en: roadmapEn, de: roadmapDe },
  exam: { vi: examVi, en: examEn, de: examDe },
}

/** Ảnh theo locale; locale lạ (hoặc chưa chụp) rơi về bản tiếng Việt thay vì ô trống. */
export function shotFor(name: ShotName, locale: string): StaticImageData {
  return SHOTS[name][locale] ?? SHOTS[name].vi
}
