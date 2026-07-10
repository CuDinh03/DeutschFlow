/**
 * nav.ts — Cấu hình sidebar điều hướng cho UI /v2 (Galerie 2.0).
 *
 * Mỗi role có đúng một `RoleNav`. Sidebar render theo thứ tự:
 *   RoleNav → sections[] (nhóm có heading tùy chọn) → items[] (từng thanh menu).
 * Item nào đang active được suy ra bằng cách so `href` với pathname hiện tại
 * (xem component sidebar tiêu thụ `ROLE_NAV`), nên `href` phải là route /v2 chuẩn.
 *
 * Quy ước:
 *   - `id`    : khớp screen id trong manifest (dùng cho key/analytics, KHÔNG render).
 *   - `label` : nhãn tiếng Việt hiển thị trên sidebar.
 *   - `href`  : route /v2 chuẩn — một số trỏ tới màn chưa build (Phase 2 lấp dần), đây là chủ ý.
 *   - `icon`  : tên icon Material Symbols.
 *
 * Sửa nav ở đây là nguồn sự thật duy nhất cho cả 4 role bên dưới.
 */
import { MARKETPLACE_ENABLED, TEACHER_AI_TOOLS_ENABLED } from '@/lib/features'

export type RoleId = 'teacher' | 'admin' | 'org' | 'student'

/** Một thanh menu trên sidebar. */
export interface NavItem {
  /** Screen id (khớp manifest) — dùng cho key/analytics, không hiển thị. */
  id: string
  /** Nhãn tiếng Việt hiển thị. */
  label: string
  /** Route /v2 chuẩn; dùng để so khớp trạng thái active. */
  href: string
  /** Tên icon Material Symbols. */
  icon: string
  /** Org nav: chỉ OWNER thấy (vd: tài chính/giấy phép). MANAGER (nhân sự) bị ẩn. */
  ownerOnly?: boolean
}

/** Một nhóm item, render kèm heading nếu có `label`. */
export interface NavSection {
  /** Tiêu đề nhóm (vd: "Quản lý lớp"); bỏ trống nếu nhóm không cần heading. Dùng làm fallback tiếng Việt. */
  label?: string
  /** Khoá i18n ổn định của heading (messages: v2.nav.sections.<labelKey>). Sidebar dịch theo khoá này. */
  labelKey?: string
  items: NavItem[]
}

/** Toàn bộ nav của một role. */
export interface RoleNav {
  role: RoleId
  /** Route gốc của role — đích redirect mặc định sau đăng nhập. */
  rootHref: string
  sections: NavSection[]
}

/**
 * teacherNav — giáo viên trung tâm (B2B). Khớp Prototype A (Galerie).
 *
 * Nhóm:
 *   - Quản lý lớp : trang chủ, kế hoạch + nội dung + lịch sử giảng dạy, chấm bài (text/ảnh),
 *                   thư viện tài liệu, phúc khảo.
 *   - Giảng dạy   : tin nhắn học viên.
 *   - Công cụ AI  : ngữ pháp AI, tạo tài liệu AI, tạo ảnh AI.
 *   - Thống kê    : báo cáo & phân tích.
 *   - Tài khoản   : hồ sơ.
 *
 * Ghi chú:
 *   - "Thông báo" nằm ở top bar (chuông + badge unread), KHÔNG ở sidebar.
 *   - "Buổi học 1:1" (sessions, marketplace B2C) đã bỏ — teacher chỉ tập trung lớp trung tâm.
 */
