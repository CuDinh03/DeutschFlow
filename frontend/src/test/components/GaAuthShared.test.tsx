import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { GaField, GaOtpField } from '@/app/v2/authShared'

vi.mock('next-intl', () => ({ useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/components/ui-v2', () => ({
  GaLogo: () => <span>myDeutschFlow</span>,
}))

vi.mock('@/components/ui-v2/LanguageToggle', () => ({
  LanguageToggle: () => <div>VI EN DE</div>,
}))

describe('GaField accessibility contract', () => {
  it('associates the visible label and field name with the input', () => {
    render(
      <GaField
        label="Email"
        name="email"
        type="email"
        value=""
        onChange={() => undefined}
        required
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toBeRequired()
    expect(input.id).not.toBe('')
    expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull()
  })

  it('connects hint and error copy to the input state', () => {
    const { rerender } = render(
      <GaField
        label="Mật khẩu"
        name="password"
        type="password"
        value=""
        onChange={() => undefined}
        hint="Ít nhất 8 ký tự"
      />,
    )

    let input = screen.getByLabelText('Mật khẩu')
    expect(input).toHaveAccessibleDescription('Ít nhất 8 ký tự')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('button', { name: 'field.showPassword' }).className).toContain('h-11')

    rerender(
      <GaField
        label="Mật khẩu"
        name="password"
        type="password"
        value=""
        onChange={() => undefined}
        error="Mật khẩu không hợp lệ"
      />,
    )

    input = screen.getByLabelText('Mật khẩu')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Mật khẩu không hợp lệ')
  })
})

describe('GaOtpField dán mã (09/11/2026)', () => {
  function Harness({ onComplete }: { onComplete: (v: string) => void }) {
    const [v, setV] = React.useState('')
    return <GaOtpField label="Mã" value={v} onChange={setV} onComplete={onComplete} />
  }

  it('dán "482 913" (có khoảng trắng như thư HTML) ⇒ đủ 6 số, không mất số cuối', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<Harness onComplete={onComplete} />)
    const input = screen.getByLabelText('Mã')
    await user.click(input)
    await user.paste('482 913')
    expect(input).toHaveValue('482913')
    expect(input).not.toHaveAttribute('maxlength')
    expect(onComplete).toHaveBeenCalledWith('482913')
  })
})
