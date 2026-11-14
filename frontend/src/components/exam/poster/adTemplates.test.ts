/** Gán khuôn áp phích: ổn định, không lặp khi số khuôn còn đủ, hợp với từng mẩu; bảng từ khoá → hình. */
import { describe, expect, it } from 'vitest'
import { parseAdParts } from './adParts'
import { POSTER_TEMPLATES, adIcon, assignTemplates, hashText, templateFits, type AdForTemplate } from './adTemplates'

function ads(texts: string[]): AdForTemplate[] {
  return texts.map((text, i) => ({ key: 'abcdefghijkl'[i], text, parsed: parseAdParts(text) }))
}

/** Mười hai mẩu của đề tay Set 1 (V328). */
const SET1 = ads([
  'Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause in Leipzig-Gohlis. Geduldig, seit 6 Jahren Erfahrung. 15 €/Stunde. Tel. 0176-44 22 10',
  'Verkaufe Kinderfahrrad, 20 Zoll, blau, kaum benutzt. 60 € VB. Abholung am Wochenende in Leipzig-Süd.',
  'Suche Mitfahrgelegenheit Leipzig–Dresden, jeden Freitag gegen 15 Uhr, zurück Sonntagabend. Teile gern die Benzinkosten.',
  'Hundebetreuung: Ich gehe mit Ihrem Hund, während Sie arbeiten. Werktags 9–15 Uhr, auch mehrere Hunde. Mit Referenzen.',
  'Zimmer in 3er-WG frei ab 1. Oktober, 18 m², 5 Minuten zur Universität, ruhige Lage. 340 € warm. Nichtraucher.',
  'Gitarrenunterricht für Anfänger, jedes Alter, bei Ihnen zu Hause oder in meinem Studio. Erste Stunde kostenlos.',
  'Umzugshelfer gesucht: Samstag ab 10 Uhr, ca. 4 Stunden, 3. Stock ohne Aufzug. Bezahlung nach Absprache, Pizza inklusive.',
  'Nähkurs für Erwachsene, dienstags 18–20 Uhr an der Volkshochschule. Maschinen vorhanden, Anfänger willkommen.',
  'Kleiner Kühlschrank zu verschenken, 85 cm hoch, funktioniert einwandfrei. Nur Selbstabholung in Leipzig-Reudnitz.',
  'Reinigungskraft für unser Büro gesucht: zweimal pro Woche abends, je 3 Stunden. Faire Bezahlung, Erfahrung erwünscht.',
  'Deutschkurs A2 in kleiner Gruppe (max. 8 Personen), Start im September, 10 Wochen, montags und mittwochs abends.',
  'Fotograf für Familienfeiern, Hochzeiten und Geburtstage, auch kurzfristig. Preise auf Anfrage, Beispiele auf meiner Webseite.',
])

