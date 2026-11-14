/**
 * Bộ tách phần áp phích của mẩu rao vặt (telc Lesen Teil 3): ghép lại luôn bằng chuỗi gốc, quy ước dòng,
 * dự phòng cho mẩu viết liền một đoạn, nhận ra dòng liên hệ, ký tự tiếng Đức.
 */
import { describe, expect, it } from 'vitest'
import { MAX_HEADLINE, headlineFit, joinAdParts, linkTokens, looksLikeContact, parseAdParts, sentenceStarts, type AdParts } from './adParts'

/** `[vai, chữ hiện]` của từng phần (bỏ khoảng trắng đuôi; tiêu đề bỏ cả dấu ngắt mềm). */
function view(text: string, parsed: AdParts = parseAdParts(text)): Array<[string, string]> {
  return parsed.parts.map((p) => [p.role, text.slice(p.s, p.soft ?? p.e).trimEnd()])
}

/** Mẩu thật trong đề tay (V325–V345) + vài mẩu theo quy ước dòng. */
const SAMPLES = [
  'Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause in Leipzig-Gohlis. Geduldig, seit 6 Jahren Erfahrung. 15 €/Stunde. Tel. 0176-44 22 10',
  'Zimmer in 3er-WG frei ab 1. Oktober, 18 m², 5 Minuten zur Universität, ruhige Lage. 340 € warm. Nichtraucher.',
  'Hundebetreuung: Ich gehe mit Ihrem Hund, während Sie arbeiten. Werktags 9–15 Uhr, auch mehrere Hunde. Mit Referenzen.',
  'Deutschkurs A2 in kleiner Gruppe (max. 8 Personen), Start im September, 10 Wochen, montags und mittwochs abends.',
  'Gebrauchte Schulbücher für die Klassen 7–10 günstig abzugeben. Liste per E-Mail: buecher-bremen@example.de',
  'Biete Fahrdienst zum Flughafen Bremen und Hamburg, auch nachts und am frühen Morgen. Festpreise, Tel. 0421-55 66 77.',
  'Chor „Kölsche Stimmen“ sucht Männerstimmen! Proben mittwochs 19:30 Uhr, Notenkenntnisse nicht nötig.',
  'Erfahrene Pflegekraft bietet Betreuung für Senioren am Nachmittag: Spaziergänge, Gespräche, Vorlesen.',
  'Steuererklärung zu kompliziert? Lohnsteuerhilfeverein berät Arbeitnehmer und Rentner. Termine nach Vereinbarung.',
  'Umzugshelfer gesucht: Samstag ab 10 Uhr, ca. 4 Stunden, 3. Stock ohne Aufzug. Bezahlung nach Absprache, Pizza inklusive.',
  'Gitarre lernen\nfür Anfänger jeden Alters\nUnterricht bei Ihnen zu Hause\nErste Stunde kostenlos\nTel. 0341-12 34 56',
  '  Möbel für Studenten  \n\nSofa, Bett, Schreibtisch – alles unter 50 €.\nNur Selbstabholung in Köln-Sülz.\n\nwww.moebel-koeln.example.de\n',
  'Kochkurse am Wochenende',
  'x',
  '',
  '   ',
]

describe('parseAdParts — không đổi chữ', () => {
  it.each(SAMPLES)('ghép các phần lại đúng bằng chuỗi gốc: %j', (text) => {
    const parsed = parseAdParts(text)
    expect(joinAdParts(text, parsed)).toBe(text)
    // các lát cắt liền nhau, phủ kín, không rỗng
    let at = 0
    for (const p of parsed.parts) {
      expect(p.s).toBe(at)
      expect(p.e).toBeGreaterThan(p.s)
      if (p.soft != null) {
        expect(p.soft).toBeGreaterThan(p.s)
        expect(p.soft).toBeLessThan(p.e)
      }
      at = p.e
    }
    expect(at).toBe(text.length)
    expect(parsed.parts.filter((p) => p.role === 'headline').length).toBeLessThanOrEqual(1)
    expect(parsed.parts.filter((p) => p.role === 'contact').length).toBeLessThanOrEqual(1)
  })
})

