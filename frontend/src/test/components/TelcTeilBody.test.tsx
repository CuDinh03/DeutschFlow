/**
 * Bốn dạng bài telc trên màn làm bài. Ba điều phải đúng, vì sai thì học viên mất điểm mà
 * không ai thấy:
 *   1. lựa chọn đã dùng bị KHOÁ nhưng VẪN HIỆN (biến mất là mất dấu thứ tự a–l);
 *   2. đáp án `x` ("không mẩu nào hợp") không bao giờ bị khoá;
 *   3. đề thiếu kho lựa chọn thì nói thẳng, không vẽ ra một Teil không bấm được.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TelcTeilBody } from '@/components/exam/telc/TelcTeilBody'

vi.mock('next-intl', async () => {
  const { catalogT } = await import('@/test/intlCatalog')
  return { useTranslations: (ns?: string) => catalogT(ns, 'vi'), useLocale: () => 'vi' }
})

const headlineTeil = {
  teil: 1,
  type: 'MATCH_HEADLINE',
  headlines: { a: 'Mehr Fahrräder', b: 'Neues Museum', c: 'Weniger Autos' },
  items: [
    { id: 'LV1-1', question: 'Text 1', text: 'In der Stadt ...' },
    { id: 'LV1-2', question: 'Text 2', text: 'Am Wochenende ...' },
  ],
}

describe('ghép tiêu đề (MATCH_HEADLINE)', () => {
  it('in cả kho tiêu đề ở đầu Teil như đề giấy', () => {
    render(<TelcTeilBody teil={headlineTeil} answers={{}} onAnswerChange={() => {}} />)
    expect(screen.getByText('Mehr Fahrräder')).toBeInTheDocument()
    expect(screen.getByText('Neues Museum')).toBeInTheDocument()
    expect(screen.getByText('Weniger Autos')).toBeInTheDocument()
  })

  it('chữ cái câu khác đã chọn thì KHOÁ nhưng vẫn hiện', () => {
    render(<TelcTeilBody teil={headlineTeil} answers={{ 'LV1-1': 'b' }} onAnswerChange={() => {}} />)

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const câu2 = radios.filter((r) => r.getAttribute('name') === 'LV1-2')
    expect(câu2.map((r) => r.value)).toEqual(['a', 'b', 'c']) // vẫn hiện đủ, không biến mất
    expect(câu2.find((r) => r.value === 'b')?.disabled).toBe(true)
    expect(câu2.find((r) => r.value === 'a')?.disabled).toBe(false)
  })

  it('chọn chữ cái thì gửi đúng id câu và chữ cái đó lên trên', async () => {
    const onAnswerChange = vi.fn()
    render(<TelcTeilBody teil={headlineTeil} answers={{}} onAnswerChange={onAnswerChange} />)

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const target = radios.find((r) => r.getAttribute('name') === 'LV1-2' && r.value === 'c')!
    await userEvent.click(target)

    expect(onAnswerChange).toHaveBeenCalledWith('LV1-2', 'c')
  })
})

describe('ghép mẩu rao vặt có đáp án x (MATCH_AD_X)', () => {
  const adTeil = {
    teil: 3,
    type: 'MATCH_AD_X',
    ads: { a: 'Zimmer frei', b: 'Klavierunterricht' },
    items: [{ id: 'LV3-11', question: 'Situation 11' }, { id: 'LV3-12', question: 'Situation 12' }],
  }

  it('có thêm nút x ngoài các chữ cái', () => {
    render(<TelcTeilBody teil={adTeil} answers={{}} onAnswerChange={() => {}} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const câu11 = radios.filter((r) => r.getAttribute('name') === 'LV3-11')
    expect(câu11.map((r) => r.value)).toEqual(['a', 'b', 'x'])
  })

  it('x KHÔNG bị khoá dù câu khác đã chọn x — nhiều tình huống cùng có thể không hợp mẩu nào', () => {
    render(<TelcTeilBody teil={adTeil} answers={{ 'LV3-11': 'x' }} onAnswerChange={() => {}} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    const x12 = radios.find((r) => r.getAttribute('name') === 'LV3-12' && r.value === 'x')
    expect(x12?.disabled).toBe(false)
  })
})

describe('điền khuyết', () => {
  it('GAP_MC dựng văn bản có ô trống và mỗi ô một bộ a/b/c riêng', () => {
    render(
      <TelcTeilBody
        teil={{
          teil: 1,
          type: 'GAP_MC',
          gapped_text: 'Liebe Frau Weber, ich schreibe ___21___ ich krank bin.',
          items: [{ id: 'SB1-21', options: { a: 'weil', b: 'denn', c: 'obwohl' } }],
        }}
        answers={{}}
        onAnswerChange={() => {}}
      />,
    )
    expect(screen.getByText(/Liebe Frau Weber/)).toBeInTheDocument()
    expect(screen.getByText('weil')).toBeInTheDocument()
    expect(screen.getByText('obwohl')).toBeInTheDocument()
  })

  it('GAP_WORDBANK hiện TỪ đã chọn ngay trong văn bản, không hiện chữ cái máy', () => {
    render(
      <TelcTeilBody
        teil={{
          teil: 2,
          type: 'GAP_WORDBANK',
          gapped_text: 'Ich gebe Ihnen ___31___ .',
          word_bank: { a: 'Bescheid', b: 'dringend' },
          items: [{ id: 'SB2-31' }],
        }}
        answers={{ 'SB2-31': 'a' }}
        onAnswerChange={() => {}}
      />,
    )
    // "Bescheid" xuất hiện cả trong văn bản lẫn trong hộp từ.
    expect(screen.getAllByText('Bescheid').length).toBeGreaterThanOrEqual(2)
  })
})

describe('đề thiếu dữ liệu', () => {
  it('thiếu kho lựa chọn thì nói thẳng, không vẽ Teil không bấm được', () => {
    render(
      <TelcTeilBody teil={{ teil: 1, type: 'MATCH_HEADLINE', items: [{ id: 'X' }] }} answers={{}} onAnswerChange={() => {}} />,
    )
    expect(screen.getByText(/thiếu danh sách lựa chọn/)).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('Teil không phải dạng telc thì không dựng gì — nơi gọi đi nhánh cũ', () => {
    const { container } = render(
      <TelcTeilBody teil={{ teil: 1, type: 'PLAN_TOGETHER' }} answers={{}} onAnswerChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Beispiele và mẩu tin kích thích (17/09/2026)', () => {
  it('LV Teil 3 in hai Beispiele trước các câu — một ghép được, một là “không”', () => {
    render(
      <TelcTeilBody
        teil={{
          teil: 3,
          type: 'MATCH_AD_X',
          allow_none: true,
          ads: { a: 'Nachhilfe Mathe', b: 'Fotograf für Feiern' },
          examples: [
            { label: '01', situation: 'Ihre Eltern feiern goldene Hochzeit und wollen schöne Bilder.', answer: 'b' },
            { label: '02', situation: 'Ihr Nachbar sucht einen Klavierlehrer.', answer: 'x' },
          ],
          items: [{ id: 'LV3-11', question: 'Ihre Tochter braucht Hilfe in Mathe.' }],
        }}
        answers={{}}
        onAnswerChange={() => {}}
      />,
    )
    expect(screen.getByText('Ihre Eltern feiern goldene Hochzeit und wollen schöne Bilder.')).toBeInTheDocument()
    expect(screen.getByText('Ihr Nachbar sucht einen Klavierlehrer.')).toBeInTheDocument()
    // Beispiel dùng mẩu b — nhưng b KHÔNG bị khoá cho câu thật (đề thật cho dùng lại).
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.find((r) => r.getAttribute('name') === 'LV3-11' && r.value === 'b')?.disabled).toBe(false)
  })

  it('SB Teil 2 in mẩu tin mà bức thư trả lời ngay trên thư', () => {
    render(
      <TelcTeilBody
        teil={{
          teil: 2,
          type: 'GAP_WORDBANK',
          stimulus_ad: 'Ferienwohnung am See, 2 Zimmer, ab Juli frei.',
          gapped_text: 'Sehr geehrte Frau Berger, ich habe Ihre Anzeige ___31___ Wochenende gelesen.',
          word_bank: { a: 'AM', b: 'BITTE' },
          items: [{ id: 'SB2-31' }],
        }}
        answers={{}}
        onAnswerChange={() => {}}
      />,
    )
    expect(screen.getByText('Ferienwohnung am See, 2 Zimmer, ab Juli frei.')).toBeInTheDocument()
    expect(screen.getByText('Mẩu tin mà bức thư trả lời')).toBeInTheDocument()
  })
})
