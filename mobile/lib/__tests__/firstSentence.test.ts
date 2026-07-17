import { evaluateFirstSentence, levenshtein, normalizeSpeech } from '../firstSentence'

describe('normalizeSpeech', () => {
  test('lowercases, strips punctuation and diacritics, folds ß', () => {
    expect(normalizeSpeech('Hallo, ich bin Cự!')).toBe('hallo ich bin cu')
    expect(normalizeSpeech('  Grüße   dich ')).toBe('grusse dich')
  })
})

describe('levenshtein', () => {
  test('computes edit distance', () => {
    expect(levenshtein('hallo', 'hallo')).toBe(0)
    expect(levenshtein('halo', 'hallo')).toBe(1)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('evaluateFirstSentence', () => {
  test('passes the model sentence with punctuation and casing noise', () => {
    expect(evaluateFirstSentence('Hallo, ich bin Cự!', 'Cự')).toBe('pass')
    expect(evaluateFirstSentence('hallo ich bin lan', 'Lan')).toBe('pass')
  })

  test('passes greeting + name even without "ich bin"', () => {
    expect(evaluateFirstSentence('Hallo Lan', 'Lan')).toBe('pass')
  })

  test('passes greeting + ich bin even when ASR mangles the name', () => {
    expect(evaluateFirstSentence('Hallo, ich bin Ku', 'Cự')).toBe('pass')
    expect(evaluateFirstSentence('hallo ich bin', 'Hương')).toBe('pass')
  })

  test('tolerates small ASR slips via Levenshtein leniency', () => {
    expect(evaluateFirstSentence('Halo ich bin Lan', 'Lan')).toBe('pass')
    expect(evaluateFirstSentence('hallo isch bin lan', 'Lan')).toBe('pass')
  })

  test('retries on unrelated or empty speech', () => {
    expect(evaluateFirstSentence('Guten Tag', 'Lan')).toBe('retry')
    expect(evaluateFirstSentence('', 'Lan')).toBe('retry')
    expect(evaluateFirstSentence('xin chào mọi người nhé', 'Lan')).toBe('retry')
  })

  test('greeting alone is not enough (needs intro or name)', () => {
    expect(evaluateFirstSentence('Hallo', 'Phương')).toBe('retry')
  })
})
