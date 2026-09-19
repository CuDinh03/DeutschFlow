import api from '@/lib/api'
import { defineMessages, translate } from '@/lib/i18n'
import type { GlyphName } from '@/lib/galerieGlyphs'

/**
 * Kiểm tra đầu vào 10 câu (M8b, Đợt 3 PR-2 kế hoạch onboarding 17/09/2026) — port từ web
 * `frontend/src/app/v2/onboarding/page.tsx`, cùng hai endpoint:
 *   POST /skill-tree/placement-test            { claimedLevel } → { testId, questions[], timeLimit }
 *   POST /skill-tree/placement-test/{id}/submit { answers: { [questionId]: text } } → kết quả
 *
 * Server chọn 10 câu phủ 4 kỹ năng theo trình độ tự khai, chấm và ghi `activated_at`
 * (`kind=PLACEMENT`) trong `PlacementTestService.submitTest` — client KHÔNG gọi
 * `/onboarding/first-lesson/complete` cho đường này (I-12: một endpoint ghi activation).
 *
 * Phần thuần (tiến độ, nhãn kỹ năng, câu kết quả) tách ra để test; API chỉ là hai hàm mỏng.
 */

export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type PlacementLevel = (typeof PLACEMENT_LEVELS)[number]

export type SkillSection = 'HOEREN' | 'SPRECHEN' | 'LESEN' | 'SCHREIBEN'

export interface PlacementQuestion {
  id: number
  skillSection: string
  type: string
  questionDe: string
  questionVi?: string | null
  audioTranscript?: string | null
  /** MULTIPLE_CHOICE có mảng; các loại khác `null` ⇒ ô nhập tự do. */
  options?: string[] | null
}

export interface PlacementTestCreated {
  testId: string
  questions: PlacementQuestion[]
  timeLimit?: number
}

export interface PlacementResult {
  passed: boolean
  scorePercent: number
  correctCount: number
  totalQuestions: number
  weakModules?: number[]
  startingNodeId?: number
  retryAfterDays?: number
  message?: string
}

export type PlacementAnswers = Record<string, string>

/**
 * Trình độ đưa qua route param: chỉ nhận đúng băng A1–C2 (viết hoa); rác/thiếu/A0 → `null` để
 * màn hình rơi về hồ sơ học trên server, không bao giờ gửi `claimedLevel` bịa lên API.
 */
export function normalizePlacementLevel(raw: unknown): PlacementLevel | null {
  if (typeof raw !== 'string') return null
  const up = raw.trim().toUpperCase()
  return (PLACEMENT_LEVELS as readonly string[]).includes(up) ? (up as PlacementLevel) : null
}

// Câu chữ theo ngôn ngữ thiết bị (Q-D, Đợt 3 PR-3 19/09/2026). Hàm thuần, không hook — màn gọi
// `translate()` gián tiếp qua các helper dưới; jest (mock locale vi) thấy đúng chuỗi cũ.
const placementLibMessages = defineMessages(
  {
    skill: { hoeren: 'Nghe', sprechen: 'Nói', lesen: 'Đọc', schreiben: 'Viết' },
    result: {
      score: '{correct}/{total} câu đúng ({percent}%)',
      passedTitle: 'Tốt rồi, bạn đã sẵn sàng!',
      passedBody: 'Lộ trình của bạn bắt đầu ở chặng {level} — đúng với trình độ bạn tự đánh giá.',
      passedCta: 'Vào lộ trình của tôi',
      failedTitle: 'Mình đã tìm ra chỗ cần ôn',
      failedWeak: 'Có {weak} chủ đề cần củng cố trước khi vào {level}. ',
      failedNoWeak: 'Một vài phần của {level} còn chưa chắc. ',
      failedTail: 'Lộ trình sẽ bắt đầu thấp hơn một chút để bạn không bị hụt — làm lại bài kiểm tra được sau {retry} ngày.',
      failedCta: 'Xem lộ trình phù hợp',
    },
  },
  {
    en: {
      skill: { hoeren: 'Listening', sprechen: 'Speaking', lesen: 'Reading', schreiben: 'Writing' },
      result: {
        score: '{correct}/{total} correct ({percent}%)',
        passedTitle: "Great, you're ready!",
        passedBody: 'Your roadmap starts at stage {level} — matching the level you chose.',
        passedCta: 'Go to my roadmap',
        failedTitle: 'We found what to review',
        failedWeak: '{weak} topics need strengthening before {level}. ',
        failedNoWeak: 'A few parts of {level} are still shaky. ',
        failedTail: "Your roadmap will start slightly lower so you don't fall behind — you can retake the test in {retry} days.",
        failedCta: 'See the roadmap that fits',
      },
    },
    de: {
      skill: { hoeren: 'Hören', sprechen: 'Sprechen', lesen: 'Lesen', schreiben: 'Schreiben' },
      result: {
        score: '{correct}/{total} richtig ({percent} %)',
        passedTitle: 'Super, du bist bereit!',
        passedBody: 'Dein Lernweg beginnt bei Etappe {level} – passend zu deiner Selbsteinschätzung.',
        passedCta: 'Zu meinem Lernweg',
        failedTitle: 'Wir haben gefunden, was du wiederholen solltest',
        failedWeak: '{weak} Themen solltest du vor {level} festigen. ',
        failedNoWeak: 'Einige Teile von {level} sitzen noch nicht. ',
        failedTail: 'Dein Lernweg beginnt etwas tiefer, damit du nicht den Anschluss verlierst – den Test kannst du in {retry} Tagen wiederholen.',
        failedCta: 'Passenden Lernweg ansehen',
      },
    },
  },
)

