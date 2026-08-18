import { describe, expect, test } from 'vitest'
import { pickExplanation } from './explanation'

const full = {
  explanation_de: 'Im Text steht: um 14 Uhr.',
  explanation_en: 'The transcript says: um 14 Uhr.',
  explanation_vi: 'Trong transcript nói rõ: um 14 Uhr.',
}

describe('pickExplanation', () => {
  test('picks the explanation matching the UI locale', () => {
    expect(pickExplanation(full, 'de')).toBe(full.explanation_de)
    expect(pickExplanation(full, 'en')).toBe(full.explanation_en)
    expect(pickExplanation(full, 'vi')).toBe(full.explanation_vi)
  })

  test('legacy sessions carry only explanation_vi — every locale falls back to it', () => {
    const legacy = { explanation_vi: 'Giải thích cũ' }
    expect(pickExplanation(legacy, 'de')).toBe('Giải thích cũ')
    expect(pickExplanation(legacy, 'en')).toBe('Giải thích cũ')
    expect(pickExplanation(legacy, 'vi')).toBe('Giải thích cũ')
  })

  test('unknown locale behaves like vi', () => {
    expect(pickExplanation(full, 'fr')).toBe(full.explanation_vi)
  })

  test('blank strings are skipped, and no explanation at all returns null', () => {
    expect(pickExplanation({ explanation_de: '  ', explanation_en: 'ok' }, 'de')).toBe('ok')
    expect(pickExplanation({}, 'vi')).toBeNull()
  })
})
