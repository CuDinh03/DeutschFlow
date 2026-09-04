import type { Skill } from '@/lib/skills'
import { isSkillMastered, SKILL_ORDER, type NodePracticeStats } from './practiceStats'
import type { TreeLayout } from './treeLayout'

/**
 * Nghi thức trở về (Lernbaum v2 — "3 bậc, lặng lẽ mà thoả mãn").
 *
 * Runner luyện điều hướng về `?tab=tree&node=N&feiern=<skill>`; tab cây đọc param MỘT lần, đối chiếu
 * với trạng thái cây ĐÃ MỚI (backend vừa chấm xong, `/roadmap/me` tải lại) và điểm luyện vừa tải
 * lại của node đó để quyết định diễn bậc nào. Không confetti, không sao nổ: phần thưởng là CÂY LỚN LÊN.
 *
 *   bậc 0 — kỹ năng dưới 70%: cánh hoa của kỹ năng đó khẽ nhún một nhịp, panel cập nhật điểm.
 *   bậc 1 — kỹ năng vừa đạt: cánh bung từ tâm (overshoot 1.12) rồi nhận màu, 2 hạt phấn bay lên.
 *   bậc 2 — đủ 4 cánh, node đã hoá lá: hoa khép lại, lá mở ra đúng chỗ; nụ ngày kế nở thành hoa,
 *           camera lướt sang.
 *   bậc 3 — node cuối tuần hoá lá: cả cành "khép tán" — tán tuần đậm thêm, 4–5 hạt phấn bay qua.
 *
 * Mọi bậc cao diễn tuần tự bậc thấp trước, tổng ≤ 2,5 s, rồi cây trở về tĩnh lặng. Reduced-motion
 * hoặc nút "Tắt hiệu ứng" → bỏ qua hoàn toàn (trạng thái cây đã là trạng thái mới rồi).
 */

export type RitualTier = 0 | 1 | 2 | 3

export interface RitualPlan {
  nodeId: number
  skill: Skill
  tier: RitualTier
  /** Hoa kế tiếp nở (bậc ≥ 2) — null khi không còn node đang học. */
  nextNodeId: number | null
  /** Tuần vừa khép tán (bậc 3). */
  week: number | null
}

/** Mốc thời gian (ms) — khớp keyframes `rt-rit-*` trong roadmap-tree.css. */
export const RITUAL_TIMELINE = {
  /** Bậc 1 xong → hoa bắt đầu khép. */
  flowerOutMs: 700,
  /** Camera lướt sang hoa kế (bậc ≥ 2). */
  cameraGlideMs: 1300,
  /** Tán tuần bắt đầu đậm (bậc 3). */
  weekCloseMs: 1600,
  /** Toàn bộ kết thúc, gỡ class. */
  totalMs: 2500,
} as const

export function parseFeiernParam(raw: string | null): Skill | null {
  if (!raw) return null
  const skill = raw.toLowerCase()
  return (SKILL_ORDER as readonly string[]).includes(skill) ? (skill as Skill) : null
}

export function planRitual(
  layout: TreeLayout,
  nodeId: number,
  skill: Skill,
  stats: NodePracticeStats,
): RitualPlan | null {
  const placed = layout.nodes.find((n) => n.id === nodeId)
  if (!placed) return null
  const base = { nodeId, skill, nextNodeId: null, week: null }

  if (placed.motif === 'flower') {
    return { ...base, tier: isSkillMastered(stats[skill]) ? 1 : 0 }
  }
  if (placed.motif !== 'leaf') return null

  // Node đã hoá lá: bậc 2 — và bậc 3 nếu cả tuần của nó đã xong.
  const nextNodeId = layout.nodes.find((n) => n.motif === 'flower')?.id ?? null
  const weekDone = layout.branches.find((b) => b.week === placed.week)?.complete === true
  return { ...base, tier: weekDone ? 3 : 2, nextNodeId, week: weekDone ? placed.week : null }
}
