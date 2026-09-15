import { describe, expect, it } from 'vitest'
import { MENTOR_META } from '@/lib/mentorMeta'
import { catalogMessages, type UiLocale } from '@/test/intlCatalog'

/**
 * Đợt 3 audit UTF-8/i18n (06/09/2026): tagline mentor hiển thị ở onboarding đọc từ catalog
 * `v2.onboarding.mentorTaglines.<mã>` theo locale. vi PHẢI trùng nguyên văn bảng MENTOR_META
 * (nguồn chuẩn, đối chiếu catalog Java trong mentorMeta.test.ts) để người dùng VI thấy đúng chữ cũ;
 * en/de phải phủ đủ 21 mã + `fallback` — thiếu mã nào thì page rơi về tagline tiếng Việt ở locale đó.
 */
type Taglines = Record<string, string>
const taglinesOf = (locale: UiLocale): Taglines =>
  (catalogMessages(locale).v2 as { onboarding: { mentorTaglines: Taglines } }).onboarding.mentorTaglines

describe('onboarding.mentorTaglines ↔ MENTOR_META', () => {
  it('vi giữ nguyên văn tagline của MENTOR_META cho cả 21 mã + fallback', () => {
    const vi = taglinesOf('vi')
    for (const [code, meta] of Object.entries(MENTOR_META)) {
      expect(vi[code], `mentorTaglines.${code}`).toBe(meta.tagline)
    }
    expect(vi.fallback).toBe('Người đồng hành học tập')
    expect(Object.keys(vi).sort()).toEqual([...Object.keys(MENTOR_META), 'fallback'].sort())
  })

  it('en/de có đủ 21 mã + fallback, không rỗng và không còn tiếng Việt', () => {
    const viLetters = /[ăâđêôơưạảãáàấầẩẫậắằẳẵặẹẻẽéèếềểễệịỉĩíìọỏõóòốồổỗộớờởỡợụủũúùứừửữựỳỵỷỹý]/i
    for (const locale of ['en', 'de'] as const) {
      const map = taglinesOf(locale)
      for (const code of [...Object.keys(MENTOR_META), 'fallback']) {
        expect(typeof map[code] === 'string' && map[code].trim().length > 0, `${locale}: ${code} rỗng`).toBe(true)
        expect(viLetters.test(map[code]), `${locale}: ${code} còn tiếng Việt: ${map[code]}`).toBe(false)
      }
    }
  })
})
