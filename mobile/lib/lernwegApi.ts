// Lernweg — đọc lộ trình THẬT `GET /api/roadmap/me` (RoadmapNodeDto): cùng nguồn
// với web /v2/student/roadmap và cùng sổ tiến độ (skill_tree_user_progress) với
// player node.tsx / skill-practice / node-practice của mobile. `id` là SỐ và là id
// duy nhất mà `/skill-tree/{nodeId}/…` chấp nhận.
//
// Trước 05/09 màn này đọc `/roadmap/tree` = cây DEMO (bảng tree_*, seed từ template,
// sổ tiến độ riêng) mà web đã bỏ từ 03/08 → tài khoản A2 thấy "A0 · Gieo mầm" với
// 4 hàng rỗng, chạm không ra bài nào (QA đợt 0, AC-MOBSCR-06 FAIL). Plan nâng cấp
// mobile 05/09, hạng mục N1, owner duyệt G1 = phương án A: giữ UI Lernweg, đổi nguồn.
import api from './api'

export interface RoadmapNode {
  id: number
  code: string
  /** Tiêu đề tiếng Đức. */
  title: string
  /** Tiêu đề tiếng Việt. */
  subtitle: string
  emoji: string
  /** "completed" | "current" | "locked" — 3 mức thô, giữ cho màn cũ. */
  state: string
  xpReward: number
  lessonsTotal: number
  lessonsCompleted: number
  category: string | null
  description: string | null
  cefrLevel: string
  prerequisiteCode: string | null
  orderIndex: number | null
  /** Ngày trong giáo trình, 1-based. Null với node ngoài trục ngày. */
  dayNumber: number | null
  /** Tuần trong giáo trình, 1-based. Null với node ngoài trục ngày. */
  weekNumber: number | null
  /** "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED" — bản chi tiết của `state`. */
  progressStatus: string | null
  /** Số bài tập soạn sẵn theo kỹ năng, khoá tiếng Đức viết hoa: `{"HOEREN":3,…}`. Rỗng, không null. */
  skillCounts: Record<string, number> | null
}

/** Khoá react-query dùng chung giữa Lernweg, card Lộ trình ở Trang chủ và các màn học (invalidate sau khi xong node). */
export const ROADMAP_ME_QUERY_KEY = ['roadmap-me'] as const

export const lernwegApi = {
  nodes: () => api.get<RoadmapNode[]>('/roadmap/me').then((r) => r.data),
}
