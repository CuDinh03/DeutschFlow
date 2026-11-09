import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { catalogT } from '@/test/intlCatalog'

/**
 * A7 — nút chọn đáp án dùng chung: vai trò ARIA, bàn phím, trạng thái không chỉ bằng màu, khoá sau khi trả lời.
 * Không có axe trong devDependencies (axe-core chỉ là phụ thuộc bắc cầu của eslint-plugin-jsx-a11y) nên
 * khẳng định thẳng vai trò, tên truy cập và thuộc tính ARIA.
 */
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())

import { GaChoiceGroup, choiceState, type GaChoiceGroupProps } from './GaChoiceGroup'

const OPTIONS = [
  { value: 'der', label: 'der' },
  { value: 'die', label: 'die' },
  { value: 'das', label: 'das' },
]

function Harness(props: Partial<GaChoiceGroupProps<string>> & { onPick?: (v: string) => void }) {
  const [value, setValue] = React.useState<string | null>(props.value ?? null)
  return (
    <>
      <p id="q">___ Haus</p>
      <GaChoiceGroup
        aria-labelledby="q"
        options={OPTIONS}
        {...props}
        value={value}
        onChange={(v) => {
          props.onPick?.(v)
          setValue(v)
        }}
      />
      <button type="button">sau</button>
    </>
  )
}

describe('GaChoiceGroup (A7)', () => {
  it('exposes a labelled radiogroup with radios and aria-checked', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const group = screen.getByRole('radiogroup', { name: '___ Haus' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios.forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'))

    await user.click(radios[1])
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[0]).toHaveAttribute('aria-checked', 'false')
    // Đã chọn có chữ nhìn thấy, nằm trong tên truy cập — không chỉ đổi màu.
    expect(within(radios[1]).getByText('Đã chọn')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /die.*Đã chọn/ })).toBe(radios[1])
  })

  it('uses a roving tabindex: one tab stop, on the checked radio', () => {
    render(<Harness value="das" />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, -1, 0])
  })

  it('first radio is the tab stop when nothing is chosen', () => {
    render(<Harness />)
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1, -1])
  })

  it('arrow keys move focus (wrapping, Home/End) without selecting; Space and Enter select', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(<Harness onPick={onPick} />)
    const radios = screen.getAllByRole('radio')

    await user.tab()
    expect(radios[0]).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(radios[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(radios[2]).toHaveFocus()
    await user.keyboard('{ArrowDown}') // vòng lại
    expect(radios[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radios[2]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(radios[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(radios[2]).toHaveFocus()
    // Lướt mũi tên KHÔNG chọn (trang luyện theo nhánh gửi chấm ngay khi chọn).
    expect(onPick).not.toHaveBeenCalled()
    expect(radios[2].tabIndex).toBe(0)

    await user.keyboard(' ')
    expect(onPick).toHaveBeenLastCalledWith('das')
    expect(radios[2]).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('die')
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')

    // Tab rời nhóm rồi Shift+Tab quay lại: vào đúng phương án đang chọn.
    await user.tab()
    expect(screen.getByRole('button', { name: 'sau' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(radios[1]).toHaveFocus()
  })

  it('conveys correct / wrong / correct answer with text and icon, not only colour', () => {
    render(<Harness value="die" correctValue="das" locked />)
    const [der, die, das] = screen.getAllByRole('radio')

    expect(die).toHaveAttribute('aria-checked', 'true')
    expect(die).toHaveAttribute('data-state', 'wrong')
    expect(within(die).getByText('Bạn chọn · sai')).toBeInTheDocument()
    expect(die.querySelector('svg')).not.toBeNull()

    expect(das).toHaveAttribute('data-state', 'answer')
    expect(das).toHaveAttribute('aria-checked', 'false')
    expect(within(das).getByText('Đáp án đúng')).toBeInTheDocument()
    expect(das.querySelector('svg')).not.toBeNull()

    expect(der).toHaveAttribute('data-state', 'idle')
    expect(screen.getByRole('radio', { name: 'der' })).toBe(der) // không chữ trạng thái; ô chữ cái là aria-hidden
    // Trình đọc màn hình nghe phán quyết trong tên nút.
    expect(screen.getByRole('radio', { name: /das.*Đáp án đúng/ })).toBe(das)
  })

  it('marks a correct pick as correct', () => {
    render(<Harness value="das" correctValue="das" locked />)
    const das = screen.getAllByRole('radio')[2]
    expect(das).toHaveAttribute('data-state', 'correct')
    expect(within(das).getByText('Bạn chọn · đúng')).toBeInTheDocument()
    expect(screen.queryByText('Đáp án đúng')).toBeNull()
  })

  it('uses the server verdict when only right/wrong is known', () => {
    render(<Harness value="der" verdict={false} locked />)
    expect(within(screen.getAllByRole('radio')[0]).getByText('Bạn chọn · sai')).toBeInTheDocument()
  })

  it('is locked after answering: still focusable and navigable, but clicks and keys do not change the answer', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(<Harness value="die" correctValue="die" locked onPick={onPick} />)
    const radios = screen.getAllByRole('radio')
    radios.forEach((r) => {
      expect(r).toHaveAttribute('aria-disabled', 'true')
      expect(r).not.toBeDisabled() // vẫn trong thứ tự Tab để nghe lại phán quyết
    })

    await user.click(radios[0])
    await user.tab({ shift: true })
    await user.tab()
    expect(radios[1]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(radios[2]).toHaveFocus()
    await user.keyboard(' {Enter}')

    expect(onPick).not.toHaveBeenCalled()
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[0]).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps a visible focus ring class on every option', () => {
    render(<Harness />)
    screen.getAllByRole('radio').forEach((r) => expect(r.className).toContain('focus-visible:ring-ga-focus'))
  })

  it('choiceState follows the reveal rules', () => {
    expect(choiceState('a', null, null, null)).toBe('idle')
    expect(choiceState('a', 'a', null, null)).toBe('selected')
    expect(choiceState('a', 'a', 'a', null)).toBe('correct')
    expect(choiceState('a', 'a', 'b', null)).toBe('wrong')
    expect(choiceState('b', 'a', 'b', null)).toBe('answer')
    expect(choiceState('a', 'a', null, true)).toBe('correct')
    expect(choiceState(0, 0, null, false)).toBe('wrong')
  })

  it('has SR text in vi, en and de', () => {
    for (const locale of ['vi', 'en', 'de'] as const) {
      const t = catalogT('v2.ui', locale)
      for (const key of ['choiceSelected', 'choiceCorrectPicked', 'choiceWrongPicked', 'choiceCorrectAnswer']) {
        expect(t.has(key)).toBe(true)
      }
    }
    expect(catalogT('v2.ui', 'de')('choiceCorrectAnswer')).toBe('Richtige Antwort')
  })
})
