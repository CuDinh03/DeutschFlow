/** Gán khuôn áp phích: ổn định, không lặp khi số khuôn còn đủ, hợp với từng mẩu; bảng từ khoá → hình. */
import { describe, expect, it } from 'vitest'
import { parseAdParts } from './adParts'
import { MAX_BAND_CHARS, POSTER_TEMPLATES, adIcon, assignTemplates, bandPart, hashText, templateFits, type AdForTemplate } from './adTemplates'

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
    for (const a of SET1) expect(templateFits(got[a.key], a.parsed, a.text)).toBe(true)
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
    const garage = 'Garage zu vermieten, Nähe Universität, ab sofort, 75 € im Monat.'
    const one = parseAdParts(garage)
    expect(templateFits('liste', one, garage)).toBe(false)
    expect(templateFits('band', one, garage)).toBe(false)
    expect(templateFits('plakat', one, garage)).toBe(true)
    expect(templateFits('liste', SET1[0].parsed, SET1[0].text)).toBe(true)
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
    ['Theatergruppe sucht Mitspieler, Proben montags. Keine Erfahrung nötig.', 'theater'],
    ['Kleiner Kühlschrank zu verschenken, 85 cm hoch. Nur Selbstabholung.', null],
    ['Steuererklärung zu kompliziert? Wir beraten Arbeitnehmer. Termine nach Vereinbarung.', null],
  ])('%s → %s', (text, want) => expect(icon(text)).toBe(want))

  it('chỉ xét tiêu đề: từ khoá trong thân không sinh hình', () => {
    expect(icon('Nachmieter gesucht, 52 m², Balkon. Haustiere und Hunde erlaubt.')).toBe('home')
    expect(icon('Biete Hilfe im Alltag: Ich koche, putze und gehe mit dem Hund. 12 € pro Stunde.')).toBeNull()
  })
})

describe('khuôn band — dải tối chỉ nhận cụm ngắn', () => {
  it(`cụm vào dải (dòng phụ, không có thì phần thân đầu) dài quá ${MAX_BAND_CHARS} ký tự thì không gán band`, () => {
    const long = 'Babysitterin (Studentin, 23) hat abends und am Wochenende Zeit. Erfahrung mit Kleinkindern. Bremen-Mitte, 12 €/Std.'
    const parsedLong = parseAdParts(long)
    const band = bandPart(parsedLong)!
    expect(long.slice(band.s, band.e).trim()).toBe('(Studentin, 23) hat abends und am Wochenende Zeit.')
    expect(templateFits('band', parsedLong, long)).toBe(false)

    const short = 'Verkaufe Waschmaschine, 3 Jahre alt, sehr sparsam. 150 €. Abholung in Bremen-Walle.'
    expect(templateFits('band', parseAdParts(short), short)).toBe(true)

    const lines = 'Aushilfe gesucht\nBäckerei in der Neustadt\nsamstags 6–12 Uhr, Erfahrung nicht nötig\n13 € pro Stunde\nTel. 0421-55 66 77'
    const parsedLines = parseAdParts(lines)
    expect(lines.slice(bandPart(parsedLines)!.s, bandPart(parsedLines)!.e).trim()).toBe('Bäckerei in der Neustadt')
    expect(templateFits('band', parsedLines, lines)).toBe(true)
  })

  it('bộ mẩu không mẩu nào hợp band: không mẩu nào bị gán band; khuôn hợp vẫn được dùng đều', () => {
    const list = ads(
      Array.from({ length: 12 }, (_, i) => `Angebot ${i + 1}: Dieser erste Satz ist mit Absicht deutlich länger als vierzig Zeichen. Zweiter Satz. Dritter Satz.`),
    )
    const got = assignTemplates(list)
    expect(Object.values(got)).not.toContain('band')
    for (const a of list) expect(templateFits(got[a.key], a.parsed, a.text)).toBe(true)
    // 11 khuôn hợp cho 12 mẩu ⇒ đúng một khuôn lặp một lần
    expect(new Set(Object.values(got)).size).toBe(11)
  })

  it('chỉ một mẩu hợp band thì mẩu đó nhận band (khuôn hiếm không bị bỏ trống)', () => {
    const texts = SET1.map((a) => a.text)
    const fits = SET1.filter((a) => templateFits('band', a.parsed, a.text)).map((a) => a.key)
    expect(fits.length).toBeGreaterThan(0)
    const got = assignTemplates(ads(texts))
    expect(fits).toContain(Object.keys(got).find((k) => got[k] === 'band'))
  })
})