export const teacherNav: RoleNav = {
  role: 'teacher',
  rootHref: '/v2/teacher',
  sections: [
    {
      label: 'Quản lý lớp',
      labelKey: 'classMgmt',
      items: [
        { id: 'teacher', label: 'Trang chủ', href: '/v2/teacher', icon: 'dashboard' },
        { id: 'schedule', label: 'Kế hoạch giảng dạy', href: '/v2/teacher/schedule', icon: 'schedule' },
        { id: 'tc-progress', label: 'Tiến độ khóa học', href: '/v2/teacher/tc-progress', icon: 'trending_up' },
        { id: 'tc-checklist', label: 'Nội dung giảng dạy', href: '/v2/teacher/tc-checklist', icon: 'checklist' },
        { id: 'grading', label: 'Chấm bài', href: '/v2/teacher/grading', icon: 'grading' },
        { id: 'grade-image', label: 'Chấm bài qua ảnh', href: '/v2/teacher/grade-image', icon: 'draw' },
        { id: 'tc-reports', label: 'Sổ điểm & Báo cáo', href: '/v2/teacher/tc-reports', icon: 'assessment' },
        { id: 'materials', label: 'Thư viện tài liệu', href: '/v2/teacher/materials', icon: 'menu_book' },
      ],
    },
    {
      label: 'Giảng dạy',
      labelKey: 'teaching',
      items: [
        { id: 'tc-messages', label: 'Tin nhắn học viên', href: '/v2/teacher/messages', icon: 'chat' },
      ],
    },
    // "Công cụ AI" — temporarily hidden (AI grammar/image gen 500 in prod). Flip
    // NEXT_PUBLIC_TEACHER_AI_TOOLS_ENABLED=true to restore. See lib/features.ts.
    ...(TEACHER_AI_TOOLS_ENABLED
      ? [
          {
            label: 'Công cụ AI',
            labelKey: 'aiTools',
            items: [
              { id: 'grammar-ai', label: 'Ngữ pháp AI', href: '/v2/teacher/tools/grammar', icon: 'spellcheck' },
              { id: 'materials-ai', label: 'Tạo Tài liệu AI', href: '/v2/teacher/tools/materials', icon: 'description' },
              { id: 'ai-images', label: 'Tạo ảnh AI', href: '/v2/teacher/tools/images', icon: 'image' },
            ],
          },
        ]
      : []),
    {
      label: 'Thống kê',
      labelKey: 'stats',
      items: [{ id: 'analytics', label: 'Báo cáo & Phân tích', href: '/v2/teacher/analytics', icon: 'monitoring' }],
    },
    {
      label: 'Tài khoản',
      labelKey: 'account',
      items: [{ id: 't-profile', label: 'Hồ sơ', href: '/v2/teacher/profile', icon: 'person' }],
    },
  ],
}

/**
 * adminNav — quản trị nền tảng (platform ADMIN).
 *
 * Một nhóm chính không heading (vận hành: doanh thu, token AI, tổ chức, người dùng, lớp, gói,
 * bộ đề, nội dung, cấu hình AI, marketing, phân tích, báo cáo, nhật ký, training data, cấu hình)
 * + nhóm "Tài khoản" (hồ sơ). Đây là bề mặt rộng nhất, bao quát toàn hệ thống.
 */
