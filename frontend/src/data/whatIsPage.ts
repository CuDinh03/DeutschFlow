/**
 * Nội dung trang "myDeutschFlow là gì?" (`/mydeutschflow-la-gi/`, 13/11/2026) — tách khỏi page.tsx vì
 * Next không cho file trang export hằng số tuỳ ý; test và sitemap đọc từ đây.
 *
 * Luật nội dung (sổ lời hứa): mọi khẳng định lấy từ catalog trang chủ (`messages/v2/landing.vi.json`),
 * giữ đủ lưu ý (chấm Nói Beta, B2 đang xây dựng, chưa có C1, đề thi nghề nghiệp đang biên soạn,
 * nhà tuyển dụng sắp có). Không hứa đỗ visa, không số liệu người dùng, không giá (owner 13/11/2026).
 */
export const PATH = '/mydeutschflow-la-gi/'
export const TITLE = 'myDeutschFlow là gì? Cách luyện phỏng vấn tiếng Đức với AI'
export const DESCRIPTION =
  'myDeutschFlow giúp người Việt luyện phỏng vấn tiếng Đức theo đúng nghề với AI, học A1–B1 và thi thử telc B1. Xem cách dùng và chi phí.'
export const H1 = 'myDeutschFlow là gì? Cách luyện phỏng vấn tiếng Đức với AI'
export const FOUNDER = 'Đinh Huy Cự'

export const PATHWAYS = [
  { name: 'Học nghề (Ausbildung)', level: 'B1, đôi khi B2', exam: 'Goethe hoặc telc B1', interview: 'Động lực, kế hoạch, hiểu biết về nghề và nước Đức', fit: 'Lộ trình A1–B1, phỏng vấn theo nghề, thi thử B1' },
  { name: 'Công nhận bằng nghề (Anerkennung)', level: 'B1–B2, tuỳ nghề và bang', exam: 'Kỳ thi nghề nghiệp như telc Pflege, DTB', interview: 'Chuyên môn, tình huống trong nghề, quy trình', fit: 'Phỏng vấn theo nghề. Đề thi nghề nghiệp đang được biên soạn' },
  { name: 'Tìm việc (Chancenkarte, Blaue Karte)', level: 'Từ A1, hoặc B2 tiếng Anh', exam: 'Tuỳ nhà tuyển dụng', interview: 'Chuyên môn; tiếng Đức là lợi thế', fit: 'Phỏng vấn cho IT, kỹ thuật, văn phòng' },
  { name: 'Du học đại học (Studium)', level: 'Thường B2–C1', exam: 'TestDaF, DSH, Goethe C1', interview: 'Phỏng vấn trường, phỏng vấn visa', fit: 'Luyện nói, thi thử telc B1. Chưa có lộ trình C1' },
  { name: 'Đoàn tụ, định cư (Familiennachzug)', level: 'A1 khi xin visa, B1 khi định cư lâu dài', exam: 'Start Deutsch A1, DTZ', interview: 'Phỏng vấn visa, đời sống hằng ngày', fit: 'Lộ trình từ A1, luyện nói đời sống hằng ngày' },
] as const

export const FAQS = [
  {
    q: 'Người mới từ con số 0 dùng được không?',
    a: 'Được. Lộ trình bắt đầu từ A1: bảng chữ cái, chào hỏi, giới thiệu bản thân. Luyện phỏng vấn theo nghề phù hợp nhất từ khoảng A2.',
  },
  {
    q: 'Nghề của tôi không có trong danh sách thì sao?',
    a: 'Gõ tên nghề vào ô "Bạn làm nghề gì?". Nghề đã có bộ câu hỏi riêng sẽ hiện câu hỏi mẫu. Nghề chưa có thì AI dùng bộ câu hỏi chung, điều chỉnh theo vị trí bạn nhập.',
  },
  {
    q: 'AI chấm có chính xác không? Điểm có thay chứng chỉ không?',
    a: 'AI chỉ ra lỗi ngữ pháp, từ dùng chưa đúng và ý còn thiếu, kèm câu sửa. Điểm dùng để theo dõi tiến bộ, không thay cho kỳ thi thật. Thi thử telc B1 mô phỏng format đề, không liên kết với telc và không phải chứng chỉ.',
  },
  {
    q: 'Có mất phí không?',
    a: 'Bạn bắt đầu miễn phí, không cần thanh toán trước, và có 7 ngày Pro khi đăng ký. Sau đó bài học và ôn từ vựng vẫn miễn phí; luyện nói, phỏng vấn và chấm bài bằng AI cần gói trả phí. Giá các gói ở trang Chi phí (mydeutschflow.com/chi-phi/).',
  },
  {
    q: 'Ghi âm của tôi được xử lý thế nào?',
    a: 'Bản ghi âm được chuyển thành chữ để chấm và nhận xét. Thời gian lưu và cách yêu cầu xoá được ghi trong Chính sách bảo mật.',
  },
] as const
