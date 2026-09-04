/**
 * Node của lộ trình bài học — đúng shape `RoadmapNodeDto` của `GET /roadmap/me`.
 *
 * `id` là SỐ và là id duy nhất mà backend học/luyện chấp nhận (`/skill-tree/{nodeId}/…`) — cùng
 * backend app mobile dùng.
 */
export interface RoadmapNode {
  id: number
  code: string
  /** Tiêu đề tiếng Đức. */
  title: string
  /** Tiêu đề tiếng Việt. */
  subtitle: string
  emoji: string
  /** "completed" | "current" | "locked" — 3 mức, giữ cho các màn cũ. */
  state: string
  xpReward: number
  lessonsTotal: number
  lessonsCompleted: number
  cefrLevel: string
  description: string
  /** Ngày trong giáo trình, 1-based. Null với node ngoài trục ngày. */
  dayNumber?: number | null
  /** Tuần trong giáo trình, 1-based. */
  weekNumber?: number | null
  /** "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED" — bản chi tiết của `state`. */
  progressStatus?: string | null
  /** Số bài tập soạn sẵn theo kỹ năng, khoá viết hoa: `{"HOEREN":3,…}`. */
  skillCounts?: Record<string, number> | null
  /** `code` của node phải xong trước thì node này mới mở. Null với node đầu chuỗi. */
  prerequisiteCode?: string | null
}

/**
 * Tiêu đề node theo locale. DTO trả `title` = title_de, `subtitle` = title_vi — học viên Việt cần
 * bản Việt, còn UI tiếng Đức/Anh mà hiện title_vi là lỗi trộn ngôn ngữ (QA prod 17/08).
 */
export function nodeDisplayTitle(
  node: Pick<RoadmapNode, 'title' | 'subtitle'>,
  locale: string,
): string {
  return (locale === 'vi' ? node.subtitle || node.title : node.title || node.subtitle) || ''
}