/** Nhãn + glyph nhận diện theo kỹ năng (GaGlyph — luật GALERIE_GLYPHS.md, không emoji). */
export function skillMeta(section: string): { label: string; glyph: GlyphName } {
  const t = translate(placementLibMessages)
  switch (section) {
    case 'HOEREN':
      return { label: t('skill.hoeren'), glyph: 'nghe' }
    case 'SPRECHEN':
      return { label: t('skill.sprechen'), glyph: 'noi' }
    case 'LESEN':
      return { label: t('skill.lesen'), glyph: 'doc' }
    default:
      return { label: t('skill.schreiben'), glyph: 'viet' }
  }
}

export function isChoiceQuestion(q: Pick<PlacementQuestion, 'options'>): boolean {
  return Array.isArray(q.options) && q.options.length > 0
}

/** Câu đã có câu trả lời không rỗng (server `trim()` rồi mới chấm — khoảng trắng = bỏ trống). */
export function isAnswered(answers: PlacementAnswers, questionId: number): boolean {
  return (answers[String(questionId)] ?? '').trim().length > 0
}

export function answeredCount(questions: readonly PlacementQuestion[], answers: PlacementAnswers): number {
  return questions.filter((q) => isAnswered(answers, q.id)).length
}

/** Tiến độ 0..1 cho thanh: câu đang xem (không phải câu đã trả lời) — giống dải web. */
export function placementProgress(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, (current + 1) / total))
}

export interface PlacementResultCopy {
  title: string
  score: string
  body: string
  cta: string
}

/**
 * Câu chữ màn kết quả. Đậu: vào lộ trình ở đúng trình độ tự khai. Rớt: server đã hạ điểm khởi
 * đầu (`startingNodeId`) — nói thẳng là lộ trình bắt đầu thấp hơn một chút, kèm module cần ôn;
 * KHÔNG hiện mã máy (số module chỉ có nghĩa với giáo trình, người học không đọc được).
 */
export function placementResultCopy(result: PlacementResult, level: string): PlacementResultCopy {
  const t = translate(placementLibMessages)
  const score = t('result.score', { correct: result.correctCount, total: result.totalQuestions, percent: result.scorePercent })
  if (result.passed) {
    return {
      title: t('result.passedTitle'),
      score,
      body: t('result.passedBody', { level }),
      cta: t('result.passedCta'),
    }
  }
  const weak = result.weakModules?.length ?? 0
  const retry = result.retryAfterDays ?? 3
  return {
    title: t('result.failedTitle'),
    score,
    body:
      (weak > 0 ? t('result.failedWeak', { weak, level }) : t('result.failedNoWeak', { level })) +
      t('result.failedTail', { retry }),
    cta: t('result.failedCta'),
  }
}

export const placementApi = {
  async create(claimedLevel: PlacementLevel): Promise<PlacementTestCreated> {
    const { data } = await api.post<PlacementTestCreated>('/skill-tree/placement-test', { claimedLevel })
    return { testId: data.testId, questions: data.questions ?? [], timeLimit: data.timeLimit }
  },
  async submit(testId: string, answers: PlacementAnswers): Promise<PlacementResult> {
    const { data } = await api.post<PlacementResult>(`/skill-tree/placement-test/${testId}/submit`, { answers })
    return data
  },
}
