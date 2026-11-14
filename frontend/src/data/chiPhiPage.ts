/**
 * Nội dung trang "Chi phí" (`/chi-phi/`, 14/11/2026). Tách khỏi page.tsx vì Next.js không cho file trang
 * xuất thêm hằng số, và để test đọc được.
 *
 * Nguồn: quyết định owner 14/11/2026 (QĐ-QG-17..26 trong `plans/2026-11-11-audit-3-quota-gia-QUYET-DINH.md`),
 * đặc tả `plans/2026-11-14-chi-phi-noi-dung.md`. Khớp migration V387 và `mobile/lib/iapProducts.ts`.
 *
 * Luật (sổ lời hứa QLT-19 + Apple 3.1.2): số tiền bị trừ mỗi kỳ là chữ lớn nhất; số quy ra tháng chỉ là dòng
 * phụ; không gạch giá, không đếm ngược, không nhãn "phổ biến nhất" (chưa có người mua), không hứa kết quả.
 * Chỉ ghi quyền có thật: trong code chỉ ví token và bộ đề cần trả tiền chặn quyền (features_json không chặn gì).
 * Owner 14/11/2026: KHÔNG ghi hạn mức AI bằng số token — nói bằng số phiên nói và "gấp đôi Pro".
 */

export const PATH = '/chi-phi/'
export const TITLE = 'Chi phí myDeutschFlow: gói Miễn phí, Pro và Tăng tốc'
export const DESCRIPTION =
  'Bảng giá myDeutschFlow: Pro 249.000₫ một tháng hoặc 399.000₫ hai tháng, mua trong app iPhone. Học thử 7 ngày Pro, không cần thanh toán trước.'
export const H1 = 'Chi phí myDeutschFlow'
export const INTRO =
  'Bạn bắt đầu miễn phí, không cần thanh toán trước, và học viên mới có ngay 7 ngày Pro để dùng thử mọi phần luyện AI. Gói Pro giá 249.000₫ một tháng hoặc 399.000₫ cho 2 tháng, mua trong app iPhone và tự gia hạn.'

export type PlanCta = 'start' | 'appStore'

export interface PricePlan {
  readonly id: 'free' | 'pro-month' | 'pro-2m' | 'boost-2m'
  readonly name: string
  /** Số tiền bị trừ mỗi kỳ — chữ lớn nhất trên thẻ. */
  readonly price: string
  readonly period?: string
  /** Dòng phụ nhỏ: quy ra tháng, so sánh thật với gói tháng. */
  readonly perMonthNote?: string
  /** Chỉ gói chính có nhãn. */
  readonly badge?: string
  readonly features: readonly string[]
  readonly limit?: string
  readonly renew?: string
  readonly cta: PlanCta
  readonly ctaLabel: string
}

const PRO_FEATURES = [
  'Hạn mức AI mỗi ngày đủ khoảng 4–5 phiên nói 10 lượt',
  'Hạn mức chưa dùng được cộng dồn, tối đa 30 ngày',
  'Luyện phỏng vấn tiếng Đức theo nghề, có nhận xét sau từng câu',
  'Đề thi thử telc B1 đủ 4 phần',
  'Chấm bài viết, chấm Nói (Beta)',
] as const

