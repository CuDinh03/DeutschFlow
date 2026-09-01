/**
 * Bảng redirect cây v1 → Galerie v2.
 *
 * VÌ SAO Ở next.config CHỨ KHÔNG PHẢI middleware: Amplify phục vụ phần lớn route từ cache
 * CloudFront mà KHÔNG gọi middleware, còn redirect trong next.config được biên dịch vào
 * routes-manifest và áp dụng ở tầng CDN — nên nó bắt được cả lượt truy cập từ cache lẫn từ
 * bookmark/lịch sử trình duyệt (đúng đường mà người dùng rơi ngược về v1 hôm 04/08).
 *
 * `permanent: true` (308) TỪ ĐỢT 3 — trước đó là 307 vì cây v1 vẫn nằm nguyên trên đĩa và phải
 * giữ đường lui khi rollback. Đợt 3 đã XOÁ HẲN cây v1: không còn gì để lui về, đích /v2 là vĩnh
 * viễn, nên 308 là đúng ngữ nghĩa và tiết kiệm một vòng round-trip cho lượt truy cập lặp lại.
 * Đổi ý sau này thì tốn kém: 308 bị trình duyệt cache VĨNH VIỄN — muốn trỏ một path v1 sang đích
 * khác thì phải đổi chính path đó, không sửa được trên máy người dùng đã cache.
 *
 * `trailingSlash: true` (next.config.mjs) → khai báo `source` KHÔNG có dấu "/" cuối; Next tự
 * chuẩn hoá cả hai dạng. Query string được giữ nguyên khi redirect (nên `?token=` của lời mời
 * trung tâm và các tham số callback đi xuyên qua an toàn).
 *
 * THỨ TỰ: Next khớp theo thứ tự mảng, khớp đầu tiên thắng. Mọi `source` dưới đây đều là path
 * CHÍNH XÁC (không có `:path*` bắt tất), nên trên lý thuyết không cặp nào chồng nhau — path
 * -to-regexp khớp đúng số segment. Vẫn xếp cụ-thể-trước-tổng-quát làm thói quen phòng thủ.
 */

/** `[source, destination]` → entry redirect đầy đủ. Tránh lặp `permanent: true` ~100 lần. */
const toPermanent = ([source, destination]) => ({ source, destination, permanent: true })

/**
 * Học viên. Lưu ý vài chỗ ĐỔI TÊN chứ không phải port 1-1:
 * - `/student/practice` ("Bài tập bổ trợ") → `/v2/student/exercises`, không phải
 *   `/v2/student/practice/[nodeId]` (cái sau là phiên luyện theo node, khác hẳn).
 * - `/student/assignments*` KHÔNG có trang phẳng ở v2: bài tập lớp nằm trong
 *   `/v2/student/classes/[id]/assignments/[aid]`, nên đổ về danh sách lớp. `[id]` của v1 không
 *   ánh xạ được sang cặp `[id]/[aid]` của v2 → chấp nhận mất deep-link, vẫn hơn kẹt lại v1.
 * - `/student/leaderboard` → `/v2/student/achievements`: trang thành tích v2 đã bao gồm bảng
 *   xếp hạng (xem `xpApi.getLeaderboard` trong page đó).
 * - `/student/badges` cũng đổ về đúng trang thành tích đó.
 */
const STUDENT = [
  ['/student', '/v2/student/dashboard'],
  ['/student/article-quiz', '/v2/student/vocabulary/article-quiz'],
  ['/student/assessment', '/v2/student/assessment'],
  ['/student/assignments/:id', '/v2/student/classes'],
  ['/student/assignments', '/v2/student/classes'],
  ['/student/badges', '/v2/student/achievements'],
  ['/student/beginner', '/v2/student/beginner'],
  ['/student/book-session', '/v2/student/tutor'],
  ['/student/certificates', '/v2/student/certificates'],
  ['/student/classes/:id', '/v2/student/classes/:id'],
  ['/student/classes', '/v2/student/classes'],
  ['/student/errors', '/v2/student/errors'],
  ['/student/exercise-history', '/v2/student/exercise-history'],
  ['/student/game', '/v2/student/game'],
  ['/student/grammar-practice', '/v2/student/grammar/practice'],
  ['/student/grammar-review', '/v2/student/grammar'],
  ['/student/grammar', '/v2/student/grammar'],
  ['/student/guide', '/v2/student/welcome'],
  ['/student/interviews', '/v2/student/interviews'],
  ['/student/leaderboard', '/v2/student/achievements'],
  ['/student/learn/node/:nodeId', '/v2/student/learn/:nodeId'],
  ['/student/mock-exam/packs/:id', '/v2/student/mock-exam'],
  ['/student/mock-exam/packs', '/v2/student/mock-exam'],
  ['/student/mock-exam', '/v2/student/mock-exam'],
  ['/student/notifications', '/v2/notifications'],
  ['/student/practice-session/:nodeId/:skill', '/v2/student/practice/:nodeId/:skill'],
  ['/student/practice-node/:nodeId', '/v2/student/practice/:nodeId'],
  ['/student/practice', '/v2/student/exercises'],
  ['/student/pricing', '/v2/payment'],
  ['/student/progress', '/v2/student/progress'],
  ['/student/review-queue', '/v2/student/review'],
  ['/student/review', '/v2/student/review'],
  ['/student/roadmap', '/v2/student/roadmap'],
  ['/student/settings', '/v2/profile'],
  ['/student/speaking-history', '/v2/student/speaking/history'],
  ['/student/stats', '/v2/student/stats'],
  ['/student/swipe-cards', '/v2/student/vocabulary/swipe'],
  ['/student/tutor', '/v2/student/tutor'],
  ['/student/vocab-analytics', '/v2/student/vocabulary/analytics'],
  ['/student/vocab-practice', '/v2/student/vocabulary/practice'],
  ['/student/vocabulary', '/v2/student/vocabulary'],
  ['/student/weekly-speaking', '/v2/student/weekly-speaking'],
  // Trang chết của v1 (chỉ hiện "N/A"), không có đích tương ứng ở v2 — đổ về dashboard để lượt
  // truy cập từ bookmark cũ không rơi vào 404 sau khi Đợt 3 xoá file.
  ['/student/groq-usage', '/v2/student/dashboard'],
]

