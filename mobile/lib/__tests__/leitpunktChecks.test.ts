import { leitpunktStoreKey, parseChecked, toggleChecked } from '@/lib/leitpunktChecks'

describe('leitpunktChecks — ô đã viết ý', () => {
  const points = ['Grund für Ihr Schreiben', 'Ihre Berufserfahrung', 'Fragen zur Arbeitszeit']
  test('đọc bản lưu chỉ giữ ý còn trong đề; hỏng ⇒ rỗng', () => {
    expect(parseChecked(JSON.stringify(['Ihre Berufserfahrung', 'Alt', 'Ihre Berufserfahrung']), points)).toEqual(['Ihre Berufserfahrung'])
    expect(parseChecked('{', points)).toEqual([])
    expect(parseChecked(null, points)).toEqual([])
  })
  test('bật/tắt một ý', () => {
    expect(toggleChecked([], 'A')).toEqual(['A'])
    expect(toggleChecked(['A', 'B'], 'A')).toEqual(['B'])
  })
  test('khoá lưu hợp lệ cho SecureStore', () => {
    expect(leitpunktStoreKey(12, 'SCHREIBEN-1')).toBe('df_leitpunkte_12_SCHREIBEN-1')
    expect(leitpunktStoreKey(12, 'A B/1')).toMatch(/^[A-Za-z0-9._-]+$/)
  })
})
