/**
 * Translator đọc catalog THẬT cho unit test component /v2 (đợt 3 audit UTF-8/i18n, 06/09/2026).
 *
 * Các test cũ mock next-intl trả thẳng key (`useTranslations: () => (k) => k`) rồi khẳng định theo
 * key. Khi một component chuyển chuỗi Việt cứng sang `t('…')`, test đang khẳng định theo CHỮ NHÌN
 * THẤY (vd. `getByText('điểm / 10')`) sẽ đỏ dù hành vi không đổi. Helper này giữ được khẳng định
 * theo chữ: resolve khoá trong `messages/<locale>.json` + mọi phần `messages/v2/<area>.<locale>.json`
 * (danh sách area đọc từ `V2_AREAS` trong src/i18n/request.ts — không chép tay).
 *
 * Dùng trong test:
 *   vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
 * hoặc từng translator: `const t = catalogT('v2.student.sessionSummary')`.
 *
 * Hỗ trợ: `t(key, values)` với `{name}`, `t.has`, `t.raw`, `t.rich(key, { b: (c) => <b>{c}</b> })`,
 * `t.markup`. KHÔNG hỗ trợ ICU plural/select — khoá mới trong /v2 dùng nội suy đơn giản.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'

export type UiLocale = 'vi' | 'en' | 'de'
type Messages = Record<string, unknown>

const FE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const BCP47: Record<UiLocale, string> = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }

function readJson(path: string): Messages {
  return JSON.parse(readFileSync(path, 'utf8')) as Messages
}

function v2Areas(): string[] {
  const src = readFileSync(resolve(FE_ROOT, 'src/i18n/request.ts'), 'utf8')
  const m = src.match(/const\s+V2_AREAS\s*=\s*\[([^\]]*)\]/)
  if (!m) throw new Error('intlCatalog: không tìm thấy V2_AREAS trong src/i18n/request.ts')
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1])
}

const cache = new Map<UiLocale, Messages>()

/** Toàn bộ messages như request.ts trả về cho locale: base + `v2` gộp mọi area. */
export function catalogMessages(locale: UiLocale = 'vi'): Messages {
  const hit = cache.get(locale)
  if (hit) return hit
  const base = readJson(resolve(FE_ROOT, 'messages', `${locale}.json`))
  const v2 = Object.assign(
    {},
    ...v2Areas().map((area) => readJson(resolve(FE_ROOT, 'messages', 'v2', `${area}.${locale}.json`))),
  ) as Messages
  const all: Messages = { ...base, v2 }
  cache.set(locale, all)
  return all
}

function resolvePath(root: unknown, dotted: string): unknown {
  let cur = root
  for (const seg of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) return undefined
    cur = (cur as Messages)[seg]
  }
  return cur
}

function interpolate(s: string, values?: Record<string, unknown>): string {
  return s.replace(/\{(\w+)\}/g, (whole, k: string) => (values && k in values ? String(values[k]) : whole))
}

type TagFn = (chunks: React.ReactNode) => React.ReactNode

function richNodes(s: string, tags: Record<string, TagFn>): React.ReactNode {
  const out: React.ReactNode[] = []
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const fn = tags[m[1]]
    out.push(fn ? React.createElement(React.Fragment, { key: i++ }, fn(m[2])) : m[0])
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out.length === 1 ? out[0] : out
}

export interface CatalogT {
  (key: string, values?: Record<string, unknown>): string
  has(key: string): boolean
  raw(key: string): unknown
  rich(key: string, tags?: Record<string, TagFn>, values?: Record<string, unknown>): React.ReactNode
  markup(key: string, tags?: Record<string, (chunks: string) => string>, values?: Record<string, unknown>): string
}

/** Translator cho một namespace (vd. `'v2.student.sessionSummary'`); khoá thiếu → trả đường dẫn đầy đủ như next-intl. */
export function catalogT(namespace?: string, locale: UiLocale = 'vi'): CatalogT {
  const root = catalogMessages(locale)
  const full = (key: string) => (namespace ? `${namespace}.${key}` : key)
  const get = (key: string) => resolvePath(root, full(key))
  const t = ((key: string, values?: Record<string, unknown>) => {
    const v = get(key)
    return typeof v === 'string' ? interpolate(v, values) : full(key)
  }) as CatalogT
  t.has = (key) => get(key) !== undefined
  t.raw = (key) => get(key)
  t.rich = (key, tags = {}, values) => richNodes(t(key, values), tags)
  t.markup = (key, tags = {}, values) =>
    t(key, values).replace(/<(\w+)>([\s\S]*?)<\/\1>/g, (whole, tag: string, inner: string) => (tags[tag] ? tags[tag](inner) : whole))
  return t
}

/**
 * Factory cho `vi.mock('next-intl', …)`: `useTranslations` đọc catalog thật, `useLocale` trả locale
 * đã chọn, `useFormatter` tối thiểu (dateTime/number), provider là pass-through.
 */
export function nextIntlCatalogMock(locale: UiLocale = 'vi') {
  return {
    useLocale: () => locale,
    useTranslations: (namespace?: string) => catalogT(namespace, locale),
    useMessages: () => catalogMessages(locale),
    useFormatter: () => ({
      dateTime: (d: Date | number, opts?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(BCP47[locale], opts).format(d),
      number: (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(BCP47[locale], opts).format(n),
      relativeTime: (d: Date | number) => new Date(d).toISOString(),
    }),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  }
}
