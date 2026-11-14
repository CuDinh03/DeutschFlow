import { describe, expect, it } from 'vitest'
import { itemTurns, type AudioTurn } from './audioScript'
import {
  HOEREN_FEMALE_VOICES,
  HOEREN_MALE_VOICES,
  HOEREN_VOICES,
  assignHoerenVoices,
  nameGender,
  roleGender,
} from './hoerenVoices'

const isFemale = (v: string) => (HOEREN_FEMALE_VOICES as readonly string[]).includes(v)
const isMale = (v: string) => (HOEREN_MALE_VOICES as readonly string[]).includes(v)

/** Teil 1 của đề telc: năm người, nữ nam xen kẽ, mỗi câu một chuỗi „Nummer NN. …". */
const teil1 = (): AudioTurn[][] =>
  [
    { speaker: 'PRUEFER', audio_script: 'Nummer 41. Ich fahre das ganze Jahr mit dem Fahrrad ins Büro.' },
    { speaker: 'PARTNER', audio_script: 'Nummer 42. Ich arbeite in einer Bäckerei und nehme das Auto.' },
    { speaker: 'PRUEFER', audio_script: 'Nummer 43. Ich pendle jeden Tag von Augsburg nach München.' },
    { speaker: 'PARTNER', audio_script: 'Nummer 44. Ich gehe zu Fuß, meine Schule ist ganz nah.' },
    { speaker: 'PRUEFER', audio_script: 'Nummer 45. Wir fahren zu dritt mit einem Auto ins Büro.' },
  ].map((item) => itemTurns(item) ?? [])

