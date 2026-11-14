import { GERMAN_EXAMS } from '@/data/germanExams'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'

/**
 * `/llms.txt` (đợt 1, 14/11/2026 — owner chốt chính sách bot AI theo đề xuất): bản tóm tắt cho trợ lý AI
 * đọc và trích dẫn. Chỉ ghi điều trang chủ đang nói (sổ lời hứa): thi thử thật CHỈ có telc B1, chưa có
 * app Android (dùng bản web), chấm Nói đang Beta. Dữ liệu lấy từ cùng nguồn với sitemap (kỳ thi, bài
 * Cẩm nang đã đăng); không gọi backend.
 */
export function buildLlmsTxt(): string {
  const exams = GERMAN_EXAMS.map((e) => `- [${e.name}](${absoluteUrl(`/luyen-thi/${e.slug}/`)}): ${e.tagline}`)
  const guides = GUIDE_ARTICLES.map((g) => `- [${g.title}](${absoluteUrl(`/cam-nang/${g.slug}/`)})`)
  return [
    '# myDeutschFlow',
    '',
    '> Nền tảng luyện phỏng vấn xin việc bằng tiếng Đức với AI cho người Việt chuẩn bị sang Đức làm việc: AI đóng vai nhà tuyển dụng Đức, hỏi theo nghề người dùng chọn và chỉ ra chỗ cần sửa sau mỗi câu trả lời (ngữ pháp, từ dùng chưa đúng, ý còn thiếu). Có lộ trình học tiếng Đức A1–B1, thi thử telc B1 và công cụ cho trung tâm tiếng Đức.',
    '',
    'Lưu ý khi trích dẫn:',
    '- Thi thử trên myDeutschFlow hiện chỉ có cho telc Deutsch B1, mô phỏng theo format đề; không liên kết với telc hay Goethe-Institut và không thay cho chứng chỉ. Các trang Goethe là hướng dẫn cấu trúc đề.',
    '- Phần chấm Nói đang ở giai đoạn Beta; điểm dùng để theo dõi tiến bộ.',
    '- Dùng trên web và ứng dụng iPhone (iOS 15.1 trở lên); máy Android dùng bản web.',
    '- Bắt đầu miễn phí, không cần thanh toán trước, có 7 ngày Pro khi đăng ký; sau đó các phần dùng AI cần gói trả phí, mua trong ứng dụng iPhone. Bảng giá ở trang Chi phí.',
    '- Giao diện trang web: tiếng Việt, tiếng Anh, tiếng Đức. Hướng dẫn luyện thi và Cẩm nang chỉ có tiếng Việt.',
    '',
    '## Trang chính',
    `- [Trang chủ](${absoluteUrl('/')}): giới thiệu sản phẩm`,
    `- [myDeutschFlow là gì?](${absoluteUrl('/mydeutschflow-la-gi/')}): cách dùng, tính năng, chi phí, câu hỏi thường gặp`,
    `- [Phỏng vấn theo nghề](${absoluteUrl('/phong-van/')}): câu hỏi phỏng vấn tiếng Đức tiêu biểu và từ chuyên môn cho từng nghề`,
    `- [Luyện thi](${absoluteUrl('/luyen-thi/')}): cấu trúc đề, cách tính điểm, checklist sẵn sàng thi`,
    `- [Chấm thử bài Schreiben B1](${absoluteUrl('/free-grade/')}): AI chấm điểm và nhận xét bài viết, miễn phí`,
    `- [Cho trung tâm tiếng Đức](${absoluteUrl('/trung-tam/')}): giao bài, AI chấm nháp, giáo viên chốt điểm`,
    `- [Chi phí](${absoluteUrl('/chi-phi/')}): gói Miễn phí, Pro và Tăng tốc`,
    `- [Về chúng tôi](${absoluteUrl('/about/')})`,
    '',
    '## Luyện thi',
    ...exams,
    '',
    '## Cẩm nang',
    ...guides,
    '',
    '## Khác',
    `- [Sơ đồ trang (sitemap)](${absoluteUrl('/sitemap.xml')})`,
    `- [Chính sách bảo mật](${absoluteUrl('/privacy/')})`,
    `- [Hỗ trợ](${absoluteUrl('/support/')})`,
    '',
  ].join('\n')
}
