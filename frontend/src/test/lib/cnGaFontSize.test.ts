/** cn(): cỡ chữ Galerie không bị twMerge coi là màu chữ (đợt (d) Luyện thi, 07/11/2026). */
import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn với cỡ chữ Galerie', () => {
  it('giữ cả cỡ chữ lẫn màu chữ', () => {
    expect(cn('text-ga-small font-semibold', 'text-ga-muted')).toBe('text-ga-small font-semibold text-ga-muted')
    expect(cn('text-ga-caption', 'text-ga-subtle')).toBe('text-ga-caption text-ga-subtle')
  })
  it('hai cỡ chữ thì cái sau thắng; hai màu chữ thì cái sau thắng', () => {
    expect(cn('text-ga-small', 'text-ga-body')).toBe('text-ga-body')
    expect(cn('text-ga-ink', 'text-ga-red')).toBe('text-ga-red')
  })
})
