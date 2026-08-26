/**
 * Wave 0 (W0-C1 + Gate 0 review) — test cho cơ chế baseline/ratchet FINGERPRINT.
 * Import trực tiếp từ script để CI và local cùng một logic.
 *
 * Ba regression case owner yêu cầu tại Gate 0 review:
 *   1. Thay violation A bằng violation B trong cùng file → PHẢI fail.
 *   2. Violation trong file MỚI (baseline rỗng) → PHẢI fail.
 *   3. Escape hatch `design-token-allow` KHÔNG có lý do → PHẢI fail (dòng vẫn bị đếm).
 */
import { describe, it, expect } from 'vitest'
// Script là ESM .mjs không có type declaration — khai kiểu tại chỗ cho test.
import {
  scanSource as scanUntyped,
  toFingerprint as fpUntyped,
  diffAgainstBaseline as diffUntyped,
  RULES,
} from '../../scripts/lint-design-tokens.mjs'

type Hit = { line: number; text: string }
type Exception = { file: string; rule: string; pattern: string; reason: string }
type Hits = Record<string, Record<string, Hit[]>>
type Fp = Record<string, Record<string, number>>
const scanSource = scanUntyped as (text: string, exceptions?: Exception[]) => Hits
const toFingerprint = fpUntyped as (hits: Hits) => Fp
const diffAgainstBaseline = diffUntyped as (
  current: Fp,
  baseline?: Fp,
) => Array<{ rule: string; match: string; count: number; allowed: number }>

const fp = (src: string, ex?: Exception[]) => toFingerprint(scanSource(src, ex))

describe('design-token lint — rule matching theo identity', () => {
  it('bắt hex, arbitrary font-size/radius/shadow, shadow mặc định (kể cả hover:)', () => {
    const src = [
      "const c = '#1E9E61'",
      '<div className="text-[13px]" />',
      '<div className="rounded-[6px]" />',
      '<div className="shadow-[0_16px_48px_rgba(22,21,19,0.18)]" />',
      '<span className="hover:shadow-lg shadow-sm" />',
    ].join('\n')
    const f = fp(src)
    expect(f['hex-literal']).toEqual({ '#1E9E61': 1 })
    expect(f['arbitrary-font-size']).toEqual({ 'text-[13px]': 1 })
    expect(f['arbitrary-radius']).toEqual({ 'rounded-[6px]': 1 })
    expect(Object.keys(f['arbitrary-shadow'])).toHaveLength(1)
    expect(f['tailwind-default-shadow']).toEqual({ 'shadow-lg': 1, 'shadow-sm': 1 })
  })

  it('KHÔNG bắt token hợp lệ (text-ga-*, rounded-ga-touch, shadow-ga-*)', () => {
    const src = [
      '<p className="text-ga-small rounded-ga-touch shadow-ga-panel bg-ga-warning-soft" />',
      '<p className="hover:shadow-ga-card-hover shadow-ga-drawer duration-ga-slow" />',
    ].join('\n')
    expect(fp(src)).toEqual({})
  })

  it('đếm SỐ LẦN của cùng một identity trong file', () => {
    const src = "a='#FFCD00'\nb='#FFCD00'\nc='#DA291C'"
    expect(fp(src)['hex-literal']).toEqual({ '#FFCD00': 2, '#DA291C': 1 })
  })

  it('có đủ 5 rule như plan Wave 0.3', () => {
    expect(Object.keys(RULES).sort()).toEqual(
      ['arbitrary-font-size', 'arbitrary-radius', 'arbitrary-shadow', 'hex-literal', 'tailwind-default-shadow'].sort(),
    )
  })
})

describe('ratchet fingerprint — 3 regression case của Gate 0 review', () => {
  it('1. thay violation A bằng B trong cùng file (tổng không đổi) → FAIL', () => {
    const baseline = fp("const old = '#111111'") // debt cũ: A
    const current = fp("const now = '#222222'") // A bị xóa, B thêm vào — tổng vẫn 1
    const violations = diffAgainstBaseline(current, baseline)
    expect(violations).toEqual([{ rule: 'hex-literal', match: '#222222', count: 1, allowed: 0 }])
  })

  it('2. violation trong file MỚI (không có baseline) → FAIL', () => {
    const current = fp('<p className="text-[12px]" />')
    expect(diffAgainstBaseline(current, undefined)).toHaveLength(1)
    expect(diffAgainstBaseline(current, {})).toHaveLength(1)
  })

  it('3a. escape hatch KHÔNG có lý do → dòng vẫn bị đếm (fail)', () => {
    const bare = "const x = '#123456' // design-token-allow"
    const emptyReason = "const x = '#123456' // design-token-allow:   "
    expect(fp(bare)['hex-literal']).toEqual({ '#123456': 1 })
    expect(fp(emptyReason)['hex-literal']).toEqual({ '#123456': 1 })
  })

  it('3b. escape hatch CÓ lý do không rỗng → được bỏ qua', () => {
    const src = "const x = '#123456' // design-token-allow: giá trị màu đến từ API chart"
    expect(fp(src)).toEqual({})
  })

  it('giảm debt (xóa A) không tạo violation — chỉ được giảm', () => {
    const baseline = fp("a='#111111'\nb='#222222'")
    const current = fp("b='#222222'")
    expect(diffAgainstBaseline(current, baseline)).toEqual([])
  })
})

describe('exception registry', () => {
  it('exception đúng rule + pattern + reason không rỗng → bỏ qua', () => {
    const ex: Exception[] = [{ file: 'x.tsx', rule: 'hex-literal', pattern: '#FFCD00', reason: 'brand mark svg' }]
    expect(fp('fill="#FFCD00"', ex)).toEqual({})
  })

  it('exception reason RỖNG → không có tác dụng (vẫn đếm)', () => {
    const ex: Exception[] = [{ file: 'x.tsx', rule: 'hex-literal', pattern: '#FFCD00', reason: '  ' }]
    expect(fp('fill="#FFCD00"', ex)['hex-literal']).toEqual({ '#FFCD00': 1 })
  })

  it('exception sai rule → không có tác dụng', () => {
    const ex: Exception[] = [{ file: 'x.tsx', rule: 'arbitrary-radius', pattern: '#FFCD00', reason: 'x' }]
    expect(fp('fill="#FFCD00"', ex)['hex-literal']).toEqual({ '#FFCD00': 1 })
  })
})
