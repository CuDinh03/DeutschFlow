// Derives the 4 learning stages (na-roadmap stepper) from the user's real node
// progress. Pure + unit-tested. A stage groups CEFR levels; its state is `done`
// when every node in those levels is complete, `active` once any is unlocked or
// started, else `upcoming` (including when the stage has no nodes yet).

import type { SkillNode } from '@/lib/skillTreeApi'

export type StageState = 'done' | 'active' | 'upcoming'

export interface Stage {
  title: string
  sub: string
  levels: string[]
  state: StageState
}

const STAGE_DEFS: { title: string; sub: string; levels: string[] }[] = [
  { title: 'Nền tảng', sub: 'A1 · từ vựng & câu cơ bản', levels: ['A0', 'A1'] },
  { title: 'Sản sinh', sub: 'A2–B1 · diễn đạt chủ động', levels: ['A2', 'B1'] },
  { title: 'Lưu loát', sub: 'B1–B2 · giao tiếp chuyên môn', levels: ['B2'] },
  { title: 'Tốt nghiệp', sub: 'Đạt chứng chỉ Goethe B2+', levels: ['C1', 'C2'] },
]

export function deriveStages(nodes: SkillNode[]): Stage[] {
  return STAGE_DEFS.map((def) => {
    const inStage = nodes.filter((n) => def.levels.includes(n.cefrLevel))
    let state: StageState = 'upcoming'
    if (inStage.length > 0) {
      if (inStage.every((n) => n.status === 'COMPLETED')) state = 'done'
      else if (inStage.some((n) => n.status === 'IN_PROGRESS' || n.status === 'AVAILABLE' || n.status === 'COMPLETED'))
        state = 'active'
    }
    return { title: def.title, sub: def.sub, levels: def.levels, state }
  })
}
