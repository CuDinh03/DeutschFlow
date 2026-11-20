import { achievementGlyph, stripEmoji } from '@/lib/achievementDisplay'
import { GLYPHS } from '@/lib/galerieGlyphs'

describe('achievementGlyph', () => {
  test.each([
    ['FIRST_SPEAK', 'noi'],
    ['SPEAK_20', 'noi'],
    ['XP_10000', 'xp'],
    ['STREAK_7', 'chuoi'],
    ['ERRORS_FIXED_50', 'sualoi'],
    ['SATELLITE_FIRST', 'hoc'],
    ['INDUSTRY_IT_PRO', 'hoc'],
    ['SOMETHING_NEW', 'hoanthanh'],
  ])('%s → %s', (code, glyph) => {
    expect(achievementGlyph(code)).toBe(glyph)
  })

  test('mã trống hoặc chữ thường vẫn ra glyph có thật', () => {
    expect(achievementGlyph(null)).toBe('hoanthanh')
    expect(achievementGlyph('streak_3')).toBe('chuoi')
    for (const code of ['FIRST_SPEAK', 'XP_100', 'STREAK_3', 'ERRORS_FIXED_10', 'INDUSTRY_X', '']) {
      expect(GLYPHS[achievementGlyph(code)]).toBeDefined()
    }
  })
})

describe('stripEmoji', () => {
  test('bỏ emoji ở cuối, đầu và giữa tên', () => {
    expect(stripEmoji('Junior IT 💻')).toBe('Junior IT')
    expect(stripEmoji('Bước vào chuyên ngành 🚀')).toBe('Bước vào chuyên ngành')
    expect(stripEmoji('🎙️ Buổi nói đầu tiên')).toBe('Buổi nói đầu tiên')
    expect(stripEmoji('Tuần 🗓️ vàng')).toBe('Tuần vàng')
  })

  test('giữ nguyên chữ tiếng Việt có dấu', () => {
    expect(stripEmoji('Huyền thoại kiên trì')).toBe('Huyền thoại kiên trì')
  })

  test('rỗng, null và chuỗi toàn emoji', () => {
    expect(stripEmoji(null)).toBe('')
    expect(stripEmoji('')).toBe('')
    expect(stripEmoji('🔥')).toBe('')
  })
})
