import { AD_STYLES, adStyleAt, splitAd } from '../adPoster'

describe('adPoster', () => {
  it('kiểu thẻ luân phiên đủ 6 kiểu', () => {
    expect(AD_STYLES).toHaveLength(6)
    expect(adStyleAt(0)).toBe('rahmen')
    expect(adStyleAt(1)).toBe('hand')
    expect(adStyleAt(6)).toBe('rahmen')
    expect(adStyleAt(-1)).toBe('pixel')
  })
  it('tách tiêu đề theo dòng đầu', () => {
    expect(splitAd('Sprachkurs Deutsch\nAbends, 2x pro Woche.')).toEqual({ headline: 'Sprachkurs Deutsch', body: 'Abends, 2x pro Woche.' })
  })
  it('tách tiêu đề theo câu đầu ngắn', () => {
    expect(splitAd('Fahrrad zu verkaufen! Fast neu, 80 Euro.')).toEqual({ headline: 'Fahrrad zu verkaufen!', body: 'Fast neu, 80 Euro.' })
  })
  it('không tách khi câu đầu quá dài hoặc chỉ có một câu', () => {
    const long = 'Wir suchen ab sofort eine freundliche Aushilfe für unser kleines Café am Markt. Tel. 0123'
    expect(splitAd(long).headline).toBeNull()
    expect(splitAd('Nur ein Satz.')).toEqual({ headline: null, body: 'Nur ein Satz.' })
  })
  it('không cắt tại chữ viết tắt', () => {
    expect(splitAd('Tel. 0176 123456, ab 18 Uhr.').headline).toBeNull()
    expect(splitAd('Praxis Dr. Müller sucht Hilfe! Ab sofort, Teilzeit.')).toEqual({
      headline: 'Praxis Dr. Müller sucht Hilfe!',
      body: 'Ab sofort, Teilzeit.',
    })
    expect(splitAd('Gesucht: Babysitter für zwei Kinder.')).toEqual({ headline: 'Gesucht:', body: 'Babysitter für zwei Kinder.' })
  })
})
