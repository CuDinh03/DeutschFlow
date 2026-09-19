import api from '@/lib/api'
import { nextOnboardingState } from './machine'
import { hasActivity, type FirstLessonKind, type OnboardingProgress } from './starterChecklist'

/**
 * W9 — Ăn mừng (trạng thái `CELEBRATE`, Đợt 4 PR-3, 19/09/2026; kế hoạch 17/09 §4.4 W9).
 *
 * Một trang `/v2/onboarding/celebrate?kind=…` cho MỌI nguồn activation web (fixture L1/L3:
 * Ngày 1 xong, placement xong dù đậu hay rớt, nói thử xong đều ăn mừng). Trang KHÔNG tự ghi
 * activation — `activated_at` do server hook ở chỗ hoàn thành thật (I-12); đây chỉ là màn.
 * `celebrate_done` → `HOME_WEEK1` = dashboard (checklist tuần đầu, W10).
 */

export type CelebrateKind = 'beginner' | 'placement' | 'mock_exam'

export const CELEBRATE_ROUTE = '/v2/onboarding/celebrate'
export const CELEBRATE_KINDS: readonly CelebrateKind[] = ['beginner', 'placement', 'mock_exam'] as const

export interface CelebrateParams {
  kind: CelebrateKind
  /** Chỉ có nghĩa với `placement`: đậu/rớt đổi câu, không đổi việc ăn mừng (fixture L3). */
  passed: boolean | null
}

export function celebrateHref(kind: CelebrateKind, opts: { passed?: boolean } = {}): string {
  const q = new URLSearchParams({ kind })
  if (typeof opts.passed === 'boolean') q.set('passed', opts.passed ? '1' : '0')
  return `${CELEBRATE_ROUTE}?${q.toString()}`
}

/** Tham số lạ/thiếu rơi về `beginner` — trang vẫn ăn mừng chứ không 404 một khoảnh khắc tốt. */
export function parseCelebrateParams(get: (name: string) => string | null): CelebrateParams {
  const raw = get('kind')
  const kind: CelebrateKind = (CELEBRATE_KINDS as readonly string[]).includes(raw ?? '')
    ? (raw as CelebrateKind)
    : 'beginner'
  const p = get('passed')
  const passed = kind === 'placement' && (p === '1' || p === '0') ? p === '1' : null
  return { kind, passed }
}

/** Đích sau ăn mừng theo máy trạng thái chung (fixture E1). */
export function afterCelebrateState() {
  return nextOnboardingState('CELEBRATE', 'celebrate_done', {
    authed: true,
    hasPlan: true,
    accountSource: 'SELF',
    level: null,
    pathChoice: null,
  })
}

/**
 * Chỉ ăn mừng LẦN ĐẦU hoàn thành một loại bài. Server khử trùng lặp `completedActivities`
 * (`@>` rồi mới `||`), nên phải hỏi TRƯỚC khi nộp/complete — sau đó không phân biệt được nữa.
 */
export function isFirstCompletion(progress: OnboardingProgress | null | undefined, kind: FirstLessonKind): boolean {
  // Không xác nhận được (payload lệch hợp đồng) ⇒ không ăn mừng nhầm, cùng đường với lỗi mạng.
  if (!progress || !Array.isArray(progress.completedActivities)) return false
  return !hasActivity(progress, kind)
}

/** Hỏi `GET /onboarding/progress`; lỗi ⇒ `false` (đường an toàn: không ăn mừng nhầm, ở lại luồng thường). */
export async function readFirstCompletion(kind: FirstLessonKind): Promise<boolean> {
  try {
    const { data } = await api.get<OnboardingProgress>('/onboarding/progress')
    return isFirstCompletion(data, kind)
  } catch {
    return false
  }
}
