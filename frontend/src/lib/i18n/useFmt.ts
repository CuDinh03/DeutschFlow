'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  formatVnd,
  formatVndCompact,
  toBcp47,
  toUiLocale,
  type UiLocale,
} from './format'

export interface Fmt {
  locale: UiLocale
  bcp47: string
  num: (n: number | null | undefined, opts?: Intl.NumberFormatOptions) => string
  date: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) => string
  time: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) => string
  dateTime: (d: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) => string
  vnd: (n: number | null | undefined) => string
  vndCompact: (n: number | null | undefined) => string
}

/**
 * Bộ định dạng theo locale UI hiện hành (next-intl `useLocale`). Dùng trong component client:
 * `const fmt = useFmt()` → `fmt.num(1234)`, `fmt.date(iso)`, `fmt.dateTime(iso)`, `fmt.vnd(n)`.
 * Xem lib/i18n/format.ts cho hàm thuần.
 */
export function useFmt(): Fmt {
  const raw = useLocale()
  return useMemo(() => {
    const locale = toUiLocale(raw)
    return {
      locale,
      bcp47: toBcp47(locale),
      num: (n, opts) => formatNumber(locale, n, opts),
      date: (d, opts) => formatDate(locale, d, opts),
      time: (d, opts) => formatTime(locale, d, opts),
      dateTime: (d, opts) => formatDateTime(locale, d, opts),
      vnd: (n) => formatVnd(n),
      vndCompact: (n) => formatVndCompact(locale, n),
    }
  }, [raw])
}
