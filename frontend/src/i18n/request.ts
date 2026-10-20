import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { LOCALE_HEADER } from '@/lib/publicLocale'

const SUPPORTED = new Set(['vi', 'en', 'de'])

// Per-area v2 message files (messages/v2/<area>.<locale>.json). The /v2 (Galerie 2.0) catalog is
// split per area so each area migrates + translates independently instead of churning one giant
// file. Add an area here when its pages are migrated to next-intl.
const V2_AREAS = ['chrome', 'student', 'teacher', 'org', 'adminOps', 'adminContent', 'account', 'auth', 'onboarding', 'landing'] as const

export default getRequestConfig(async () => {
  // SSR (static-export path đã retired): đọc locale từ cookie `locale` — cookie chuẩn của app, đặt
  // lúc login/register (từ user.locale) và bởi LanguageSwitcher/LanguageToggle. Trước đây request.ts
  // KHÔNG đọc cookie nào → cookie `locale` bị bỏ qua server-side (đổi ngôn ngữ không có tác dụng);
  // đọc ở đây sửa bug đó. Thứ tự: cookie → NEXT_PUBLIC_MOBILE_LOCALE → 'vi'. try/catch an toàn nếu
  // cookies() bị gọi trong ngữ cảnh tĩnh (Next chuyển sang dynamic) → fallback mặc định.
  //
  // 19/10/2026 (đợt 1 A+B+E): trang công khai có URL theo ngôn ngữ (`/en/`, `/de/`). Middleware
  // rewrite chúng về đường gốc và gắn header LOCALE_HEADER — header này THẮNG cookie, để URL tiếng
  // Anh luôn ra tiếng Anh kể cả khi trình duyệt còn cookie `locale=vi`. Xem src/lib/publicLocale.ts.
  let locale = 'vi'
  try {
    const urlLocale = headers().get(LOCALE_HEADER) ?? ''
    const cookieLocale = cookies().get('locale')?.value ?? ''
    const envLocale = process.env.NEXT_PUBLIC_MOBILE_LOCALE ?? ''
    locale = SUPPORTED.has(urlLocale)
      ? urlLocale
      : SUPPORTED.has(cookieLocale) ? cookieLocale : SUPPORTED.has(envLocale) ? envLocale : 'vi'
  } catch {
    locale = 'vi'
  }

  // Base = legacy monolithic catalog; everything /v2 is merged under a single `v2` root namespace
  // (pages call useTranslations('v2.<area>.…')).
  const base = (await import(`../../messages/${locale}.json`)).default
  const v2Parts = await Promise.all(
    V2_AREAS.map((area) => import(`../../messages/v2/${area}.${locale}.json`).then((m) => m.default)),
  )
  const v2 = Object.assign({}, ...v2Parts)

  return {
    locale,
    messages: { ...base, v2 },
  }
})
