/**
 * Ngôn ngữ theo URL cho TRANG CÔNG KHAI (đợt 1 định hướng A+B+E, 19/10/2026).
 *
 * Vì sao: trước đây ngôn ngữ chỉ đọc từ cookie `locale` (src/i18n/request.ts). Bot tìm kiếm và trình
 * xem trước link (Zalo, Facebook) không có cookie nên chỉ thấy bản tiếng Việt — người học ngoài Việt
 * Nam gần như không tìm thấy site. Nay trang công khai đã dịch có URL riêng cho từng ngôn ngữ:
 *   tiếng Việt  `/`      (không tiền tố, link cũ không hỏng)
 *   tiếng Anh   `/en/`
 *   tiếng Đức   `/de/`
 *
 * Cách chạy: middleware thấy `/en/…` hoặc `/de/…` của một đường trong PUBLIC_LOCALIZED_PATHS thì
 * REWRITE về đường gốc và gắn header LOCALE_HEADER; request.ts đọc header này TRƯỚC cookie. Không
 * dời file vào thư mục `[locale]`, nên logic xác thực của middleware và phần sau đăng nhập (`/v2/…`,
 * vẫn đọc ngôn ngữ từ cookie) không đổi.
 *
 * Chỉ thêm một đường vào PUBLIC_LOCALIZED_PATHS khi trang đó THẬT SỰ đọc chữ từ catalog ba thứ tiếng.
 * Trang còn viết cứng tiếng Việt (/luyen-thi, /privacy, …) mà gắn tiền tố thì `/en/luyen-thi/` vẫn ra
 * tiếng Việt — tệ hơn không có. `/about` vào danh sách ngày 19/10/2026 khi trang chuyển sang catalog.
 * `/phong-van` (trang tổng + từng nghề) vào PUBLIC_LOCALIZED_PREFIXES ngày 20/10/2026 (đợt 2d).
 *
 * Module thuần (không import Next) để dùng được ở middleware (edge), server và client.
 */

export const PUBLIC_LOCALES = ['vi', 'en', 'de'] as const
export type PublicLocale = (typeof PUBLIC_LOCALES)[number]
export const DEFAULT_PUBLIC_LOCALE: PublicLocale = 'vi'

/** Ngôn ngữ có tiền tố trên URL. Tiếng Việt là mặc định nên không có tiền tố. */
export const PREFIXED_LOCALES = ['en', 'de'] as const

/** Header middleware gắn vào request đã rewrite để request.ts biết ngôn ngữ theo URL. */
export const LOCALE_HEADER = 'x-df-locale'

/**
 * Đường công khai đã dịch đủ ba thứ tiếng, dạng KHÔNG dấu "/" cuối (trừ trang chủ "/").
 * So khớp luôn qua normalizePath vì next.config đặt `trailingSlash: true`.
 */
export const PUBLIC_LOCALIZED_PATHS: ReadonlySet<string> = new Set(['/', '/about'])

/** Nhóm trang công khai đã dịch theo tiền tố: chính tiền tố và mọi đường con (`/phong-van/kellner`). */
export const PUBLIC_LOCALIZED_PREFIXES: readonly string[] = ['/phong-van']

export function isPublicLocale(v: string | null | undefined): v is PublicLocale {
  return (PUBLIC_LOCALES as readonly string[]).includes(v ?? '')
}

/** Bỏ dấu "/" cuối để so khớp; "/" giữ nguyên. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/**
 * Tách tiền tố ngôn ngữ: `/en/` → { locale: 'en', path: '/' }; `/about/` → { locale: null, path: '/about/' }.
 * `path` giữ nguyên dạng dấu "/" cuối của đầu vào.
 */
export function splitLocalePrefix(pathname: string): { locale: PublicLocale | null; path: string } {
  const m = /^\/(en|de)(\/.*)?$/.exec(pathname)
  if (!m) return { locale: null, path: pathname }
  return { locale: m[1] as PublicLocale, path: m[2] || '/' }
}

export function isLocalizedPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return PUBLIC_LOCALIZED_PATHS.has(path)
    || PUBLIC_LOCALIZED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** Đường có tiền tố cho một ngôn ngữ, luôn có dấu "/" cuối (khớp `trailingSlash: true`). */
export function localizedHref(locale: PublicLocale, path: string): string {
  const clean = normalizePath(path)
  const tail = clean === '/' ? '/' : `${clean}/`
  return locale === DEFAULT_PUBLIC_LOCALE ? tail : `/${locale}${tail}`
}

/**
 * Trang công khai mà mỗi ngôn ngữ có slug RIÊNG (đợt 3a, 24/10/2026): `/trung-tam/` (vi) ↔ `/en/schools/` (en).
 * Khoá = đường gốc (bản tiếng Việt, cũng là thư mục trang trong `src/app`). Giá trị = đường KHÔNG tiền tố
 * của từng ngôn ngữ đã có bản. Ngôn ngữ vắng mặt = chưa có bản đó: tiếng Đức của trang trung tâm chờ
 * việc pháp lý (Impressum) — `/de/schools/` hay `/de/trung-tam/` đều 404, không rơi về bản khác.
 *
 * Không dùng PUBLIC_LOCALIZED_PATHS cho các trang này: danh sách đó ngầm hiểu cùng một slug cho cả ba
 * ngôn ngữ (`/about` ↔ `/en/about`), nên sẽ mở nhầm `/en/trung-tam/` và `/de/trung-tam/`.
 */
export const PUBLIC_LOCALIZED_SLUGS: Readonly<Record<string, Partial<Record<PublicLocale, string>>>> = {
  '/trung-tam': { vi: '/trung-tam', en: '/schools' },
  '/hoc-nghe': { vi: '/hoc-nghe', en: '/vocational-training' },
}

/** Đường gốc của trang slug-riêng mà (ngôn ngữ, đường không tiền tố) trỏ tới; null nếu không phải. */
export function slugPageFor(locale: PublicLocale, path: string): string | null {
  const clean = normalizePath(path)
  for (const [page, slugs] of Object.entries(PUBLIC_LOCALIZED_SLUGS)) {
    if (slugs[locale] === clean) return page
  }
  return null
}

/**
 * Href của một trang công khai (theo đường gốc) ở ngôn ngữ `locale`, tính cả trang slug riêng; luôn có
 * dấu "/" cuối. null khi trang chưa có bản ngôn ngữ đó, hoặc không phải trang công khai đã dịch.
 */
export function publicHref(locale: PublicLocale, page: string): string | null {
  const clean = normalizePath(page)
  const slugs = PUBLIC_LOCALIZED_SLUGS[clean]
  if (slugs) {
    const slug = slugs[locale]
    return slug ? localizedHref(locale, slug) : null
  }
  return isLocalizedPublicPath(clean) ? localizedHref(locale, clean) : null
}

/** Bảng hreflang chỉ gồm các ngôn ngữ trang thật sự có; x-default trỏ bản tiếng Việt. */
export function publicAlternates(page: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of PUBLIC_LOCALES) {
    const href = publicHref(l, page)
    if (href) out[l] = href
  }
  out['x-default'] = publicHref(DEFAULT_PUBLIC_LOCALE, page) ?? localizedHref(DEFAULT_PUBLIC_LOCALE, page)
  return out
}

/** Bảng hreflang cho metadata/sitemap của một đường công khai đã dịch. */
export function hreflangAlternates(path: string): Record<string, string> {
  return {
    vi: localizedHref('vi', path),
    en: localizedHref('en', path),
    de: localizedHref('de', path),
    'x-default': localizedHref(DEFAULT_PUBLIC_LOCALE, path),
  }
}
