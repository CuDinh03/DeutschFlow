import {
  assignHoerenVoices, assignTeilVoices, HOEREN_NARRATOR_VOICE, nameGender, normalizeTurns, roleGender, scriptTurns, splitAnnounce,
} from '../hoerenVoices'

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

// Kết quả chuẩn lấy bằng cách chạy chính `assignHoerenVoices` + `itemTurns` của web (origin/main, 19/11/2026)
// trên cùng đầu vào. Đổi phép chia ở một bên mà quên bên kia thì các ca này đỏ.
describe('cùng đầu vào thì ra cùng giọng với web', () => {
  const teil1 = [
    'Nummer 41. Ich fahre das ganze Jahr mit dem Fahrrad ins Büro.',
    'Nummer 42. Ich arbeite in einer Bäckerei und nehme das Auto.',
    'Nummer 43. Ich pendle jeden Tag von Augsburg nach München.',
    'Nummer 44. Ich gehe zu Fuß, meine Schule ist ganz nah.',
    'Nummer 45. Wir fahren zu dritt mit einem Auto ins Büro.',
  ].map((text, i) => [{ speaker: i % 2 === 0 ? 'PRUEFER' : 'PARTNER', text }])

  it('Teil 1 telc B1: năm người năm giọng, chia ở cấp Teil', () => {
    expect(assignTeilVoices(undefined, teil1).items).toEqual([['HOER_F3'], ['HOER_M3'], ['HOER_F1'], ['HOER_M2'], ['HOER_F2']])
  })

  it('Teil 2: phỏng vấn radio', () => {
    const teil2 = [
      { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Herzlich willkommen, Herr Vogel.' },
      { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Vielen Dank für die Einladung.' },
      { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Wie kam es zu Ihrem Beruf?' },
      { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Eigentlich war es ein Zufall.' },
    ]
    expect(assignTeilVoices(teil2, [undefined, undefined]).group).toEqual(['HOER_F2', 'HOER_M3', 'HOER_F2', 'HOER_M3'])
  })

  it('Teil 3: câu dẫn là người dẫn, hai người nam liền nhau khác giọng', () => {
    const teil3 = [
      ['Sie hören eine Nachricht auf dem Anrufbeantworter.', 'PRUEFER', 'Hallo Frau Brandt, hier ist Nadine Krüger.'],
      ['Im Radio hören Sie folgenden Hinweis.', 'PARTNER', 'Achtung Autofahrer auf der A 8.'],
      ['Sie hören eine Durchsage am Bahnhof.', 'PARTNER', 'Der ICE nach Hamburg hat heute zwanzig Minuten Verspätung.'],
    ].map(([lead, speaker, text]) => [
      { speaker: 'PRUEFER', text: lead, kind: 'LEAD_IN' as const },
      { speaker, text },
    ])
    expect(assignTeilVoices(undefined, teil3).items).toEqual([
      ['HOER_M1', 'HOER_F1'],
      ['HOER_M1', 'HOER_M2'],
      ['HOER_M1', 'HOER_M3'],
    ])
  })

  it('câu không có bài nghe được bỏ qua, không làm lệch thứ tự xoay vòng', () => {
    const withGap = [teil1[0], undefined, ...teil1.slice(1)]
    expect(assignTeilVoices(undefined, withGap).items).toEqual([['HOER_F3'], undefined, ['HOER_M3'], ['HOER_F1'], ['HOER_M2'], ['HOER_F2']])
  })

  it('kịch bản chuỗi là một lượt của người dẫn (vai PRUEFER), như web', () => {
    expect(scriptTurns('Hallo.')).toEqual([{ speaker: 'PRUEFER', text: 'Hallo.' }])
  })

  it('tách „Nummer NN." cho người dẫn đọc', () => {
    expect(splitAnnounce('Nummer 41. Ich fahre Rad.')).toEqual({ announce: 'Nummer 41.', body: 'Ich fahre Rad.' })
    expect(splitAnnounce('Ich fahre Rad.')).toBeNull()
  })
})