describe('assignTemplates', () => {
  it('có 12 khuôn, tên không trùng', () => {
    expect(POSTER_TEMPLATES).toHaveLength(12)
    expect(new Set(POSTER_TEMPLATES).size).toBe(12)
  })

  it('ổn định: cùng bộ mẩu ⇒ cùng cách gán, mọi lần gọi', () => {
    const first = assignTemplates(SET1)
    for (let i = 0; i < 5; i++) expect(assignTemplates(ads(SET1.map((a) => a.text)))).toEqual(first)
    expect(hashText('Anzeige')).toBe(hashText('Anzeige'))
    expect(hashText('Anzeige')).not.toBe(hashText('Anzeigen'))
  })

  it('12 mẩu của một Teil dùng 12 khuôn khác nhau, khuôn nào cũng hợp với mẩu của nó', () => {
    const got = assignTemplates(SET1)
    expect(Object.keys(got)).toHaveLength(12)
    expect(new Set(Object.values(got)).size).toBe(12)
    for (const a of SET1) expect(templateFits(got[a.key], a.parsed)).toBe(true)
  })

  it('bộ mẩu khác ⇒ thứ tự khuôn khác (không phải đề nào cũng a = cùng một khuôn)', () => {
    const order = (list: AdForTemplate[]) => list.map((a) => assignTemplates(list)[a.key]).join(',')
    const variants = new Set<string>()
    for (let n = 0; n < 6; n++) variants.add(order(ads(SET1.map((a) => `${a.text} Nr. ${n}`))))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('mẩu không có tiêu đề chỉ nhận khuôn không cần tiêu đề; quá số khuôn hợp thì lặp đều', () => {
    const plain = ads(Array.from({ length: 5 }, (_, i) => `Anzeige Nummer ${i + 1} ohne Satzzeichen im Text`))
    expect(plain.every((a) => a.parsed.mode === 'plain')).toBe(true)
    const got = Object.values(assignTemplates(plain))
    expect(got.every((tpl) => ['schlicht', 'grau', 'rechts'].includes(tpl))).toBe(true)
    // 5 mẩu trên 3 khuôn: không khuôn nào dùng quá 2 lần
    for (const tpl of Array.from(new Set(got))) expect(got.filter((x) => x === tpl).length).toBeLessThanOrEqual(2)
    expect(new Set(got).size).toBe(3)
  })

  it('khuôn danh sách và dải giữa cần ít nhất hai phần thân', () => {
    const one = parseAdParts('Garage zu vermieten, Nähe Universität, ab sofort, 75 € im Monat.')
    expect(templateFits('liste', one)).toBe(false)
    expect(templateFits('band', one)).toBe(false)
    expect(templateFits('plakat', one)).toBe(true)
    expect(templateFits('liste', SET1[0].parsed)).toBe(true)
  })

  it('ít mẩu (A2: 8 mẩu) vẫn không lặp', () => {
    const got = assignTemplates(SET1.slice(0, 8))
    expect(new Set(Object.values(got)).size).toBe(8)
  })
})

describe('adIcon', () => {
  const icon = (text: string) => adIcon(text, parseAdParts(text))

  it.each([
    ['Günstige Flüge nach Wien: jetzt buchen. Reisebüro am Markt.', 'plane'],
    ['Flugreisen für Familien, auch kurzfristig. Reisebüro am Markt.', 'plane'],
    ['Verkaufe Kinderfahrrad, 20 Zoll. 60 € VB.', 'bike'],
    ['Kinderflohmarkt in der Turnhalle: Kleidung, Spielzeug. Samstag 10–14 Uhr.', 'kids'],
    ['Gitarrenunterricht für Anfänger, jedes Alter. Erste Stunde kostenlos.', 'music'],
    ['Partyservice für Feiern: warme und kalte Buffets. Lieferung im Stadtgebiet.', 'food'],
    ['Deutschkurs A2 in kleiner Gruppe, Start im September. 10 Wochen.', 'course'],
    ['Reinigungskraft für unser Büro gesucht: zweimal pro Woche. Faire Bezahlung.', 'job'],
    ['Computerhilfe für Senioren: Ich erkläre Ihnen alles. 15 € pro Stunde.', 'tech'],
    ['Zimmer in 3er-WG frei, 18 m². 340 € warm.', 'home'],
    ['Yoga am Rheinufer: jeden Sonntag 9 Uhr. Spende statt Gebühr.', 'sport'],
    ['Theatergruppe sucht Mitspieler, Proben montags. Keine Erfahrung nötig.', 'theater'],
    ['Kleiner Kühlschrank zu verschenken, 85 cm hoch. Nur Selbstabholung.', null],
    ['Steuererklärung zu kompliziert? Wir beraten Arbeitnehmer. Termine nach Vereinbarung.', null],
  ])('%s → %s', (text, want) => expect(icon(text)).toBe(want))

  it('chỉ xét tiêu đề: từ khoá trong thân không sinh hình', () => {
    expect(icon('Nachmieter gesucht, 52 m², Balkon. Haustiere und Hunde erlaubt.')).toBe('home')
    expect(icon('Biete Hilfe im Alltag: Ich koche, putze und gehe mit dem Hund. 12 € pro Stunde.')).toBeNull()
  })
})
