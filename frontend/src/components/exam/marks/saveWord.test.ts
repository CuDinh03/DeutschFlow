import { describe, expect, it } from 'vitest'
import { saveableText, sentenceAround } from './saveWord'

describe('lưu từ — chữ lưu được', () => {
  it('bỏ dấu câu, ngoặc kép, số ở hai đầu', () => {
    expect(saveableText(' „Wohnung,“ ')).toBe('Wohnung')
    expect(saveableText('(nimmt\n teil).')).toBe('nimmt teil')
    expect(saveableText('E-Mail')).toBe('E-Mail')
  })

  it('từ chối rỗng, quá 5 từ, số hay ký hiệu ở giữa', () => {
    expect(saveableText(' … ')).toBeNull()
    expect(saveableText('eins zwei drei vier fünf sechs')).toBeNull()
    expect(saveableText('am 3. Mai')).toBeNull()
    expect(saveableText('Preis: hoch')).toBeNull()
  })
})

describe('lưu từ — câu chứa chữ đã chọn', () => {
  const text = 'Frau Özdemir leitet eine Agentur.\nWer zu uns kommt, fragt zuerst\nnach dem Zeitaufwand. Ein Projekt ist gut!'

  it('câu vắt qua dòng in vẫn lấy trọn, giữ dấu kết câu', () => {
    const s = text.indexOf('Zeitaufwand')
    expect(sentenceAround(text, s, s + 'Zeitaufwand'.length)).toBe('Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand.')
  })

  it('câu đầu và câu cuối khối', () => {
    expect(sentenceAround(text, 0, 4)).toBe('Frau Özdemir leitet eine Agentur.')
    const s = text.indexOf('Projekt')
    expect(sentenceAround(text, s, s + 7)).toBe('Ein Projekt ist gut!')
  })

  it('câu quá dài ⇒ cắt quanh chữ đã chọn, ≤ 500 ký tự', () => {
    const long = 'a '.repeat(400) + 'Ziel ' + 'b '.repeat(400) + '.'
    const s = long.indexOf('Ziel')
    const out = sentenceAround(long, s, s + 4)!
    expect(out.length).toBeLessThanOrEqual(500)
    expect(out).toContain('Ziel')
  })

  it('vị trí sai ⇒ null', () => {
    expect(sentenceAround(text, 5, 5)).toBeNull()
    expect(sentenceAround('', 0, 1)).toBeNull()
  })
})
