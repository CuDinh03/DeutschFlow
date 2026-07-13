import { resolveVocabGlyph, type VocabIconKey } from '@/lib/vocabGlyph'

describe('resolveVocabGlyph — German base word', () => {
  const cases: [string, VocabIconKey][] = [
    ['Apfel', 'apple'],
    ['Haus', 'house'],
    ['Auto', 'car'],
    ['Hund', 'dog'],
    ['Katze', 'cat'],
    ['Buch', 'book'],
    ['Kaffee', 'coffee'],
    ['Krankenhaus', 'hospital'],
  ]

  test.each(cases)('%s → %s', (german, expected) => {
    expect(resolveVocabGlyph(german)?.key).toBe(expected)
  })

  test('strips a leading article (der/die/das)', () => {
    expect(resolveVocabGlyph('der Apfel')?.key).toBe('apple')
    expect(resolveVocabGlyph('die Katze')?.key).toBe('cat')
    expect(resolveVocabGlyph('das Auto')?.key).toBe('car')
  })

  test('is case-insensitive and tolerates trailing punctuation', () => {
    expect(resolveVocabGlyph('HAUS')?.key).toBe('house')
    expect(resolveVocabGlyph('Hund.')?.key).toBe('dog')
  })
})

describe('resolveVocabGlyph — Vietnamese meaning fallback', () => {
  test('resolves from meaning when the German base is unknown', () => {
    expect(resolveVocabGlyph('Erdapfel', 'quả táo')?.key).toBe('apple')
    expect(resolveVocabGlyph('Kläffer', 'con chó nhỏ')?.key).toBe('dog')
  })

  test('German exact match takes priority over the meaning fallback', () => {
    // 'Katze' resolves via DE dict even though meaning mentions "con chó".
    expect(resolveVocabGlyph('Katze', 'con chó và con mèo')?.key).toBe('cat')
  })
})

describe('resolveVocabGlyph — no forced icon', () => {
  test('abstract / function words resolve to null (no placeholder)', () => {
    expect(resolveVocabGlyph('Freiheit')).toBeNull()
    expect(resolveVocabGlyph('vielleicht')).toBeNull()
    expect(resolveVocabGlyph('obwohl', 'mặc dù')).toBeNull()
  })

  test('handles empty / null meaning without throwing', () => {
    expect(resolveVocabGlyph('xyzzy')).toBeNull()
    expect(resolveVocabGlyph('xyzzy', null)).toBeNull()
    expect(resolveVocabGlyph('xyzzy', '')).toBeNull()
  })

  // Regression: the VI fallback must not treat the Hán-Việt prefix "tiền" as
  // money — real prod seed carries "tiền tố" (grammar prefix) and alphabet
  // cards like "das Geld - tiền". Only explicit money phrases resolve.
  test('does not mis-map the "tiền" prefix to money', () => {
    expect(resolveVocabGlyph('die Vorsilbe', 'tiền tố (của động từ)')).toBeNull()
    expect(resolveVocabGlyph('G, g', 'Chữ G (Ví dụ: das Geld - tiền)')).toBeNull()
  })

  test('explicit money phrases still resolve via the meaning fallback', () => {
    expect(resolveVocabGlyph('Barzahlung', 'tiền mặt')?.key).toBe('money')
  })

  test('Tee/Saft no longer borrow the coffee/water icon (removed to avoid duplicates)', () => {
    expect(resolveVocabGlyph('Tee')).toBeNull()
    expect(resolveVocabGlyph('Saft')).toBeNull()
  })
})

describe('resolveVocabGlyph — shape', () => {
  const TINTS = new Set(['gold', 'brand', 'info', 'success', 'violet', 'teal', 'orange'])

  test('every resolved glyph carries a valid editorial tint', () => {
    for (const german of ['Apfel', 'Auto', 'Hund', 'Blume', 'Herz', 'Buch', 'Geld']) {
      const g = resolveVocabGlyph(german)
      expect(g).not.toBeNull()
      expect(TINTS.has(g!.tint)).toBe(true)
    }
  })
})
