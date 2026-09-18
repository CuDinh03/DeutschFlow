// Mentor presentation metadata for onboarding surfaces (survey preview + the
// post-signup "first sentence" moment). Keyed by the backend mentor code from
// GET /onboarding/mentor. Extracted from app/(auth)/onboarding.tsx so both
// screens share one map.

export interface OnboardingMentor {
  code: string
  displayName: string
  difficulty: string
}

export const MENTOR_META: Record<string, { tagline: string }> = {
  ANNA: { tagline: 'Cố vấn nghề & luyện thi' },
  LUKAS: { tagline: 'Tech Lead — CNTT' },
  EMMA: { tagline: 'Business & văn phòng' },
  KLAUS: { tagline: 'Bếp trưởng — Nhà hàng' },
  WEBER: { tagline: 'Bác sĩ da liễu' },
  SARAH: { tagline: 'Trợ lý y khoa' },
  SCHNEIDER: { tagline: 'Bác sĩ mắt' },
  LENA: { tagline: 'Bán lẻ' },
  THOMAS: { tagline: 'Thợ làm bánh' },
  PETRA: { tagline: 'Cửa hàng thịt' },
  MAX: { tagline: 'Vận hành máy' },
  OLIVER: { tagline: 'Thợ CNC' },
  NIKLAS: { tagline: 'Phục vụ nhà hàng' },
  NINA: { tagline: 'Lễ tân khách sạn' },
  HANNIE: { tagline: 'MC / Truyền thông' },
  // Mentor nhập môn (F-15) — mỗi lĩnh vực có một người bậc BEGINNER để tài khoản
  // FREE không rơi hết về Anna. Tagline nói rõ "nhập môn" để người học biết vì sao
  // mentor này nói tiếng Đức đơn giản.
  JONAS: { tagline: 'Hỗ trợ IT — nhập môn' },
  MARIE: { tagline: 'Phụ tá điều dưỡng — nhập môn' },
  TIM: { tagline: 'Phụ bếp — nhập môn' },
  JULIA: { tagline: 'Phụ việc sản xuất — nhập môn' },
  FELIX: { tagline: 'Văn phòng — học việc' },
  MIA: { tagline: 'Trợ lý mạng xã hội — nhập môn' },
}

/** First name only — "Anna Weber" reads awkward in "Ich bin …". */
export function mentorFirstName(mentor: OnboardingMentor | null): string {
  return mentor?.displayName?.split(' ')[0] ?? 'Anna'
}
