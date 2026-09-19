// Mentor presentation metadata for onboarding surfaces (survey preview + the
// post-signup "first sentence" moment). Keyed by the backend mentor code from
// GET /onboarding/mentor. Extracted from app/(auth)/onboarding.tsx so both
// screens share one map.

import { getDeviceLocale, type Locale } from '@/lib/i18n'

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

// Tagline theo ngôn ngữ thiết bị (Q-D, Đợt 3 PR-3 19/09/2026) — bản en/de chép từ catalog web
// `onboarding.mentorTaglines` để hai nền tảng gọi mentor cùng một cách. `MENTOR_META` ở trên vẫn là
// bản vi (nguồn) cho chỗ dùng cũ; màn onboarding/first-sentence gọi `mentorTagline(code)`.
const TAGLINE_EN: Record<string, string> = {
  ANNA: 'Career advisor & exam coach', LUKAS: 'Tech Lead — IT', EMMA: 'Business & office',
  KLAUS: 'Head chef — Restaurant', WEBER: 'Dermatologist', SARAH: 'Medical assistant',
  SCHNEIDER: 'Eye doctor', LENA: 'Retail', THOMAS: 'Baker', PETRA: "Butcher's shop",
  MAX: 'Machine operator', OLIVER: 'CNC machinist', NIKLAS: 'Restaurant server',
  NINA: 'Hotel receptionist', HANNIE: 'MC / Media', JONAS: 'IT support — beginner',
  MARIE: 'Nursing assistant — beginner', TIM: 'Kitchen helper — beginner',
  JULIA: 'Production helper — beginner', FELIX: 'Office — apprentice',
  MIA: 'Social media assistant — beginner',
}
const TAGLINE_DE: Record<string, string> = {
  ANNA: 'Berufsberaterin & Prüfungscoach', LUKAS: 'Tech Lead — IT', EMMA: 'Business & Büro',
  KLAUS: 'Küchenchef — Restaurant', WEBER: 'Dermatologin', SARAH: 'Medizinische Fachangestellte',
  SCHNEIDER: 'Augenarzt', LENA: 'Einzelhandel', THOMAS: 'Bäcker', PETRA: 'Metzgerei',
  MAX: 'Maschinenbediener', OLIVER: 'CNC-Fräser', NIKLAS: 'Kellner — Restaurant',
  NINA: 'Hotelrezeptionistin', HANNIE: 'MC / Medien', JONAS: 'IT-Support — Einstieg',
  MARIE: 'Pflegehelferin — Einstieg', TIM: 'Küchenhilfe — Einstieg',
  JULIA: 'Produktionshelferin — Einstieg', FELIX: 'Büro — Azubi',
  MIA: 'Social-Media-Assistentin — Einstieg',
}
const TAGLINE_FALLBACK: Record<Locale, string> = {
  vi: 'Người đồng hành học tập của bạn',
  en: 'Your learning companion',
  de: 'Dein Lernbegleiter',
}

/** Tagline mentor theo ngôn ngữ thiết bị; mã lạ → câu chung. */
export function mentorTagline(code: string | null | undefined, locale: Locale = getDeviceLocale()): string {
  if (!code) return TAGLINE_FALLBACK[locale]
  const byLocale = locale === 'en' ? TAGLINE_EN[code] : locale === 'de' ? TAGLINE_DE[code] : MENTOR_META[code]?.tagline
  return byLocale ?? MENTOR_META[code]?.tagline ?? TAGLINE_FALLBACK[locale]
}

/** First name only — "Anna Weber" reads awkward in "Ich bin …". */
export function mentorFirstName(mentor: OnboardingMentor | null): string {
  return mentor?.displayName?.split(' ')[0] ?? 'Anna'
}