export const PLANS: readonly PricePlan[] = [
  {
    id: 'free',
    name: 'Miễn phí',
    price: '0₫',
    features: [
      'Bài học từ vựng và ngữ pháp A1–B1',
      'Ôn tập từ vựng ngắt quãng mỗi ngày',
      '7 ngày Pro khi đăng ký: luyện nói, phỏng vấn theo nghề, thi thử telc B1',
      'Chấm thử một bài viết Schreiben B1 ở trang Chấm thử miễn phí',
    ],
    limit:
      'Hết 7 ngày dùng thử, các phần dùng AI (luyện nói, phỏng vấn, chấm bài) và đề thi thử telc B1 tạm khoá cho tới khi bạn nâng cấp.',
    cta: 'start',
    ctaLabel: 'Học thử miễn phí',
  },
  {
    id: 'pro-month',
    name: 'Pro tháng',
    price: '249.000₫',
    period: 'mỗi tháng',
    features: PRO_FEATURES,
    renew: 'Tự gia hạn mỗi tháng · Huỷ trong Cài đặt Apple ID',
    cta: 'appStore',
    ctaLabel: 'Mua trong app iPhone',
  },
  {
    id: 'pro-2m',
    name: 'Pro 2 tháng',
    price: '399.000₫',
    period: 'mỗi 2 tháng',
    perMonthNote: '≈ 199.500₫ mỗi tháng · ít hơn 99.000₫ so với hai kỳ gói tháng (498.000₫)',
    badge: 'Gói chính',
    features: ['Mọi quyền của Pro tháng', ...PRO_FEATURES.slice(0, 2), 'Hợp với một đợt ôn phỏng vấn hoặc ôn thi telc B1'],
    renew: 'Tự gia hạn mỗi 2 tháng · Huỷ trong Cài đặt Apple ID',
    cta: 'appStore',
    ctaLabel: 'Mua trong app iPhone',
  },
  {
    id: 'boost-2m',
    name: 'Tăng tốc 2 tháng',
    price: '599.000₫',
    period: 'mỗi 2 tháng',
    perMonthNote: '≈ 299.500₫ mỗi tháng',
    features: ['Mọi quyền của Pro', 'Hạn mức AI mỗi ngày gấp đôi gói Pro', 'Hạn mức chưa dùng được cộng dồn, tối đa 30 ngày'],
    limit: 'Dành cho người luyện hơn 4–5 phiên nói mỗi ngày. Nếu bạn luyện ít hơn, gói Pro là đủ.',
    renew: 'Tự gia hạn mỗi 2 tháng · Huỷ trong Cài đặt Apple ID',
    cta: 'appStore',
    ctaLabel: 'Mua trong app iPhone',
  },
]

export const PLANS_FOOTNOTE =
  'Thời gian dùng thử 7 ngày do myDeutschFlow cấp, không qua App Store: không cần thanh toán trước, không tự trừ tiền, hết hạn tự về gói Miễn phí. Phần chấm Nói đang Beta, điểm chỉ để tham khảo. Số phiên nói là ước tính, tính theo phiên 10 lượt, mỗi lượt khoảng 15 giây.'

export const ANDROID_NOTE = {
  title: 'Bạn dùng Android?',
  body: 'Chưa có app Android, bạn học trên bản web với cùng một tài khoản. Hiện chưa mua gói được trên web, chỉ nâng cấp được trong app iPhone. Muốn nâng cấp khi chỉ có Android, hãy viết cho support@mydeutschflow.com.',
} as const

export const WHICH_PLAN: readonly { who: string; plan: string }[] = [
  { who: 'Mới học A1, muốn xem cách học trước', plan: 'Gói Miễn phí và 7 ngày Pro, chưa cần mua gì.' },
  { who: 'Có buổi phỏng vấn hoặc kỳ thi telc B1 trong khoảng 8 tuần tới', plan: 'Pro 2 tháng.' },
  { who: 'Chỉ cần một tháng, hoặc muốn trả từng tháng', plan: 'Pro tháng.' },
  { who: 'Ngày nào cũng luyện nói nhiều hơn 4–5 phiên', plan: 'Tăng tốc 2 tháng.' },
  { who: 'Đang học ở trung tâm có dùng myDeutschFlow', plan: 'Hỏi trung tâm trước, có thể bạn đã được cấp quyền.' },
]

export const COMPARE_COLUMNS = ['Miễn phí (sau dùng thử)', 'Pro tháng', 'Pro 2 tháng', 'Tăng tốc'] as const

