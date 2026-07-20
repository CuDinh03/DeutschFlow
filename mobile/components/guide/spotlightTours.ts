// Step content for the spotlight tours (onboarding v1). Pure data + factories so
// the copy is unit-testable without rendering the overlay.
//
// Target ids are registered by the anchoring screens via <SpotlightTarget> /
// useSpotlightTarget; `route` tells the tour host which screen must be focused
// before the step's target can be measured (cross-tab steps).

export type SpotlightTourId = 'home' | 'srs_intro' | 'speaking_intro'

export interface SpotlightStep {
  /** Stable analytics id for guide_tour_step_viewed. */
  id: string
  /** Anchor registered by the owning screen. */
  targetId: string
  title: string
  desc: string
  /** Screen that must be focused before measuring (host navigates + waits). */
  route?: '/(student)' | '/(student)/learn'
  /** Final "do it for real" step: the cutout lets the tap through to the app. */
  tapThrough?: boolean
}

export interface SpotlightTourParams {
  /** Daily study goal (minutes) picked in onboarding — step 1 copy. */
  dailyGoalMinutes?: number | null
  /** Due SRS cards — srs_intro copy. */
  dueCount?: number | null
}

/** Target ids — one place so screens and steps can't drift apart. */
export const SPOTLIGHT_TARGETS = {
  homeStreak: 'home-streak',
  homeSrsCard: 'home-srs-card',
  tabLearn: 'tab-learn',
  tabSpeaking: 'tab-speaking',
  learnActiveNode: 'learn-active-node',
  speakingModeTabs: 'speaking-mode-tabs',
} as const

// Thứ tự 5 bước ĐÃ CHỐT với owner (plan 2026-07-17 §5.2 — Q2): streak → tab Học
// (chuyển tab) → chặng đang mở → tab Speaking → kết tương tác. Học trước, luyện từ sau.
function homeSteps(params: SpotlightTourParams): SpotlightStep[] {
  const goal = params.dailyGoalMinutes ?? null
  return [
    {
      id: 'streak',
      targetId: SPOTLIGHT_TARGETS.homeStreak,
      route: '/(student)',
      title: 'Giữ chuỗi mỗi ngày',
      desc: goal
        ? `Mỗi ngày 1 hoạt động để giữ chuỗi. Mục tiêu của bạn: ${goal} phút/ngày.`
        : 'Mỗi ngày 1 hoạt động để giữ chuỗi — chỉ vài phút là đủ.',
    },
    {
      id: 'tab_learn',
      targetId: SPOTLIGHT_TARGETS.tabLearn,
      title: 'Bài mới nằm ở đây',
      desc: 'Tab Học chứa lộ trình A1→B2 đã cá nhân hoá cho bạn. Bấm Tiếp để mở thử.',
    },
    {
      id: 'active_node',
      targetId: SPOTLIGHT_TARGETS.learnActiveNode,
      route: '/(student)/learn',
      title: 'Chặng đang mở',
      desc: 'Mỗi ngày hoàn thành chặng đang sáng là đủ tiến bộ.',
    },
    {
      id: 'tab_speaking',
      targetId: SPOTLIGHT_TARGETS.tabSpeaking,
      title: 'Luyện nói với mentor AI',
      desc: 'Như câu Hallo bạn vừa nói, nhưng thành hội thoại thật sự.',
    },
    {
      id: 'try_it',
      targetId: SPOTLIGHT_TARGETS.learnActiveNode,
      route: '/(student)/learn',
      tapThrough: true,
      title: 'Bấm thử luôn!',
      desc: 'Chạm vào chặng đang sáng để vào bài đầu tiên của bạn.',
    },
  ]
}

// Coach mark ngữ cảnh (Q3): bắn khi thẻ "Ôn tập hôm nay" render thật (dueSrs > 0)
// sau bài học đầu — SRS tách khỏi tour chính.
function srsIntroSteps(params: SpotlightTourParams): SpotlightStep[] {
  const n = params.dueCount ?? 0
  return [
    {
      id: 'srs_card',
      targetId: SPOTLIGHT_TARGETS.homeSrsCard,
      route: '/(student)',
      title: 'Ôn để không quên',
      desc:
        n > 0
          ? `${n} từ bạn vừa học đã vào hàng chờ ôn — quay lại mỗi ngày để không quên.`
          : 'Từ bạn vừa học đã vào hàng chờ ôn — quay lại mỗi ngày để không quên.',
    },
  ]
}

function speakingIntroSteps(): SpotlightStep[] {
  return [
    {
      id: 'mode_tabs',
      targetId: SPOTLIGHT_TARGETS.speakingModeTabs,
      title: 'Chọn cách luyện',
      desc: 'Hội thoại tự do, phỏng vấn thử hoặc bài học theo tình huống — rồi chọn mentor đồng hành bên dưới.',
    },
  ]
}

export function buildTourSteps(tourId: SpotlightTourId, params: SpotlightTourParams = {}): SpotlightStep[] {
  switch (tourId) {
    case 'home':
      return homeSteps(params)
    case 'srs_intro':
      return srsIntroSteps(params)
    case 'speaking_intro':
      return speakingIntroSteps()
  }
}
