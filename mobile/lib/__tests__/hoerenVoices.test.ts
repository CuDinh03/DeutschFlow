import { assignHoerenVoices, HOEREN_NARRATOR_VOICE, nameGender, normalizeTurns, roleGender } from '../hoerenVoices'

describe('hoerenVoices (sinh đôi web)', () => {
  it('normalizeTurns bỏ lượt rỗng, luân phiên vai khi không khai', () => {
    expect(normalizeTurns([{ text: 'A' }, { text: ' ' }, { text: 'B' }, { speaker: 'PRUEFER', text: 'C' }])).toEqual([
      { speaker: 'PRUEFER', text: 'A' },
      { speaker: 'PARTNER', text: 'B' },
      { speaker: 'PRUEFER', text: 'C' },
    ])
  })
  it('giới theo tên trước, theo vai sau', () => {
    expect(nameGender('Herr Weber')).toBe('M')
    expect(nameGender('Moderatorin')).toBe('F')
    expect(nameGender('Lisa')).toBeNull()
    expect(roleGender('PRUEFER')).toBe('F')
    expect(roleGender('PARTNER')).toBe('M')
  })
  it('câu dẫn đọc bằng giọng người dẫn; người dẫn không bao giờ là nhân vật', () => {
    const [seg] = assignHoerenVoices([
      [
        { kind: 'LEAD_IN', text: 'Sie hören ein Gespräch.' },
        { speaker: 'PARTNER', name: 'Herr Weber', text: 'Guten Tag.' },
        { speaker: 'PARTNER', name: 'Herr Kurz', text: 'Hallo.' },
      ],
    ])
    expect(seg[0]).toBe(HOEREN_NARRATOR_VOICE)
    expect(seg[1]).not.toBe(HOEREN_NARRATOR_VOICE)
    expect(seg[1]).not.toBe(seg[2]) // hai người nam liền nhau khác giọng
  })
  it('cùng nhân vật cùng giọng trong một đoạn; tất định', () => {
    const turns = [
      { speaker: 'PRUEFER', name: 'Frau Lang', text: 'Wie geht es?' },
      { speaker: 'PARTNER', text: 'Gut.' },
      { speaker: 'PRUEFER', name: 'Frau Lang', text: 'Schön.' },
    ]
    const a = assignHoerenVoices([turns])[0]
    expect(a[0]).toBe(a[2])
    expect(a[0].startsWith('HOER_F')).toBe(true)
    expect(assignHoerenVoices([turns])).toEqual(assignHoerenVoices([turns]))
  })
})
