/**
 * Áp phích rao vặt telc Lesen Teil 3 (14/11/2026): mười hai mẩu vẽ thành mười hai áp phích có chữ cái, chữ là chữ
 * thật đúng thứ tự, khuôn không lặp; bấm / phím vẫn gán mẩu cho tình huống đang chọn; hình minh hoạ chỉ trang trí.
 * Bút đánh dấu trong áp phích: `PassageMarksDot3.test.tsx`.
 */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { AdPoster, AdPosterSheet } from '@/components/exam/poster/AdPoster'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'

const ADS: Record<string, string> = {
  a: 'Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause in Leipzig-Gohlis. Geduldig, seit 6 Jahren Erfahrung. 15 €/Stunde. Tel. 0176-44 22 10',
  b: 'Verkaufe Kinderfahrrad, 20 Zoll, blau, kaum benutzt. 60 € VB. Abholung am Wochenende in Leipzig-Süd.',
  c: 'Suche Mitfahrgelegenheit Leipzig–Dresden, jeden Freitag gegen 15 Uhr, zurück Sonntagabend. Teile gern die Benzinkosten.',
  d: 'Hundebetreuung: Ich gehe mit Ihrem Hund, während Sie arbeiten. Werktags 9–15 Uhr, auch mehrere Hunde. Mit Referenzen.',
  e: 'Zimmer in 3er-WG frei ab 1. Oktober, 18 m², 5 Minuten zur Universität, ruhige Lage. 340 € warm. Nichtraucher.',
  f: 'Gitarrenunterricht für Anfänger, jedes Alter, bei Ihnen zu Hause oder in meinem Studio. Erste Stunde kostenlos.',
  g: 'Umzugshelfer gesucht: Samstag ab 10 Uhr, ca. 4 Stunden, 3. Stock ohne Aufzug. Bezahlung nach Absprache, Pizza inklusive.',
  h: 'Nähkurs\nfür Erwachsene\ndienstags 18–20 Uhr an der Volkshochschule\nMaschinen vorhanden, Anfänger willkommen\nTel. 0341-12 34 56',
  i: 'Kleiner Kühlschrank zu verschenken, 85 cm hoch, funktioniert einwandfrei. Nur Selbstabholung in Leipzig-Reudnitz.',
  j: 'Reinigungskraft für unser Büro gesucht: zweimal pro Woche abends, je 3 Stunden. Faire Bezahlung, Erfahrung erwünscht.',
  k: 'Deutschkurs A2 in kleiner Gruppe (max. 8 Personen), Start im September, 10 Wochen, montags und mittwochs abends.',
  l: 'Fotograf für Familienfeiern, Hochzeiten und Geburtstage, auch kurzfristig. Preise auf Anfrage, Beispiele auf meiner Webseite.',
}

const TEIL: PracticeTeilData = {
  teil: 3,
  type: 'MATCH_AD_X',
  allow_none: true,
  ads: ADS,
  items: [
    { id: 'LV3-11', question: 'Ihre Tochter braucht Hilfe in Mathe.' },
    { id: 'LV3-12', question: 'Sie möchten ein Instrument lernen.' },
  ],
}

function Harness({ teil = TEIL }: { teil?: PracticeTeilData }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const onAnswer = (id: string, v: string | null) =>
    setAnswers((prev) => {
      const next = { ...prev }
      if (v == null) delete next[id]
      else next[id] = v
      return next
    })
  return (
    <>
      <ObjectiveTeilView teil={teil} kind="match" answers={answers} onAnswer={onAnswer} result={null} wide tips={null} />
      <output data-testid="answers">{JSON.stringify(answers)}</output>
    </>
  )
}

const slot = (k: string) => document.querySelector<HTMLElement>(`[data-ad="${k}"]`)!
const poster = (k: string) => slot(k).querySelector<HTMLElement>('.ad-poster')!

