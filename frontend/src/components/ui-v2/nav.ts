/**
 * Role navigation — mapped from manifest navigation.primaryNav.
 * `id` = manifest screen id; `href` = canonical /v2 route; `icon` = Material Symbols name.
 * Hrefs to not-yet-built screens are intentional (Phase 2 fills them in).
 */
export type RoleId = 'teacher' | 'admin' | 'org' | 'student'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export interface RoleNav {
  role: RoleId
  rootHref: string
  sections: NavSection[]
}

export const teacherNav: RoleNav = {
  role: 'teacher',
  rootHref: '/v2/teacher',
  sections: [
    {
      label: 'Quản lý',
      items: [
        { id: 'teacher', label: 'Tổng quan', href: '/v2/teacher', icon: 'dashboard' },
        { id: 'class-detail', label: 'Lớp học', href: '/v2/teacher/classes', icon: 'groups' },
        { id: 'sessions', label: 'Buổi 1:1', href: '/v2/teacher/sessions', icon: 'calendar_month' },
        { id: 'grading', label: 'Chấm bài', href: '/v2/teacher/grading', icon: 'grading' },
      ],
    },
    { label: 'Thống kê', items: [{ id: 'analytics', label: 'Phân tích', href: '/v2/teacher/analytics', icon: 'monitoring' }] },
    { label: 'Thông báo', items: [{ id: 'notifications', label: 'Thông báo', href: '/v2/notifications', icon: 'notifications' }] },
    {
      label: 'Công cụ AI',
      items: [
        { id: 'grammar-ai', label: 'Ngữ pháp AI', href: '/v2/teacher/tools/grammar', icon: 'spellcheck' },
        { id: 'materials-ai', label: 'Tài liệu AI', href: '/v2/teacher/tools/materials', icon: 'description' },
        { id: 'ai-images', label: 'Tạo ảnh AI', href: '/v2/teacher/tools/images', icon: 'image' },
      ],
    },
    {
      label: 'Tài khoản',
      items: [
        { id: 't-profile', label: 'Hồ sơ', href: '/v2/teacher/profile', icon: 'person' },
        { id: 'grade-image', label: 'Chấm ảnh viết tay', href: '/v2/teacher/grade-image', icon: 'draw' },
      ],
    },
  ],
}

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
        { id: 'admin-users', label: 'Người dùng', href: '/v2/admin/users', icon: 'group' },
        { id: 'admin-classes', label: 'Lớp học', href: '/v2/admin/classes', icon: 'groups' },
        { id: 'admin-plans', label: 'Gói', href: '/v2/admin/plans', icon: 'sell' },
        { id: 'admin-vocab', label: 'Từ vựng', href: '/v2/admin/vocabulary', icon: 'menu_book' },
        { id: 'admin-media', label: 'Ảnh', href: '/v2/admin/media', icon: 'photo_library' },
        { id: 'admin-ai', label: 'Cấu hình AI', href: '/v2/admin/ai-config', icon: 'tune' },
        { id: 'admin-broadcast', label: 'Thông báo', href: '/v2/admin/broadcast', icon: 'campaign' },
        { id: 'admin-personas', label: 'Persona', href: '/v2/admin/personas', icon: 'record_voice_over' },
        { id: 'admin-interviews', label: 'Phỏng vấn', href: '/v2/admin/interviews', icon: 'forum' },
        { id: 'admin-audit', label: 'Nhật ký', href: '/v2/admin/audit', icon: 'admin_panel_settings' },
      ],
    },
  ],
}

export const orgNav: RoleNav = {
  role: 'org',
  rootHref: '/v2/org',
  sections: [
    {
      items: [
        { id: 'org', label: 'Tổng quan', href: '/v2/org', icon: 'dashboard' },
        { id: 'org-students', label: 'Học viên', href: '/v2/org/students', icon: 'school' },
        { id: 'org-classes', label: 'Lớp học', href: '/v2/org/classes', icon: 'groups' },
        { id: 'org-teachers', label: 'Giáo viên', href: '/v2/org/teachers', icon: 'badge' },
        { id: 'org-analytics', label: 'Phân tích', href: '/v2/org/analytics', icon: 'monitoring' },
        { id: 'org-finance', label: 'Tài chính', href: '/v2/org/finance', icon: 'account_balance' },
        { id: 'org-billing', label: 'Gói & Giấy phép', href: '/v2/org/billing', icon: 'receipt' },
        { id: 'org-invitations', label: 'Lời mời', href: '/v2/org/invitations', icon: 'mail' },
        { id: 'org-roles', label: 'Phân quyền', href: '/v2/org/roles', icon: 'admin_panel_settings' },
      ],
    },
  ],
}

// Student nav — full student-daily surface (P6). Learn + practice + classes + account.
export const studentNav: RoleNav = {
  role: 'student',
  rootHref: '/v2/student/dashboard',
  sections: [
    {
      label: 'Học tập',
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
      items: [
        { id: 'speaking', label: 'Luyện nói AI', href: '/v2/student/speaking', icon: 'mic' },
        { id: 'mock-exam', label: 'Thi thử', href: '/v2/student/mock-exam', icon: 'quiz' },
        { id: 'exam', label: 'Luyện thi', href: '/v2/student/exam', icon: 'school' },
      ],
    },
    {
      label: 'Lớp học',
      items: [
        { id: 'my-classes', label: 'Lớp của tôi', href: '/v2/student/classes', icon: 'groups' },
        { id: 'st-progress', label: 'Tiến độ', href: '/v2/student/progress', icon: 'checklist' },
        { id: 'book-session', label: 'Gia sư 1:1', href: '/v2/student/tutor', icon: 'co_present' },
      ],
    },
    {
      label: 'Cá nhân',
      items: [
        { id: 'achievements', label: 'Thành tích', href: '/v2/student/achievements', icon: 'emoji_events' },
        { id: 'notifications', label: 'Thông báo', href: '/v2/notifications', icon: 'notifications' },
        { id: 'profile', label: 'Hồ sơ', href: '/v2/profile', icon: 'person' },
      ],
    },
  ],
}

export const ROLE_NAV: Record<RoleId, RoleNav> = {
  teacher: teacherNav,
  admin: adminNav,
  org: orgNav,
  student: studentNav,
}