export const adminNav: RoleNav = {
  role: 'admin',
  rootHref: '/v2/admin',
  sections: [
    {
      items: [
        { id: 'admin', label: 'Tổng quan', href: '/v2/admin', icon: 'dashboard' },
        { id: 'admin-revenue', label: 'Doanh thu', href: '/v2/admin/revenue', icon: 'payments' },
        { id: 'admin-tokens', label: 'AI Token', href: '/v2/admin/tokens', icon: 'toll' },
        { id: 'admin-orgs', label: 'Tổ chức', href: '/v2/admin/organizations', icon: 'corporate_fare' },
        { id: 'admin-free-teachers', label: 'Giáo viên tự do', href: '/v2/admin/free-teachers', icon: 'person_search' },
        { id: 'admin-users', label: 'Người dùng', href: '/v2/admin/users', icon: 'group' },
        { id: 'admin-classes', label: 'Lớp học', href: '/v2/admin/classes', icon: 'groups' },
        { id: 'admin-plans', label: 'Gói', href: '/v2/admin/plans', icon: 'sell' },
        { id: 'admin-mock-packs', label: 'Bộ đề thi', href: '/v2/admin/mock-exam-packs', icon: 'quiz' },
        { id: 'admin-vocab', label: 'Từ vựng', href: '/v2/admin/vocabulary', icon: 'menu_book' },
        { id: 'admin-grammar-review', label: 'Duyệt ngữ pháp', href: '/v2/admin/grammar-review', icon: 'spellcheck' },
        { id: 'admin-media', label: 'Ảnh', href: '/v2/admin/media', icon: 'photo_library' },
        { id: 'admin-ai', label: 'Cấu hình AI', href: '/v2/admin/ai-config', icon: 'tune' },
        { id: 'admin-broadcast', label: 'Thông báo', href: '/v2/admin/broadcast', icon: 'campaign' },
        { id: 'admin-marketing', label: 'Tăng trưởng', href: '/v2/admin/marketing', icon: 'trending_up' },
        { id: 'admin-analytics', label: 'Phân tích', href: '/v2/admin/analytics', icon: 'monitoring' },
        { id: 'admin-weekly', label: 'Speaking tuần', href: '/v2/admin/weekly-speaking', icon: 'mic' },
        { id: 'admin-reports', label: 'Báo cáo', href: '/v2/admin/reports', icon: 'assessment' },
        { id: 'admin-personas', label: 'Persona', href: '/v2/admin/personas', icon: 'record_voice_over' },
        { id: 'admin-interviews', label: 'Phỏng vấn', href: '/v2/admin/interviews', icon: 'forum' },
        { id: 'admin-audit', label: 'Nhật ký', href: '/v2/admin/audit', icon: 'admin_panel_settings' },
        { id: 'admin-training', label: 'Training data', href: '/v2/admin/training-dataset', icon: 'database' },
        { id: 'admin-settings', label: 'Cấu hình', href: '/v2/admin/settings', icon: 'settings' },
      ],
    },
    {
      label: 'Tài khoản',
      labelKey: 'account',
      items: [
        { id: 'admin-profile', label: 'Hồ sơ', href: '/v2/profile', icon: 'person' },
      ],
    },
  ],
}

/**
 * orgNav — quản lý trung tâm (org OWNER & MANAGER).
 *
 * Một nhóm chính (tổng quan, học viên, lớp, lịch trung tâm, giáo viên, phân tích, tài chính,
 * gói & giấy phép, lời mời, phân quyền) + nhóm "Tài khoản".
 *
 * Phân quyền: item gắn `ownerOnly: true` (tài chính, gói & giấy phép) CHỈ OWNER thấy;
 * MANAGER (nhân sự) bị ẩn. Việc lọc do component sidebar thực hiện dựa trên role org.
 */
export const orgNav: RoleNav = {
  role: 'org',
  rootHref: '/v2/org',
  sections: [
    {
      items: [
        { id: 'org', label: 'Tổng quan', href: '/v2/org', icon: 'dashboard' },
        { id: 'org-students', label: 'Học viên', href: '/v2/org/students', icon: 'school' },
        { id: 'org-classes', label: 'Lớp học', href: '/v2/org/classes', icon: 'groups' },
        { id: 'org-schedule', label: 'Lịch trung tâm', href: '/v2/org/schedule', icon: 'schedule' },
        { id: 'org-teachers', label: 'Giáo viên', href: '/v2/org/teachers', icon: 'badge' },
        { id: 'org-analytics', label: 'Phân tích', href: '/v2/org/analytics', icon: 'monitoring' },
        { id: 'org-finance', label: 'Tài chính', href: '/v2/org/finance', icon: 'account_balance', ownerOnly: true },
        { id: 'org-billing', label: 'Gói & Giấy phép', href: '/v2/org/billing', icon: 'receipt', ownerOnly: true },
        { id: 'org-invitations', label: 'Lời mời', href: '/v2/org/invitations', icon: 'mail' },
        { id: 'org-roles', label: 'Phân quyền', href: '/v2/org/roles', icon: 'admin_panel_settings' },
      ],
    },
    {
      label: 'Tài khoản',
      labelKey: 'account',
      items: [
        { id: 'org-profile', label: 'Hồ sơ', href: '/v2/profile', icon: 'person' },
      ],
    },
  ],
}