/**
 * Trang học viên nằm ở GỐC (di sản thời chưa có prefix vai trò) — chính nhóm này hay bị
 * bookmark nhất vì URL ngắn.
 *
 * - `/roadmap/setup` là wizard đặt mục tiêu, CHƯA có bản port ở v2 → đổ tạm về lộ trình. Không
 *   làm tình hình xấu đi: người dùng v2 hôm nay vốn đã không có wizard này.
 * - `/game` (gốc) là bản LegoGameScreen, port sang `/v2/student/game/lego`; `/student/game` mới
 *   là trang danh mục trò chơi → hai đích KHÁC nhau, đừng gộp.
 * - `/onboarding` mở cho KHÁCH chưa đăng nhập; `/v2/onboarding` cũng nằm trong
 *   GUEST_ONBOARDING_ROUTES của middleware nên redirect không đá khách về login.
 */
const LEARNER_ROOT = [
  ['/game', '/v2/student/game/lego'],
  ['/lesson', '/v2/student/lessons'],
  ['/news', '/v2/student/news'],
  ['/onboarding/error-report', '/v2/onboarding/error-report'],
  ['/onboarding/mock-exam', '/v2/onboarding/mock-exam'],
  ['/onboarding', '/v2/onboarding'],
  ['/roadmap/setup', '/v2/student/roadmap'],
  ['/roadmap/tree', '/v2/student/roadmap'],
  ['/roadmap', '/v2/student/roadmap'],
  ['/speaking/chat', '/v2/student/speaking/live'],
  ['/speaking', '/v2/student/speaking'],
  ['/vocabulary', '/v2/student/vocabulary'],
]

/**
 * Giáo viên. `/teacher/dashboard/[id]` của v1 chính là trang chi tiết lớp → v2 đổi tên thành
 * `/v2/teacher/classes/[id]`, nơi các tab (Học viên · Bài tập · Thống kê) đã nuốt luôn hai
 * trang con `grammar` và `materials` của v1, nên cả hai đổ về trang lớp thay vì trang công cụ
 * toàn cục (giữ đúng ngữ cảnh lớp mà người dùng đang xem).
 *
 * `/teacher/reports` là SỔ ĐIỂM lớp (in ấn, nhập điểm) → `/v2/teacher/tc-reports`, KHÔNG phải
 * `/v2/teacher/analytics` (trang phân tích giảng dạy, nội dung khác hẳn).
 */
const TEACHER = [
  ['/teacher/dashboard/:id/students/:studentId', '/v2/teacher/classes/:id/students/:studentId'],
  ['/teacher/dashboard/:id/grammar', '/v2/teacher/classes/:id'],
  ['/teacher/dashboard/:id/materials', '/v2/teacher/classes/:id'],
  ['/teacher/dashboard/:id', '/v2/teacher/classes/:id'],
  ['/teacher/dashboard', '/v2/teacher'],
  ['/teacher/classes/:id/lessons', '/v2/teacher/classes/:id'],
  ['/teacher/ai-images', '/v2/teacher/tools/images'],
  ['/teacher/grade-image', '/v2/teacher/grade-image'],
  ['/teacher/grading', '/v2/teacher/grading'],
  ['/teacher/grammar', '/v2/teacher/tools/grammar'],
  ['/teacher/materials', '/v2/teacher/materials'],
  ['/teacher/media', '/v2/teacher/media'],
  ['/teacher/notifications', '/v2/notifications'],
  ['/teacher/profile', '/v2/teacher/profile'],
  ['/teacher/reports', '/v2/teacher/tc-reports'],
  ['/teacher/sessions', '/v2/teacher/sessions'],
  ['/teacher', '/v2/teacher'],
]

