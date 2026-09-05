import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatNumber, formatTime, formatVnd, formatVndCompact, toBcp47, toUiLocale } from './format'

const d = new Date(2026, 8, 6, 14, 5) // 06/09/2026 14:05 local

describe('lib/i18n/format (F-I18N-04)', () => {
  it('maps UI locale to BCP-47 with vi fallback', () => {
    expect(toBcp47('vi')).toBe('vi-VN')
    expect(toBcp47('en')).toBe('en-GB')
    expect(toBcp47('de')).toBe('de-DE')
    expect(toBcp47('fr')).toBe('vi-VN')
    expect(toUiLocale(undefined)).toBe('vi')
  })

  it('formats numbers with locale grouping', () => {
    expect(formatNumber('vi', 1234567)).toBe('1.234.567')
    expect(formatNumber('en', 1234567)).toBe('1,234,567')
    expect(formatNumber('de', 1234567)).toBe('1.234.567')
    expect(formatNumber('vi', Number.NaN)).toBe('—')
  })

  it('formats dates day-first for vi/en-GB and dotted for de', () => {
    expect(formatDate('vi', d)).toBe('06/09/2026')
    expect(formatDate('en', d)).toBe('06/09/2026')
    expect(formatDate('de', d)).toBe('06.09.2026')
    expect(formatDate('vi', 'not-a-date')).toBe('—')
    expect(formatDate('vi', null)).toBe('—')
  })

  it('formats time and date-time per locale', () => {
    expect(formatTime('vi', d)).toBe('14:05')
    expect(formatTime('de', d)).toBe('14:05')
    expect(formatDateTime('vi', d)).toContain('14:05')
    expect(formatDateTime('de', d)).toContain('06.09.26')
    expect(formatDateTime('en', d)).toContain('06/09/2026')
  })

  it('keeps VND in Vietnamese convention for every locale', () => {
    expect(formatVnd(299000)).toBe('299.000₫')
    expect(formatVnd(1234.6)).toBe('1.235₫')
    expect(formatVnd(null)).toBe('0₫')
  })

  it('compacts VND with vi suffixes and Intl compact for en/de', () => {
    expect(formatVndCompact('vi', 1_500_000)).toBe('1.5tr₫')
    expect(formatVndCompact('vi', 2_000_000_000)).toBe('2.00tỷ₫')
    expect(formatVndCompact('vi', 45_000)).toBe('45k₫')
    expect(formatVndCompact('en', 1_500_000)).toMatch(/^1\.5m₫$/i)
    expect(formatVndCompact('de', 1_500_000)).toMatch(/^1,5\s?Mio\.₫$/)
    expect(formatVndCompact('en', 2_000_000_000)).toMatch(/^2bn₫$/i)
    expect(formatVndCompact('en', 999)).toBe('999₫')
  })
})