describe('Lesen 3 — mẩu rao vặt vẽ thành áp phích', () => {
  it('mười hai áp phích, mỗi mẩu có chữ cái đứng trước và đúng nguyên văn chữ của mẩu', () => {
    render(<Harness />)
    // (ô "không mẩu nào" ở cột trả lời là một radiogroup cùng tên nên lấy tờ áp phích theo lớp)
    const sheet = document.querySelector<HTMLElement>('.ad-sheet')!
    expect(sheet).toHaveAttribute('role', 'radiogroup')
    expect(sheet).toHaveAccessibleName('Chọn đáp án cho câu 11')
    const radios = within(sheet).getAllByRole('radio')
    expect(radios).toHaveLength(12)
    expect(sheet.querySelectorAll('.ad-poster')).toHaveLength(12)
    Object.entries(ADS).forEach(([k, text], i) => {
      expect(radios[i]).toBe(slot(k))
      // chữ cái được đọc trước chữ của mẩu (LetterBadge tự nó aria-hidden nên có thêm chữ cái ẩn)
      expect(slot(k).textContent!.startsWith(`${k}${k}: `)).toBe(true)
      // chữ trong áp phích = chuỗi gốc, không thêm bớt đảo ký tự nào (kể cả xuống dòng của mẩu h)
      expect(poster(k).textContent).toBe(text)
      expect(poster(k)).toHaveAttribute('lang', 'de')
      // mỗi đoạn chữ mang đúng khối + vị trí ký tự trong chuỗi gốc
      for (const seg of Array.from(poster(k).querySelectorAll<HTMLElement>('[data-seg]'))) {
        expect(seg.dataset.b).toBe(`ad:${k}`)
        const s = Number(seg.dataset.s)
        expect(text.slice(s, s + seg.textContent!.length)).toBe(seg.textContent)
      }
    })
  })

  it('mười hai mẩu dùng mười hai khuôn khác nhau và giữ nguyên khi vẽ lại', () => {
    const { unmount } = render(<Harness />)
    const first = Object.keys(ADS).map((k) => poster(k).dataset.tpl)
    expect(new Set(first).size).toBe(12)
    unmount()
    render(<Harness />)
    expect(Object.keys(ADS).map((k) => poster(k).dataset.tpl)).toEqual(first)
  })

  it('tách phần không đổi chữ: tiêu đề, thân, liên hệ; dấu phẩy sau tiêu đề còn trong DOM (vẽ trong suốt)', () => {
    render(<Harness />)
    const a = poster('a')
    expect(a.dataset.mode).toBe('inline')
    expect(a.querySelector('.ad-head')).toHaveTextContent('Nachhilfe Mathe,')
    expect(a.querySelector('.ad-soft')!.textContent).toBe(', ')
    expect(a.querySelector('.ad-contact')).toHaveTextContent('Tel. 0176-44 22 10')
    expect(a.querySelectorAll('.ad-line')).toHaveLength(3)
    // mẩu theo quy ước dòng: dòng 1 tiêu đề, dòng 2 dòng phụ, dòng cuối liên hệ
    const h = poster('h')
    expect(h.dataset.mode).toBe('lines')
    expect(h.querySelector('.ad-head')).toHaveTextContent('Nähkurs')
    expect(h.querySelector('.ad-tag')).toHaveTextContent('für Erwachsene')
    expect(h.querySelector('.ad-contact')).toHaveTextContent('Tel. 0341-12 34 56')
    expect(h.querySelector('.ad-soft')).toBeNull()
  })

  it('hình minh hoạ chỉ là trang trí: aria-hidden, không phải emoji, không lẫn vào chữ', () => {
    render(<Harness />)
    const icons = document.querySelectorAll('.ad-poster svg.ad-icon')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg.classList.contains('lucide')).toBe(true)
    })
  })

  it('bấm áp phích gán mẩu cho tình huống đang chọn; mẩu đã dùng ghi "ở câu N"; "không mẩu nào" vẫn ở cột trả lời', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: /Nachhilfe Mathe/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"a"}')
    expect(slot('a')).toHaveTextContent('ở câu 11')
    expect(slot('a')).toHaveAttribute('data-used')
    // tự sang câu 12: bấm chữ trong thân áp phích cũng chọn; mẩu đang giữ có aria-checked
    await user.click(within(poster('f')).getByText(/Erste Stunde kostenlos/))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"a","LV3-12":"f"}')
    expect(slot('f')).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: /Không mẩu nào phù hợp/ }))
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"a","LV3-12":"x"}')
  })

  it('bàn phím: Enter / dấu cách trên áp phích, hoặc gõ chữ cái của mẩu', () => {
    render(<Harness />)
    expect(slot('c')).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(slot('c'), { key: 'Enter' })
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"c"}')
    fireEvent.keyDown(window, { key: 'k' })
    expect(screen.getByTestId('answers').textContent).toBe('{"LV3-11":"c","LV3-12":"k"}')
  })

  it('đang bôi đen chữ trong áp phích thì thả chuột không tính là chọn mẩu', () => {
    render(<Harness />)
    const seg = poster('b').querySelector('[data-seg]')!
    const range = document.createRange()
    range.selectNodeContents(seg)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    fireEvent.click(seg)
    expect(screen.getByTestId('answers').textContent).toBe('{}')
    window.getSelection()!.removeAllRanges()
  })
})

describe('AdPoster — dùng rời (xem trước ở Xưởng đề)', () => {
  it('không có lớp đánh dấu vẫn vẽ đủ chữ; khuôn dải giữa đặt dải lên dòng phụ / dòng thân đầu', () => {
    const text = 'Yoga am Fluss\njeden Sonntag 9 Uhr\nfür alle Niveaus\nSpende statt Gebühr'
    const { container } = render(
      <AdPosterSheet>
        <AdPoster block="ad:a" text={text} template="band" />
        <AdPoster block="ad:b" text={ADS.d} template="band" />
      </AdPosterSheet>,
    )
    const [lines, inline] = Array.from(container.querySelectorAll<HTMLElement>('.ad-poster'))
    expect(lines.textContent).toBe(text)
    expect(lines.querySelector('[data-band]')).toHaveTextContent('jeden Sonntag 9 Uhr')
    expect(inline.textContent).toBe(ADS.d)
    expect(inline.querySelector('[data-band]')).toHaveTextContent('Ich gehe mit Ihrem Hund, während Sie arbeiten.')
    expect(container.querySelectorAll('[data-band]')).toHaveLength(2)
  })
})