/**
 * studentNav — bề mặt học viên dùng hằng ngày (P6).
 *
 * Nhóm:
 *   - Học tập  : tổng quan, từ vựng, ngữ pháp, ôn tập (SRS), bài học, lộ trình.
 *   - Luyện thi: luyện nói AI, thi thử, luyện thi.
 *   - Lớp học  : lớp của tôi, tiến độ, gia sư 1:1, tin nhắn.
 *   - Cá nhân  : thành tích, học phí, thông báo, hồ sơ.
 *
 * Lưu ý: "Gia sư 1:1" (book-session) là cổng B2C của học viên — khác hẳn việc teacher
 * đã bỏ tab 1:1; phía học viên vẫn giữ để đặt buổi với gia sư.
 */
export const studentNav: RoleNav = {
  role: 'student',
  rootHref: '/v2/student/dashboard',
  sections: [
    {
      label: 'Học tập',
      labelKey: 'learning',
      items: [
        { id: 'dashboard', label: 'Tổng quan', href: '/v2/student/dashboard', icon: 'dashboard' },
        { id: 'vocabulary', label: 'Từ vựng', href: '/v2/student/vocabulary', icon: 'menu_book' },
        { id: 'grammar', label: 'Ngữ pháp', href: '/v2/student/grammar', icon: 'spellcheck' },
        { id: 'review-queue', label: 'Ôn tập (SRS)', href: '/v2/student/review', icon: 'repeat' },
        { id: 'lessons', label: 'Bài học', href: '/v2/student/lessons', icon: 'play_circle' },
        { id: 'roadmap', label: 'Lộ trình', href: '/v2/student/roadmap', icon: 'route' },
      ],
    },
    {
      label: 'Luyện thi',
      labelKey: 'examPrep',
      items: [
        { id: 'speaking', label: 'Luyện nói AI', href: '/v2/student/speaking', icon: 'mic' },
        { id: 'mock-exam', label: 'Thi thử', href: '/v2/student/mock-exam', icon: 'quiz' },
        { id: 'exam', label: 'Luyện thi', href: '/v2/student/exam', icon: 'school' },
      ],
    },
    {
      label: 'Lớp học',
      labelKey: 'classes',
      items: [
        { id: 'my-classes', label: 'Lớp của tôi', href: '/v2/student/classes', icon: 'groups' },
        { id: 'st-progress', label: 'Tiến độ', href: '/v2/student/progress', icon: 'checklist' },
        // C2C tutor marketplace — hidden for v1.0 (off-GTM, unfinished money flow). See lib/features.ts.
        ...(MARKETPLACE_ENABLED
          ? [{ id: 'book-session', label: 'Gia sư 1:1', href: '/v2/student/tutor', icon: 'co_present' }]
          : []),
        { id: 'st-messages', label: 'Tin nhắn', href: '/v2/student/messages', icon: 'chat' },
      ],
    },
    {
      label: 'Cá nhân',
      labelKey: 'personal',
      items: [
        { id: 'achievements', label: 'Thành tích', href: '/v2/student/achievements', icon: 'emoji_events' },
        { id: 'tuition', label: 'Học phí', href: '/v2/student/tuition', icon: 'payments' },
        { id: 'notifications', label: 'Thông báo', href: '/v2/notifications', icon: 'notifications' },
        { id: 'profile', label: 'Hồ sơ', href: '/v2/profile', icon: 'person' },
      ],
    },
  ],
}

/** Tra cứu nav theo role — entry point component sidebar dùng để render đúng menu. */
export const ROLE_NAV: Record<RoleId, RoleNav> = {
  teacher: teacherNav,
  admin: adminNav,
  org: orgNav,
  student: studentNav,
}
