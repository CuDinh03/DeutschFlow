import { useMemo } from 'react'

/**
 * i18n cho onboarding/auth mobile — Q-D (kế hoạch onboarding 17/09/2026 §4.8, Đợt 3 PR-3).
 *
 * Phạm vi CÓ CHỦ Ý hẹp: chỉ các màn `app/(auth)/*` và `components/onboarding/*`. Phần còn lại của
 * app vẫn tiếng Việt (AC-ONB-24). Không kéo i18n-js/next-intl: một hook nhỏ, từ điển theo TỪNG MÀN.
 *
 * Cách dùng:
 *   const messages = defineMessages({ title: 'Xin chào {name}' }, { en: {...}, de: {...} })
 *   const t = useT(messages)
 *   t('title', { name })
 *
 * Bất biến:
 * - `vi` là nguồn chân lý; `en`/`de` bắt buộc CÙNG HÌNH DẠNG — `tsc` bắt thiếu/thừa khoá ngay
 *   (không cần script parity như web). Khoá lồng nhau, truy cập bằng đường chấm có kiểu.
 * - Mỗi ngôn ngữ thuần một thứ tiếng (luật owner 10/09): không nhãn song ngữ trong từ điển.
 * - Ngôn ngữ = thiết bị (`expo-localization`), đọc MỘT lần lúc nạp module; iOS/Android khởi động
 *   lại app khi đổi ngôn ngữ nên không cần store. Không thuộc vi/en/de ⇒ `vi` (như web).
 * - Không ném lỗi lúc chạy: thiếu khoá (không thể qua tsc, nhưng phòng runtime) ⇒ trả về chính khoá.
 */

export type Locale = 'vi' | 'en' | 'de'
export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en', 'de'] as const
export const DEFAULT_LOCALE: Locale = 'vi'

/** Từ điển: chuỗi hoặc nhóm lồng nhau. */
export type MessageTree = { readonly [key: string]: string | MessageTree }

/** Cùng hình dạng khoá với T nhưng lá là `string` bất kỳ (en/de dịch tự do, chỉ khoá phải khớp). */
export type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }

export type Messages<T extends MessageTree> = { readonly vi: T; readonly en: Shape<T>; readonly de: Shape<T> }

/** Đường chấm có kiểu tới mọi LÁ chuỗi: 'a' | 'group.b' | … */
export type MessagePath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessagePath<T[K]>}`
    }[keyof T & string]

/**
 * Khai báo từ điển một màn. `vi` quyết định kiểu; `en`/`de` phải khớp từng khoá — khai thừa hay
 * thiếu đều đỏ ở `tsc` (excess property check trên object literal + kiểu T).
 */
export function defineMessages<const T extends MessageTree>(
  vi: T,
  // NoInfer: T chỉ suy từ `vi`; en/de bị KIỂM theo T (thiếu khoá = lỗi, thừa khoá = excess property).
  rest: { readonly en: NoInfer<Shape<T>>; readonly de: NoInfer<Shape<T>> },
): Messages<T> {
  return { vi, en: rest.en, de: rest.de }
}

export function normalizeLocale(tag: string | null | undefined): Locale {
  const code = (tag ?? '').toLowerCase().split(/[-_]/)[0]
  return (SUPPORTED_LOCALES as readonly string[]).includes(code) ? (code as Locale) : DEFAULT_LOCALE
}

let cachedLocale: Locale | null = null

/**
 * Ngôn ngữ thiết bị, đọc một lần. Bọc try/catch: trong jest (mock) hoặc khi native module thiếu
 * thì rơi về `vi` chứ không đổ màn Chào mừng.
 */
export function getDeviceLocale(): Locale {
  if (cachedLocale) return cachedLocale
  let tag: string | null = null
  try {
    // require động để test node-env không cần nạp gói ESM; moduleNameMapper trỏ về mock.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Localization = require('expo-localization') as { getLocales?: () => { languageCode?: string | null }[] }
    tag = Localization.getLocales?.()[0]?.languageCode ?? null
  } catch {
    tag = null
  }
  cachedLocale = normalizeLocale(tag)
  return cachedLocale
}

/** Chỉ cho test: xoá cache để đổi ngôn ngữ giữa các ca. */
export function resetDeviceLocaleForTests(): void {
  cachedLocale = null
}

export type Values = Record<string, string | number>

function lookup(tree: MessageTree, path: string): string | null {
  let node: string | MessageTree | undefined = tree
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return null
    node = node[part]
  }
  return typeof node === 'string' ? node : null
}

/** Thay `{name}` bằng giá trị; chỗ giữ không có giá trị thì để nguyên (dễ thấy khi soát). */
export function interpolate(template: string, values?: Values): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m))
}

export type Translator<T extends MessageTree> = (key: MessagePath<T>, values?: Values) => string

/** Bản không-hook (dùng ngoài component: toast, alert, hằng số). */
export function translate<T extends MessageTree>(messages: Messages<T>, locale: Locale = getDeviceLocale()): Translator<T> {
  return (key, values) => {
    const found = lookup(messages[locale] as MessageTree, key) ?? lookup(messages[DEFAULT_LOCALE], key)
    return interpolate(found ?? key, values)
  }
}

/** Hook cho component: `const t = useT(messages)`. Ổn định định danh theo từ điển + locale. */
export function useT<T extends MessageTree>(messages: Messages<T>): Translator<T> {
  const locale = getDeviceLocale()
  return useMemo(() => translate(messages, locale), [messages, locale])
}
