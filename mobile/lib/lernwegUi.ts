// Helpers thuần cho màn Lernweg — đếm tiến độ và map kỹ năng → nơi luyện trên
// mobile. Tách khỏi screen để test (quyết định điều hướng không sống trong JSX).

import type { TreeDto, TreeLevel } from './lernwegApi'

export interface TreeProgress {
  done: number
  total: number
}

/** Đếm leaf completed / tổng trên toàn path (level locked có branches rỗng — 0 phần tử, an toàn). */
export function treeProgress(tree: Pick<TreeDto, 'path'> | null | undefined): TreeProgress {
  let done = 0
  let total = 0
  for (const level of tree?.path ?? []) {
    for (const branch of level.branches) {
      for (const shoot of branch.shoots) {
        for (const leaf of shoot.nodes) {
          total += 1
          if (leaf.state === 'completed') done += 1
        }
      }
    }
  }
  return { done, total }
}

/** Level đang học (status=current) — điểm mở rộng mặc định của màn. */
export function currentLevel(tree: Pick<TreeDto, 'path'> | null | undefined): TreeLevel | null {
  return (tree?.path ?? []).find((l) => l.status === 'current') ?? null
}

/**
 * Kỹ năng của một leaf → nơi LUYỆN tương ứng đang có trên mobile. Đợt này
 * Lernweg là bản đồ tiến độ + lối vào luyện; player bài học theo contentKey
 * (như web §5) là đợt sau — KHÔNG được "đánh dấu xong" từ mobile khi chưa học
 * thật, nên không gọi completeNode ở đây.
 */
export function skillPracticeRoute(skill: string):
  | '/(student)/speaking'
  | '/(student)/vocabulary'
  | '/(student)/grammar'
  | '/(student)/video-lesson'
  | '/(student)/learn' {
  switch (skill.toUpperCase()) {
    case 'SPRECHEN':
    case 'SPEAKING':
      return '/(student)/speaking'
    case 'WORTSCHATZ':
    case 'VOCAB':
    case 'VOCABULARY':
      return '/(student)/vocabulary'
    case 'GRAMMATIK':
    case 'GRAMMAR':
      return '/(student)/grammar'
    case 'HOEREN':
    case 'HÖREN':
    case 'LISTENING':
      return '/(student)/video-lesson'
    default:
      return '/(student)/learn'
  }
}

/** Nhãn tiếng Việt trạng thái milestone (cổng lên cấp). */
export function milestoneLabel(state: string): string {
  switch (state) {
    case 'passed': return 'Đã vượt cổng cấp'
    case 'ready': return 'Sẵn sàng thi lên cấp'
    case 'in_progress': return 'Đang tích luỹ'
    case 'locked': return 'Chưa mở'
    default: return state
  }
}
