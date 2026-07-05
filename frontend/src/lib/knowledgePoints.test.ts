import { describe, it, expect } from 'vitest'
import { parseKnowledgePoints, formatKnowledgePoints } from './knowledgePoints'

describe('parseKnowledgePoints', () => {
  it('returns [] for null / undefined / empty / whitespace', () => {
    expect(parseKnowledgePoints(null)).toEqual([])
    expect(parseKnowledgePoints(undefined)).toEqual([])
    expect(parseKnowledgePoints('')).toEqual([])
    expect(parseKnowledgePoints('   \n  \n')).toEqual([])
  })

  it('treats a legacy single-line description as one point', () => {
    expect(parseKnowledgePoints('Begrüßung')).toEqual(['Begrüßung'])
  })

  it('splits newline-separated points and trims each', () => {
    expect(parseKnowledgePoints('Từ vựng gia đình\n  Sở hữu cách  \nĐộng từ')).toEqual([
      'Từ vựng gia đình',
      'Sở hữu cách',
      'Động từ',
    ])
  })

  it('strips a leading bullet or dash so stored/edited forms are interchangeable', () => {
    expect(parseKnowledgePoints('- Point A\n• Point B\n· Point C\n* Point D')).toEqual([
      'Point A',
      'Point B',
      'Point C',
      'Point D',
    ])
  })

  it('drops blank lines between points', () => {
    expect(parseKnowledgePoints('A\n\n\nB')).toEqual(['A', 'B'])
  })
})

describe('formatKnowledgePoints', () => {
  it('joins with newlines, trimming and dropping empties', () => {
    expect(formatKnowledgePoints(['  A ', '', 'B', '   '])).toBe('A\nB')
  })

  it('returns empty string when nothing meaningful is present', () => {
    expect(formatKnowledgePoints([])).toBe('')
    expect(formatKnowledgePoints(['', '  '])).toBe('')
  })

  it('round-trips through parse without drift', () => {
    const points = ['Từ vựng gia đình', 'Sở hữu cách', 'Động từ']
    expect(parseKnowledgePoints(formatKnowledgePoints(points))).toEqual(points)
  })
})
