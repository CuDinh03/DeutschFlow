import { isZeroLevel } from './machine'
import { BEGINNER_ROUTE, MOCK_EXAM_ROUTE, ROADMAP_ROUTE } from './postProfileRoute'

/**
 * W10 — Checklist tuần đầu trên dashboard (trạng thái `HOME_WEEK1`, Đợt 4 PR-3, 19/09/2026;
 * kế hoạch 17/09 §4.4 W10). Bản web của `mobile/components/guide/StarterChecklist.tsx`, nhưng
 * KHÔNG dùng localStorage: trạng thái đọc từ server `GET /onboarding/progress.completedActivities`
 * (danh sách `FIRST_LESSON:<kind>` do `OnboardingActivationService` nối vào, kind =
 * `FirstLessonKind` backend). Nhờ vậy học trên mobile rồi mở web vẫn thấy đúng ô đã tích.
 *
 * Mục:
 * - Bài đầu tiên: A0 → "Ngày 1" (`BEGINNER_SESSION`, hoặc `FIRST_SENTENCE` nếu làm trên mobile);
 *   A1+ → "Kiểm tra đầu vào" (`PLACEMENT`) — người bỏ qua ở Chọn đường được mời lại ở đây (W-1,
 *   AC-ONB-15), lối `/v2/onboarding?placement=1`.
 * - Chặng đầu tiên trên lộ trình (`ROADMAP_NODE`).
 * - Nói thử 3 phút với mentor (`MOCK_EXAM`).
 * (W11 "đặt giờ nhắc" nối thêm khi Đợt 6 có cột `users.reminder_hour_local`.)
 *
 * Ẩn khi: không có hàng progress trên server (tài khoản cũ, trước onb_v3 — không dựng checklist từ
 * chỗ không biết), đã tích đủ, hoặc quá `STARTER_WINDOW_DAYS` ngày kể từ `activatedAt`.
 * Người chưa activation (A1+ bỏ qua) không có mốc ⇒ checklist ở lại tới khi kích hoạt + 7 ngày.
 */

export const STARTER_WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** Hình dạng `GET /api/onboarding/progress` (`GuestSessionDtos.ProgressResponse`). */
export interface OnboardingProgress {
  flowVersion: string
  lastStep: string
  completedActivities: string[]
  activatedAt: string | null
  coreCompletedAt: string | null
}

/** `FirstLessonKind` backend — thêm nguồn mới thì thêm ở đây VÀ hook server. */
export type FirstLessonKind = 'FIRST_SENTENCE' | 'BEGINNER_SESSION' | 'PLACEMENT' | 'MOCK_EXAM' | 'ROADMAP_NODE'

export type StarterItemKey = 'first_lesson' | 'placement' | 'roadmap_node' | 'mock_exam'

export interface StarterItem {
  key: StarterItemKey
  done: boolean
  href: string
}

export type StarterHiddenReason = 'no_row' | 'expired' | 'all_done'

export interface StarterChecklist {
  visible: boolean
  hiddenReason: StarterHiddenReason | null
  items: StarterItem[]
  doneCount: number
}

export const PLACEMENT_RETRY_ROUTE = '/v2/onboarding?placement=1'

const ACTIVITY_PREFIX = 'FIRST_LESSON:'

export function hasActivity(progress: Pick<OnboardingProgress, 'completedActivities'>, kind: FirstLessonKind): boolean {
  return (progress.completedActivities ?? []).includes(`${ACTIVITY_PREFIX}${kind}`)
}

/**
 * `readProgress` trả bản mặc định `{lastStep: INTRO, [], null, null}` khi user CHƯA có hàng —
 * tức chưa đi qua claim/activation của onb_v3. Không phân biệt được với hàng thật ở INTRO, nhưng
 * hàng thật chỉ được tạo ở claim (`CLAIMED`) hoặc activation, nên tổ hợp này = không có hàng.
 */
export function isProgressRowMissing(progress: OnboardingProgress | null | undefined): boolean {
  // Payload lệch hợp đồng (proxy trả rỗng, backend cũ) cũng là "không biết" ⇒ không dựng checklist.
  if (!progress || typeof progress !== 'object' || typeof progress.lastStep !== 'string') return true
  return (
    progress.lastStep === 'INTRO' &&
    !progress.activatedAt &&
    !progress.coreCompletedAt &&
    (progress.completedActivities ?? []).length === 0
  )
}

export interface StarterContext {
  /** `currentLevel` của hồ sơ học; null/undefined coi như A0 (I-1). */
  level: string | null | undefined
  now?: number
}

export function buildStarterChecklist(
  progress: OnboardingProgress | null | undefined,
  ctx: StarterContext,
): StarterChecklist {
  if (isProgressRowMissing(progress) || !progress) {
    return { visible: false, hiddenReason: 'no_row', items: [], doneCount: 0 }
  }
  const now = ctx.now ?? Date.now()
  const zero = isZeroLevel(ctx.level ?? null)

  const items: StarterItem[] = [
    zero
      ? {
          key: 'first_lesson',
          done: hasActivity(progress, 'BEGINNER_SESSION') || hasActivity(progress, 'FIRST_SENTENCE'),
          href: BEGINNER_ROUTE,
        }
      : { key: 'placement', done: hasActivity(progress, 'PLACEMENT'), href: PLACEMENT_RETRY_ROUTE },
    { key: 'roadmap_node', done: hasActivity(progress, 'ROADMAP_NODE'), href: ROADMAP_ROUTE },
    { key: 'mock_exam', done: hasActivity(progress, 'MOCK_EXAM'), href: MOCK_EXAM_ROUTE },
  ]
  const doneCount = items.filter((i) => i.done).length

  if (doneCount === items.length) return { visible: false, hiddenReason: 'all_done', items, doneCount }
  if (progress.activatedAt) {
    const activated = Date.parse(progress.activatedAt)
    if (Number.isFinite(activated) && now - activated > STARTER_WINDOW_DAYS * DAY_MS) {
      return { visible: false, hiddenReason: 'expired', items, doneCount }
    }
  }
  return { visible: true, hiddenReason: null, items, doneCount }
}
