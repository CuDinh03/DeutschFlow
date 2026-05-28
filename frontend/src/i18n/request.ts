import { getRequestConfig } from 'next-intl/server'

const SUPPORTED = new Set(['vi', 'en', 'de'])

export default getRequestConfig(async () => {
  // Static export: cookies() không available ở build time.
  // Locale mặc định là 'vi', có thể override qua NEXT_PUBLIC_MOBILE_LOCALE.
  const envLocale = process.env.NEXT_PUBLIC_MOBILE_LOCALE ?? ''
  const locale = SUPPORTED.has(envLocale) ? envLocale : 'vi'

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
