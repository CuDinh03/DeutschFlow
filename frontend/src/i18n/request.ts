import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const SUPPORTED = new Set(['vi', 'en', 'de'])

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value ?? 'vi'
  const locale = SUPPORTED.has(raw) ? raw : 'vi'

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