export const COMPARE_ROWS: readonly { label: string; cells: readonly [string, string, string, string] }[] = [
  { label: 'Giá mỗi kỳ', cells: ['0₫', '249.000₫ / tháng', '399.000₫ / 2 tháng', '599.000₫ / 2 tháng'] },
  { label: 'Bài học từ vựng, ngữ pháp A1–B1', cells: ['Có', 'Có', 'Có', 'Có'] },
  { label: 'Ôn tập từ vựng ngắt quãng', cells: ['Có', 'Có', 'Có', 'Có'] },
  { label: 'Hạn mức AI mỗi ngày', cells: ['Không có', 'Khoảng 4–5 phiên nói', 'Khoảng 4–5 phiên nói', 'Gấp đôi Pro'] },
  { label: 'Cộng dồn hạn mức chưa dùng', cells: ['—', 'Tối đa 30 ngày', 'Tối đa 30 ngày', 'Tối đa 30 ngày'] },
  { label: 'Luyện phỏng vấn theo nghề', cells: ['7 ngày dùng thử', 'Có', 'Có', 'Có'] },
  { label: 'Luyện nói với AI', cells: ['7 ngày dùng thử', 'Có', 'Có', 'Có'] },
  { label: 'Đề thi thử telc B1', cells: ['7 ngày dùng thử', 'Có', 'Có', 'Có'] },
  { label: 'Chấm Nói', cells: ['7 ngày dùng thử', 'Beta', 'Beta', 'Beta'] },
  { label: 'Chấm thử Schreiben B1 (trang công khai)', cells: ['Có', 'Có', 'Có', 'Có'] },
  { label: 'Web và iPhone, chung tài khoản', cells: ['Có', 'Có', 'Có', 'Có'] },
  { label: 'Tự gia hạn', cells: ['—', 'Mỗi tháng', 'Mỗi 2 tháng', 'Mỗi 2 tháng'] },
]

export const COMPARE_NOTE =
  'Hết hạn mức trong ngày, các phần dùng AI tạm dừng và mở lại vào ngày hôm sau (giờ Việt Nam). Gói của bạn vẫn giữ tới hết kỳ.'

/**
 * Trung tâm (B2B): giá KHÔNG công khai trên web (owner 14/11/2026, QĐ-QG-28 thay QĐ-QG-22). Chỉ báo giá trong
 * buổi demo. Không ghi số tiền nào ở khối này.
 */
export const SCHOOL = {
  title: 'Cho trung tâm tiếng Đức',
  body: 'Trung tâm có bảng giá riêng theo số học viên đang học, bắt đầu bằng 2 tuần chạy thử miễn phí. Báo giá trong buổi demo 20 phút.',
  ctaLabel: 'Đặt lịch demo 20 phút',
  ctaHref: '/trung-tam/#dat-lich',
} as const

export const FAQS: readonly { q: string; a: string }[] = [
  {
    q: 'Dùng thử có phải thanh toán trước không?',
    a: 'Không. Học viên mới có 7 ngày Pro ngay khi đăng ký, không cần thanh toán trước. Hết 7 ngày, tài khoản tự về gói Miễn phí và không bị trừ tiền.',
  },
  {
    q: 'Hết 7 ngày dùng thử thì còn dùng được gì?',
    a: 'Bạn vẫn học bài từ vựng, ngữ pháp A1–B1 và ôn tập từ vựng. Luyện nói, phỏng vấn, chấm bài bằng AI và đề thi thử telc B1 cần gói Pro hoặc Tăng tốc.',
  },
  {
    q: 'Huỷ gia hạn thế nào?',
    a: 'Trên iPhone, vào Cài đặt > Apple ID > Đăng ký, chọn myDeutschFlow rồi huỷ. Bạn vẫn dùng gói tới hết kỳ đã trả.',
  },
  {
    q: 'Tôi muốn hoàn tiền thì làm sao?',
    a: 'Gói mua qua App Store nên Apple xử lý hoàn tiền. Bạn gửi yêu cầu tại reportaproblem.apple.com.',
  },
  {
    q: 'Tôi dùng Android, nâng cấp thế nào?',
    a: 'Chưa có app Android, bạn học trên bản web. Hiện chưa mua gói được trên web, chỉ nâng cấp được trong app iPhone. Muốn nâng cấp khi chỉ có Android, hãy viết cho support@mydeutschflow.com.',
  },
  {
    q: 'Mua trên iPhone thì dùng trên web được không?',
    a: 'Được. Gói gắn với tài khoản myDeutschFlow, nên bạn đăng nhập trên web cũng dùng được.',
  },
  {
    q: 'Hết hạn mức AI trong ngày thì sao?',
    a: 'Các phần dùng AI tạm dừng và mở lại vào ngày hôm sau, tính theo giờ Việt Nam. Gói của bạn vẫn giữ tới hết kỳ. Hạn mức của những ngày chưa dùng được cộng dồn, tối đa 30 ngày.',
  },
  {
    q: 'Mua gói có giúp tôi đỗ telc B1 không?',
    a: 'Không gói nào bảo đảm kết quả thi. Đề thi thử mô phỏng format telc B1, không liên kết với telc và không thay cho chứng chỉ.',
  },
]