describe('parseAdParts — quy ước dòng (đề Xưởng đề sinh)', () => {
  it('dòng 1 tiêu đề, dòng 2 ngắn là dòng phụ, giữa là thân, dòng cuối có Tel. là liên hệ', () => {
    const text = 'Gitarre lernen\nfür Anfänger jeden Alters\nUnterricht bei Ihnen zu Hause\nErste Stunde kostenlos\nTel. 0341-12 34 56'
    const parsed = parseAdParts(text)
    expect(parsed.mode).toBe('lines')
    expect(view(text, parsed)).toEqual([
      ['headline', 'Gitarre lernen'],
      ['tagline', 'für Anfänger jeden Alters'],
      ['body', 'Unterricht bei Ihnen zu Hause'],
      ['body', 'Erste Stunde kostenlos'],
      ['contact', 'Tel. 0341-12 34 56'],
    ])
    expect(parsed.parts.every((p) => p.soft == null)).toBe(true)
  })

  it('dòng trống và khoảng trắng thừa thuộc về phần đứng trước; dòng cuối là địa chỉ web ⇒ liên hệ', () => {
    const text = '  Möbel für Studenten  \n\nSofa, Bett, Schreibtisch – alles unter 50 €.\nNur Selbstabholung in Köln-Sülz.\n\nwww.moebel-koeln.example.de\n'
    expect(view(text).map(([role, s]) => [role, s.trim()])).toEqual([
      ['headline', 'Möbel für Studenten'],
      ['body', 'Sofa, Bett, Schreibtisch – alles unter 50 €.'],
      ['body', 'Nur Selbstabholung in Köln-Sülz.'],
      ['contact', 'www.moebel-koeln.example.de'],
    ])
  })

  it('dòng 2 dài hoặc kết thúc bằng dấu chấm thì là thân, không phải dòng phụ; chỉ một dòng thân thì không có dòng phụ', () => {
    const long = 'Nähkurs\nDienstags von 18 bis 20 Uhr an der Volkshochschule, Raum 12.\nMaschinen vorhanden\nAnfänger willkommen'
    expect(view(long).map(([r]) => r)).toEqual(['headline', 'body', 'body', 'body'])
    const short = 'Garage zu vermieten\nNähe Universität\nTel. 0761-12 34 56'
    expect(view(short).map(([r]) => r)).toEqual(['headline', 'body', 'contact'])
  })

  it('dòng cuối không giống liên hệ thì vẫn là thân', () => {
    const text = 'Yoga am Fluss\njeden Sonntag 9 Uhr\nfür alle Niveaus\nSpende statt Gebühr'
    expect(view(text).map(([r]) => r)).toEqual(['headline', 'tagline', 'body', 'body'])
  })
})