/**
 * Trung tâm (B2B). `/org/accept` là trang CÔNG KHAI nhận lời mời qua email — token nằm ở query
 * string và Next giữ nguyên query khi redirect, còn `/v2/org/accept` (route group `(public)`)
 * cũng được middleware miễn cổng đăng nhập, nên chuỗi lời mời không đứt.
 */
const ORG = [
  ['/org/accept', '/v2/org/accept'],
  ['/org/billing', '/v2/org/billing'],
  ['/org/classes', '/v2/org/classes'],
  ['/org/invitations', '/v2/org/invitations'],
  ['/org/students', '/v2/org/students'],
  ['/org/teachers', '/v2/org/teachers'],
  ['/org', '/v2/org'],
]

/**
 * Quản trị. Ba trang đổi tên khi port: `interview-analytics` → `interviews`,
 * `token-analytics` → `tokens`, `notifications` (trang GỬI thông báo hàng loạt) → `broadcast`.
 */
const ADMIN = [
  ['/admin/reports/grammar-feedback-coverage', '/v2/admin/reports/grammar-feedback-coverage'],
  ['/admin/reports/personalization-ruleset', '/v2/admin/reports/personalization-ruleset'],
  ['/admin/reports/vocabulary-quality', '/v2/admin/reports/vocabulary-quality'],
  ['/admin/reports', '/v2/admin/reports'],
  ['/admin/ai-config', '/v2/admin/ai-config'],
  ['/admin/analytics', '/v2/admin/analytics'],
  ['/admin/classes', '/v2/admin/classes'],
  ['/admin/grammar-review', '/v2/admin/grammar-review'],
  ['/admin/interview-analytics', '/v2/admin/interviews'],
  ['/admin/marketing', '/v2/admin/marketing'],
  ['/admin/media', '/v2/admin/media'],
  ['/admin/mock-exam-packs', '/v2/admin/mock-exam-packs'],
  ['/admin/notifications', '/v2/admin/broadcast'],
  ['/admin/organizations', '/v2/admin/organizations'],
  ['/admin/plans', '/v2/admin/plans'],
  ['/admin/revenue', '/v2/admin/revenue'],
  ['/admin/settings', '/v2/admin/settings'],
  ['/admin/token-analytics', '/v2/admin/tokens'],
  ['/admin/training-dataset', '/v2/admin/training-dataset'],
  ['/admin/users', '/v2/admin/users'],
  ['/admin/vocabulary', '/v2/admin/vocabulary'],
  ['/admin/weekly-speaking', '/v2/admin/weekly-speaking'],
  ['/admin', '/v2/admin'],
]

/**
 * CỐ Ý KHÔNG REDIRECT — đừng "bổ sung cho đủ" ở PR sau mà không đọc lý do:
 *
 * 1. Marketing/SEO công khai, KHÔNG có bản v2 và `/v2` vẫn trỏ tới:
 *    `/`, `/about`, `/free-grade`, `/giao-vien-mien-phi`, `/luyen-thi`, `/luyen-thi/[slug]`,
 *    `/privacy`, `/terms`, `/support`, `/teachers`, `/teachers/[id]`.
 *    Bốn trang đầu còn nằm trong `sitemap.ts` — redirect là tự bắn vào chân SEO.
 * 2. Xem-bằng-token, không cần đăng nhập và không có bản v2: `/certificate/[token]`,
 *    `/report/[token]`.
 * 3. `/payment/success`: URL RETURN của cổng thanh toán. Không có gì trong `src/` trỏ tới nó
 *    NHƯNG cổng ngoài có thể vẫn giữ URL cũ trong cấu hình merchant — redirect ở đây là rủi ro
 *    tiền bạc, phải đối chiếu cấu hình cổng trước rồi mới đụng.
 * 4. (ĐÃ HẾT — xem STUDENT ở trên) `/student/groq-usage` từng nằm trong danh sách này vì là trang
 *    chết chỉ hiển thị "N/A" và không có đích v2. Ở Đợt 0–2.6 nó vẫn TỰ PHỤC VỤ được nên bỏ trống
 *    là vô hại; Đợt 3 xoá file đi thì bỏ trống = 404 thật, nên nay đổ về dashboard học viên.
 * 5. `/login`, `/register`, `/dashboard`: đã có redirect từ đợt 0, giữ nguyên tại chỗ cũ trong
 *    `next.config.mjs` để không làm loãng lịch sử của chúng.
 */
export const legacyV1Redirects = [
  ...STUDENT,
  ...LEARNER_ROOT,
  ...TEACHER,
  ...ORG,
  ...ADMIN,
].map(toPermanent)

export default legacyV1Redirects
