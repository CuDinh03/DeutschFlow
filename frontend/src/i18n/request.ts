import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED = new Set(['vi', 'en', 'de'])

export default getRequestConfig(async () => {
  // SSR (static-export path đã retired): đọc locale từ cookie `locale` — cookie chuẩn của app, đặt
  // lúc login/register (từ user.locale) và bởi LanguageSwitcher/LanguageToggle. Trước đây request.ts
  // KHÔNG đọc cookie nào → cookie `locale` bị bỏ qua server-side (đổi ngôn ngữ không có tác dụng);
  // đọc ở đây sửa bug đó. Thứ tự: cookie → NEXT_PUBLIC_MOBILE_LOCALE → 'vi'. try/catch an toàn nếu
  // cookies() bị gọi trong ngữ cảnh tĩnh (Next chuyển sang dynamic) → fallback mặc định.
  let locale = 'vi'
  try {
    const cookieLocale = cookies().get('locale')?.value ?? ''
    const envLocale = process.env.NEXT_PUBLIC_MOBILE_LOCALE ?? ''
    locale = SUPPORTED.has(cookieLocale) ? cookieLocale : SUPPORTED.has(envLocale) ? envLocale : 'vi'
  } catch {
    locale = 'vi'
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