describe('parseAdParts — dự phòng cho mẩu viết liền một đoạn (đề tay)', () => {
  it('dấu phẩy đầu tiên: tiêu đề đứng trước, dấu phẩy thành dấu ngắt mềm; câu cuối có Tel. ⇒ liên hệ', () => {
    const text = SAMPLES[0]
    const parsed = parseAdParts(text)
    expect(parsed.mode).toBe('inline')
    expect(view(text, parsed)).toEqual([
      ['headline', 'Nachhilfe Mathe'],
      ['body', 'Klasse 5–10, bei mir zu Hause in Leipzig-Gohlis.'],
      ['body', 'Geduldig, seit 6 Jahren Erfahrung.'],
      ['body', '15 €/Stunde.'],
      ['contact', 'Tel. 0176-44 22 10'],
    ])
    const head = parsed.parts[0]
    expect(text.slice(head.soft!, head.e)).toBe(', ')
  })

  it('dấu hai chấm ở lại với tiêu đề (không có dấu ngắt mềm)', () => {
    const parsed = parseAdParts(SAMPLES[2])
    expect(view(SAMPLES[2], parsed)[0]).toEqual(['headline', 'Hundebetreuung:'])
    expect(parsed.parts[0].soft).toBeUndefined()
  })

  it('"1. Oktober", "3. Stock", "ca.", "max." không ngắt câu', () => {
    expect(view(SAMPLES[1])).toEqual([
      ['headline', 'Zimmer in 3er-WG frei ab 1. Oktober'],
      ['body', '18 m², 5 Minuten zur Universität, ruhige Lage.'],
      ['body', '340 € warm.'],
      ['body', 'Nichtraucher.'],
    ])
    expect(sentenceStarts('Samstag ab 10 Uhr, ca. 4 Stunden, 3. Stock ohne Aufzug. Pizza inklusive.')).toEqual([0, 56])
    expect(view(SAMPLES[3])).toEqual([
      ['headline', 'Deutschkurs A2 in kleiner Gruppe'],
      ['body', '(max. 8 Personen), Start im September, 10 Wochen, montags und mittwochs abends.'],
    ])
  })

  it('câu hỏi / câu cảm đầu mẩu là tiêu đề, giữ dấu ? và !', () => {
    expect(view(SAMPLES[8])[0]).toEqual(['headline', 'Steuererklärung zu kompliziert?'])
    expect(view(SAMPLES[6])[0]).toEqual(['headline', 'Chor „Kölsche Stimmen“ sucht Männerstimmen!'])
  })

  it('câu cuối có e-mail: cả câu là liên hệ', () => {
    const mail = parseAdParts(SAMPLES[4])
    expect(mail.mode).toBe('plain')
    expect(view(SAMPLES[4], mail)).toEqual([
      ['body', 'Gebrauchte Schulbücher für die Klassen 7–10 günstig abzugeben.'],
      ['contact', 'Liste per E-Mail: buecher-bremen@example.de'],
    ])
  })

  it(`không có dấu ngắt trong ${MAX_HEADLINE} ký tự đầu ⇒ plain, không tiêu đề`, () => {
    const parsed = parseAdParts(SAMPLES[7])
    expect(parsed.mode).toBe('plain')
    expect(view(SAMPLES[7], parsed)).toEqual([['body', SAMPLES[7]]])
    expect(parseAdParts('Kochkurse am Wochenende')).toEqual({ mode: 'plain', parts: [{ role: 'body', s: 0, e: 23 }] })
  })

  it('chuỗi rỗng và chỉ khoảng trắng không làm hỏng', () => {
    expect(parseAdParts('')).toEqual({ mode: 'plain', parts: [] })
    expect(parseAdParts('   ')).toEqual({ mode: 'plain', parts: [{ role: 'body', s: 0, e: 3 }] })
  })
})

describe('looksLikeContact', () => {
  it.each([
    'Tel. 0176-44 22 10',
    'Telefon: 0341 / 12 34 56',
    'Handy 0151 23 45 67',
    'info@kurs.example.de',
    'www.example.de/anmeldung',
    'Anmeldung unter kochschule.example.de',
    'Rufen Sie an: 0221-30 40 50',
  ])('nhận: %s', (s) => expect(looksLikeContact(s)).toBe(true))

  it.each([
    'Werktags 9–15 Uhr.',
    '340 € warm.',
    'Ich erkläre Ihnen geduldig Handy, Tablet und E-Mail.',
    'Start am 05.10. um 18 Uhr',
    '8 Termine, samstags 9 Uhr',
  ])('không nhận: %s', (s) => expect(looksLikeContact(s)).toBe(false))
})