/** Teil 2: phỏng vấn radio, người dẫn chương trình và khách. */
const teil2 = (): AudioTurn[][] => [
  [
    { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Herzlich willkommen, Herr Vogel.' },
    { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Vielen Dank für die Einladung.' },
    { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Wie kam es zu Ihrem Beruf?' },
    { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Eigentlich war es ein Zufall.' },
  ],
]

/** Teil 3: mỗi câu một câu dẫn tình huống rồi một người nói. */
const teil3 = (): AudioTurn[][] =>
  [
    { speaker: 'PRUEFER', lead_in_de: 'Sie hören eine Nachricht auf dem Anrufbeantworter.', audio_script: 'Hallo Frau Brandt, hier ist Nadine Krüger.' },
    { speaker: 'PARTNER', lead_in_de: 'Im Radio hören Sie folgenden Hinweis.', audio_script: 'Achtung Autofahrer auf der A 8.' },
    { speaker: 'PARTNER', lead_in_de: 'Sie hören eine Durchsage am Bahnhof.', audio_script: 'Der ICE nach Hamburg hat heute zwanzig Minuten Verspätung.' },
    { speaker: 'PRUEFER', lead_in_de: 'Sie hören eine Durchsage im Kaufhaus.', audio_script: 'Liebe Kundinnen und Kunden, heute im Angebot.' },
    { speaker: 'PARTNER', lead_in_de: 'Sie hören den Wetterbericht.', audio_script: 'Morgen wird es im Norden sonnig.' },
  ].map((item) => itemTurns(item) ?? [])

describe('giới tính của nhân vật', () => {
  it('theo vai: PRUEFER là nữ, PARTNER (và vai lạ) là nam', () => {
    expect(roleGender('PRUEFER')).toBe('F')
    expect(roleGender('PARTNER')).toBe('M')
    expect(roleGender('M')).toBe('M')
    expect(roleGender('F')).toBe('F')
    expect(roleGender(undefined)).toBe('M')
  })

  it('tên nói rõ giới thì nhận ra; tên riêng thì không đoán', () => {
    expect(nameGender('Frau Kessler')).toBe('F')
    expect(nameGender('Herr Vogel')).toBe('M')
    expect(nameGender('Moderatorin')).toBe('F')
    expect(nameGender('Moderator')).toBe('M')
    expect(nameGender('Sprecherin')).toBe('F')
    expect(nameGender('Sprecher')).toBe('M')
    expect(nameGender('Nadine')).toBeNull()
    expect(nameGender('Herrmann')).toBeNull()
    expect(nameGender(undefined)).toBeNull()
  })

  it('tên trái với vai thì tin tên', () => {
    const v = assignHoerenVoices([
      [
        { speaker: 'PRUEFER', name: 'Herr Albers', text: 'Guten Morgen.' },
        { speaker: 'PARTNER', name: 'Frau Kessler', text: 'Guten Morgen, Herr Albers.' },
        { speaker: 'PARTNER', name: 'Moderatorin', text: 'Willkommen im Studio.' },
        { speaker: 'PRUEFER', name: 'Sprecher', text: 'Und nun die Nachrichten.' },
      ],
    ])
    const [albers, kessler, moderatorin, sprecher] = v.segments[0].lines
    expect(isMale(albers)).toBe(true)
    expect(isFemale(kessler)).toBe(true)
    expect(isFemale(moderatorin)).toBe(true)
    expect(isMale(sprecher)).toBe(true)
  })
})

describe('assignHoerenVoices — chia giọng cho một Teil nghe', () => {
  it('Teil 1: năm người năm giọng, đúng giới, người dẫn là giọng thứ sáu', () => {
    const v = assignHoerenVoices(teil1())
    const speakers = v.segments.map((s) => s.lines[0])
    expect(speakers.map(isFemale)).toEqual([true, false, true, false, true])
    expect(new Set(speakers).size).toBe(5)
    expect(speakers).not.toContain(v.narrator)
    expect(new Set([...speakers, v.narrator])).toEqual(new Set(HOEREN_VOICES))
    // Ba nữ, hai nam ⇒ người dẫn lấy giọng nam để ba người nữ đủ ba giọng.
    expect(v.narrator).toBe('HOER_M1')
    for (const s of v.segments) expect(s.narrator).toBe(v.narrator)
  })

  it('hai người cùng giới liền nhau luôn khác giọng, kể cả khi nhiều người hơn số giọng', () => {
    const women = Array.from({ length: 7 }, (_, i): AudioTurn[] => [{ speaker: 'PRUEFER', text: `Nummer ${41 + i}. Ich erzähle etwas.` }])
    const v = assignHoerenVoices(women)
    const speakers = v.segments.map((s) => s.lines[0])
    expect(speakers.every(isFemale)).toBe(true)
    for (let i = 1; i < speakers.length; i++) expect(speakers[i]).not.toBe(speakers[i - 1])
    expect(speakers).not.toContain(v.narrator)
    // Bảy người nữ, không ai nam ⇒ người dẫn giọng nam, ba giọng nữ xoay vòng.
    expect(isMale(v.narrator)).toBe(true)
    expect(new Set(speakers).size).toBe(3)
  })

  it('Teil 2: người dẫn chương trình và khách khác giọng, giữ một giọng suốt bài; người dẫn bài không trùng ai', () => {
    const v = assignHoerenVoices(teil2())
    const [host, guest, host2, guest2] = v.segments[0].lines
    expect(isFemale(host)).toBe(true)
    expect(isMale(guest)).toBe(true)
    expect(host2).toBe(host)
    expect(guest2).toBe(guest)
    expect(host).not.toBe(guest)
    expect([host, guest]).not.toContain(v.narrator)
    // Mỗi giới một nhân vật ⇒ người dẫn giọng nữ (Seraphina), không phải giọng của Moderatorin.
    expect(v.narrator).toBe('HOER_F3')
  })

  it('phỏng vấn hai người cùng giới vẫn ra hai giọng khác nhau', () => {
    const v = assignHoerenVoices([
      [
        { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Frau Kessler, schön, dass Sie da sind.' },
        { speaker: 'PRUEFER', name: 'Frau Kessler', text: 'Danke, ich freue mich auch.' },
      ],
    ])
    const [host, guest] = v.segments[0].lines
    expect(host).not.toBe(guest)
    expect(isFemale(host) && isFemale(guest)).toBe(true)
    expect(isMale(v.narrator)).toBe(true)
  })

  it('Teil 3: câu dẫn tình huống đọc bằng giọng người dẫn, không nhân vật nào dùng giọng đó', () => {
    const v = assignHoerenVoices(teil3())
    const speakers = v.segments.map((s) => s.lines[1])
    for (const s of v.segments) expect(s.lines[0]).toBe(v.narrator)
    expect(speakers.map(isFemale)).toEqual([true, false, false, true, false])
    expect(speakers).not.toContain(v.narrator)
    // Hai nữ, ba nam ⇒ người dẫn giọng nữ; ba người nam ba giọng, hai người nữ hai giọng còn lại.
    expect(v.narrator).toBe('HOER_F3')
    expect(new Set(speakers).size).toBe(5)
  })

  it('không tên thì nhân vật là vai trong đoạn: cùng vai trong một đoạn giữ một giọng', () => {
    const v = assignHoerenVoices([
      [
        { speaker: 'PRUEFER', text: 'Guten Tag, was kann ich für Sie tun?' },
        { speaker: 'PARTNER', text: 'Ich möchte einen Termin.' },
        { speaker: 'PRUEFER', text: 'Gern, am Dienstag?' },
      ],
    ])
    const [a, b, a2] = v.segments[0].lines
    expect(a2).toBe(a)
    expect(a).not.toBe(b)
  })

  it('tất định: cùng nội dung thì cùng cách chia; đổi lời thì vẫn hợp lệ', () => {
    expect(assignHoerenVoices(teil1())).toEqual(assignHoerenVoices(teil1()))
    expect(assignHoerenVoices(teil2())).toEqual(assignHoerenVoices(teil2()))
    const starts = new Set<string>()
    for (let i = 0; i < 12; i++) {
      const v = assignHoerenVoices([[{ speaker: 'PARTNER', name: 'Herr Vogel', text: `Variante ${i}.` }, { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Danke.' }]])
      expect(v.segments[0].lines).not.toContain(v.narrator)
      starts.add(v.segments[0].lines[0])
    }
    // Điểm bắt đầu xoay vòng theo nội dung: các đề khác nhau không dính mãi một giọng.
    expect(starts.size).toBeGreaterThan(1)
  })

  it('số dòng khớp `normalizeTurns`: lượt rỗng bị bỏ; Teil không có lời thì không lỗi', () => {
    const v = assignHoerenVoices([[{ speaker: 'PRUEFER', text: '  ' }, { speaker: 'PARTNER', text: 'Hallo.' }]])
    expect(v.segments[0].lines).toHaveLength(1)
    expect(isMale(v.segments[0].lines[0])).toBe(true)
    expect(assignHoerenVoices([])).toEqual({ narrator: 'HOER_F3', segments: [] })
  })
})
