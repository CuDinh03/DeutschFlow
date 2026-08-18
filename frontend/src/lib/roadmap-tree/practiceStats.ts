import type { Skill } from '@/lib/skills'

/**
 * Đọc `GET /skill-tree/{nodeId}/practice` thành thống kê per-kỹ-năng cho cây lộ trình.
 *
 * Backend trả `sessions` là các row SQL (khoá snake_case): mỗi kỹ năng một row mới nhất, kèm
 * `best_score_percent` gộp qua MỌI generation — sinh đề mới không xoá thành tích đã đạt.
 */

/** Ngưỡng "đạt" một kỹ năng — khớp điều kiện hoa hoá lá phía backend (một session ≥70%). */
export const MASTERY_PERCENT = 70

/** Thứ tự trình bày 4 kỹ năng theo wireframe: Nghe → Đọc → Nói → Viết. */
export const SKILL_ORDER: readonly Skill[] = ['hoeren', 'lesen', 'sprechen', 'schreiben']

export interface SkillPracticeStat {
  /** Điểm % cao nhất qua mọi generation, null khi chưa nộp bài nào. */
  bestScorePercent: number | null
  /** Trạng thái session mới nhất: "ACTIVE" | "COMPLETED" | "ABANDONED". */
  latestStatus: string | null
}

/** Thống kê theo kỹ năng của MỘT node; kỹ năng chưa có session nào thì vắng mặt. */
export type NodePracticeStats = Partial<Record<Skill, SkillPracticeStat>>

export function parsePracticeOverview(data: unknown): NodePracticeStats {
  const stats: NodePracticeStats = {}
  const sessions = (data as { sessions?: unknown } | null)?.sessions
  if (!Array.isArray(sessions)) return stats
  for (const row of sessions) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const skill = String(r.skill_type ?? '').toLowerCase()
    if (!SKILL_ORDER.includes(skill as Skill)) continue
    const best = r.best_score_percent
    stats[skill as Skill] = {
      bestScorePercent: typeof best === 'number' ? best : null,
      latestStatus: typeof r.status === 'string' ? r.status : null,
    }
  }
  return stats
}

export function isSkillMastered(stat: SkillPracticeStat | undefined): boolean {
  return (stat?.bestScorePercent ?? -1) >= MASTERY_PERCENT
}

/**
 * Kỹ năng nên luyện kế tiếp: kỹ năng đầu tiên theo thứ tự trình bày chưa đạt ngưỡng.
 * Đạt cả bốn thì quay về kỹ năng đầu — node sắp hoá lá, luyện thêm không hại gì.
 */
export function nextSkillToPractice(stats: NodePracticeStats): Skill {
  return SKILL_ORDER.find((skill) => !isSkillMastered(stats[skill])) ?? SKILL_ORDER[0]
}