describe('liên hệ giữa câu cuối — không để dòng cụt treo dấu phẩy', () => {
  it('phần trước "Tel." ngắn (< 15 ký tự) hoặc cả câu cuối ngắn (≤ 48 ký tự) ⇒ cả câu là liên hệ', () => {
    expect(view(SAMPLES[5]).slice(-2)).toEqual([
      ['body', 'auch nachts und am frühen Morgen.'],
      ['contact', 'Festpreise, Tel. 0421-55 66 77.'],
    ])
    const dog = 'Kleiner Hund (Mischling, 2 Jahre) sucht neues Zuhause mit Garten. Tierschutzverein Köln, Tel. 0221-30 40 50.'
    expect(view(dog).slice(-1)).toEqual([['contact', 'Tierschutzverein Köln, Tel. 0221-30 40 50.']])
    expect(joinAdParts(dog, parseAdParts(dog))).toBe(dog)
  })

  it('câu cuối dài và phần trước "Tel." đủ dài thì vẫn tách: thân rồi liên hệ', () => {
    const text = 'Suche Wohnung, 2 Zimmer. Angebote bitte an Familie Krause in der Lindenstraße 12, Tel. 0341-12 34 56.'
    expect(view(text).slice(-2)).toEqual([
      ['body', 'Angebote bitte an Familie Krause in der Lindenstraße 12,'],
      ['contact', 'Tel. 0341-12 34 56.'],
    ])
  })
})

describe('linkTokens — điểm ngắt mềm trong e-mail / địa chỉ web, không đổi chữ', () => {
  const cut = (text: string) =>
    linkTokens(text).map((l) => {
      const at = [l.s, ...l.breaks, l.e]
      return at.slice(0, -1).map((a, i) => text.slice(a, at[i + 1]))
    })

  it('chỉ ngắt sau "@", "/" và "." (không ngắt trước đuôi tên miền); không ngắt ở gạch nối; dấu câu cuối câu không thuộc địa chỉ', () => {
    expect(cut('Liste per E-Mail: buecher-bremen@example.de')).toEqual([['buecher-bremen@', 'example.de']])
    expect(cut('Infos: www.yoga-morgen.example.de/kurse.')).toEqual([['www.', 'yoga-morgen.', 'example.de/', 'kurse']])
    expect(cut('Anmeldung unter https://kochschule.example.de, Tel. 0421-12 34 56')).toEqual([['https://', 'kochschule.', 'example.de']])
    expect(cut('Schreiben Sie an fest@stadtpark.example.de oder info@example.de!')).toEqual([
      ['fest@', 'stadtpark.', 'example.de'],
      ['info@', 'example.de'],
    ])
  })

  it('các lát ghép lại đúng bằng cụm gốc; vị trí nằm trong chuỗi gốc; chữ thường không bị coi là địa chỉ', () => {
    const text = 'Kurs ab 05.10. um 18 Uhr, z. B. montags. Mehr: sprachtreff.example.de'
    const [link] = linkTokens(text)
    expect(linkTokens(text)).toHaveLength(1)
    expect(text.slice(link.s, link.e)).toBe('sprachtreff.example.de')
    for (const b of link.breaks) {
      expect(b).toBeGreaterThan(link.s)
      expect(b).toBeLessThan(link.e)
    }
    expect(linkTokens('Zimmer frei ab 1. Oktober, 340 € warm. Tel. 0341-22 33 44')).toEqual([])
    // chỉ xét trong đoạn [from, to)
    expect(linkTokens(text, 0, 20)).toEqual([])
  })
})

describe('headlineFit — tiêu đề co cỡ chữ ở cột hẹp theo từ dài nhất', () => {
  it('từ ≤ 12 ký tự không co; từ ghép dài co theo 12 / độ dài, không dưới 0,68', () => {
    expect(headlineFit('Gitarre lernen')).toBe(1)
    expect(headlineFit('Nachmieter für 2-Zimmer-Wohnung gesucht')).toBe(1)
    expect(headlineFit('Fahrradwerkstatt mobil')).toBe(0.75) // 16 ký tự
    expect(headlineFit('Gitarrenunterricht für Anfänger')).toBe(0.68) // 18 ký tự ⇒ chạm sàn
    expect(headlineFit('Rechtsschutzversicherungsberatung')).toBe(0.68)
    // hai bên gạch nối tính riêng: trình duyệt xuống dòng được ở gạch nối
    expect(headlineFit('Englisch-Konversation für Berufstätige')).toBe(1)
    expect(headlineFit('')).toBe(1)
  })
})
