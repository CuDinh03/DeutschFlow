/**
 * Giới hạn lượt nghe và kịch bản hai người nói (đề telc). Cả hai phải KHÔNG đụng tới đề Goethe:
 * chuỗi thường + không khai `max_plays` = y như trước.
 */
import { describe, it, expect } from 'vitest'
import {
  isDialogueScript,
  normalizeTurns,
  scriptToPlainText,
  playsLeft,
  canPlayAgain,
} from '@/components/exam/audioScript'

describe('kịch bản phần Nghe', () => {
  it('chuỗi thường không phải hội thoại — đề Goethe đi nhánh cũ', () => {
    expect(isDialogueScript('Guten Tag.')).toBe(false)
    expect(isDialogueScript(undefined)).toBe(false)
    expect(isDialogueScript([])).toBe(false)
    expect(isDialogueScript([{ text: 'Hallo' }])).toBe(true)
  })

  it('lượt không khai vai thì luân phiên hai giọng', () => {
    expect(normalizeTurns([{ text: 'A' }, { text: 'B' }, { text: 'C' }])).toEqual([
      { speaker: 'PRUEFER', text: 'A' },
      { speaker: 'PARTNER', text: 'B' },
      { speaker: 'PRUEFER', text: 'C' },
    ])
  })

  it('vai khai tường minh được tôn trọng — một người nói hai lượt liền là chuyện thường', () => {
    expect(
      normalizeTurns([
        { speaker: 'PARTNER', text: 'A' },
        { speaker: 'PARTNER', text: 'B' },
      ]),
    ).toEqual([
      { speaker: 'PARTNER', text: 'A' },
      { speaker: 'PARTNER', text: 'B' },
    ])
  })

  it('bỏ lượt rỗng, không tạo ra khoảng lặng không ai giải thích được', () => {
    expect(normalizeTurns([{ text: '  ' }, { text: 'Hallo' }])).toEqual([{ speaker: 'PRUEFER', text: 'Hallo' }])
  })

  it('toàn văn giữ tên người nói để phần xem lại vẫn đọc được ai nói gì', () => {
    expect(scriptToPlainText([{ name: 'Herr Lang', text: 'Ja, gern.' }, { text: 'Danke.' }])).toBe(
      'Herr Lang: Ja, gern.\nDanke.',
    )
    expect(scriptToPlainText('Guten Tag.')).toBe('Guten Tag.')
  })
})

describe('ngân sách lượt nghe', () => {
  it('không khai max_plays thì không giới hạn — mọi đề Goethe giữ nguyên', () => {
    expect(playsLeft(undefined, 5)).toBeNull()
    expect(canPlayAgain(undefined, 99)).toBe(true)
  })

  it('HV Teil 1 chỉ một lượt', () => {
    expect(canPlayAgain(1, 0)).toBe(true)
    expect(playsLeft(1, 0)).toBe(1)
    expect(canPlayAgain(1, 1)).toBe(false)
    expect(playsLeft(1, 1)).toBe(0)
  })

  it('HV Teil 2 và 3 được hai lượt', () => {
    expect(canPlayAgain(2, 1)).toBe(true)
    expect(canPlayAgain(2, 2)).toBe(false)
  })

  it('giá trị vô nghĩa coi như không giới hạn, không khoá oan học viên', () => {
    expect(playsLeft(0, 3)).toBeNull()
    expect(playsLeft(-1, 3)).toBeNull()
    expect(playsLeft(Number.NaN, 3)).toBeNull()
  })

  it('dùng quá số lượt vẫn kẹp về 0, không ra số âm', () => {
    expect(playsLeft(2, 5)).toBe(0)
  })
})
