// Mentor presentation metadata for onboarding surfaces (survey preview + the
// post-signup "first sentence" moment). Keyed by the backend mentor code from
// GET /onboarding/mentor. Extracted from app/(auth)/onboarding.tsx so both
// screens share one map.

export interface OnboardingMentor {
  code: string
  displayName: string
  difficulty: string
}

export const MENTOR_META: Record<string, { emoji: string; tagline: string }> = {
  ANNA: { emoji: '🧑‍🏫', tagline: 'Cố vấn nghề & luyện thi' },
  LUKAS: { emoji: '💻', tagline: 'Tech Lead — CNTT' },
  EMMA: { emoji: '💼', tagline: 'Business & văn phòng' },
  KLAUS: { emoji: '👨‍🍳', tagline: 'Bếp trưởng — Nhà hàng' },
  WEBER: { emoji: '🩺', tagline: 'Bác sĩ da liễu' },
  SARAH: { emoji: '🏥', tagline: 'Trợ lý y khoa' },
  SCHNEIDER: { emoji: '👁️', tagline: 'Bác sĩ mắt' },
  LENA: { emoji: '🛍️', tagline: 'Bán lẻ' },
  THOMAS: { emoji: '🥐', tagline: 'Thợ làm bánh' },
  PETRA: { emoji: '🥩', tagline: 'Cửa hàng thịt' },
  MAX: { emoji: '⚙️', tagline: 'Vận hành máy' },
  OLIVER: { emoji: '🔧', tagline: 'Thợ CNC' },
  NIKLAS: { emoji: '🍽️', tagline: 'Phục vụ nhà hàng' },
  NINA: { emoji: '🏨', tagline: 'Lễ tân khách sạn' },
  HANNIE: { emoji: '🎤', tagline: 'MC / Truyền thông' },
}

/** First name only — "Anna Weber" reads awkward in "Ich bin …". */
export function mentorFirstName(mentor: OnboardingMentor | null): string {
  return mentor?.displayName?.split(' ')[0] ?? 'Anna'
}

export function mentorEmoji(mentor: OnboardingMentor | null): string {
  return (mentor && MENTOR_META[mentor.code]?.emoji) ?? '🧑‍🏫'
}