describe('adIcon — chỉ gán hình khi đúng nghĩa (rà lại bảng)', () => {
  const icon = (text: string) => adIcon(text, parseAdParts(text))

  it.each([
    'Yoga am Morgen\nfür alle Niveaus\nmontags 7 Uhr\nProbestunde kostenlos',
    'Tanzkurs Salsa für Paare und Singles, freitags 20 Uhr. Probestunde kostenlos.',
    'Gymnastik für Senioren: jeden Dienstag 10 Uhr im Gemeindehaus. Kostenlos.',
    'Yogakurs für Anfänger, acht Termine. Matten vorhanden.',
    'Ausflug an die Ostsee, Samstag 8 Uhr ab Hauptbahnhof. Noch Plätze frei.',
    'Beratungsstelle für Familien: dienstags ohne Termin. Kostenlos.',
    'Gartenarbeit gesucht? Wir helfen beim Rasenmähen. Faire Preise.',
    'Jetzt buchen und sparen: Busfahrten nach Prag. Abfahrt täglich.',
    'Automaten zu verkaufen, drei Stück, gebraucht. Preis nach Absprache.',
    'Umzugskartons günstig abzugeben, 50 Stück, kaum benutzt, 1 € pro Karton.',
    'Kleiner Kühlschrank zu verschenken, 85 cm hoch. Nur Selbstabholung.',
    'Wer hilft mir im Garten? Rasen mähen und Hecke schneiden. Gute Bezahlung.',
  ])('không có hình: %s', (text) => expect(icon(text)).toBeNull())

  it.each([
    ['Schwimmkurs für Erwachsene: Keine Angst mehr vor dem Wasser! 8 Termine.', 'swim'],
    ['Wanderfreunde Schwarzwald: Wir wandern jeden zweiten Sonntag. Keine Kosten.', 'hike'],
    ['Fitnessstudio sucht Trainer, auch Teilzeit. Bewerbung per E-Mail.', 'fitness'],
    ['Kleiner Hund sucht neues Zuhause mit Garten. Tierschutzverein.', 'dog'],
    ['Katze entlaufen, grau getigert. Bitte melden!', 'cat'],
    ['Verschenke Kinderbett mit Matratze, guter Zustand. Nur Abholung.', 'bed'],
    ['Sofa zu verschenken\n3-Sitzer, grau\nNur Selbstabholung\nTel. 0421-44 55 66', 'furniture'],
    ['Umzugshelfer gesucht: Samstag ab 10 Uhr. Bezahlung nach Absprache.', 'truck'],
    ['Ferienwohnung an der Nordsee, 2 Zimmer, ab 60 € pro Nacht. Hunde erlaubt.', 'home'],
    ['Auto zu verkaufen, Baujahr 2015, TÜV neu. Preis VB.', 'car'],
    ['Gebrauchte Schulbücher für die Klassen 7–10, günstig abzugeben. Liste per E-Mail.', 'book'],
    ['Aushilfe gesucht\nBäckerei in der Neustadt\nsamstags 6–12 Uhr\nTel. 0421-55 66 77', 'job'],
    ['Übungsfahrten mit erfahrenem Fahrer, auch am Wochenende. Preis nach Absprache.', 'car'],
  ])('%s → %s', (text, want) => expect(icon(text)).toBe(want))
})
