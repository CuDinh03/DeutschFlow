/**
 * Đợt 3a — form "Đặt lịch demo" của trang trung tâm. Render với catalog tiếng Việt thật (v2.landing),
 * mock lớp mạng (`submitSchoolDemoRequest`) và PostHog (`useTracking`).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import landingVi from '../../../messages/v2/landing.vi.json'

const submit = vi.fn()
vi.mock('@/lib/marketingApi', () => ({
  submitSchoolDemoRequest: (...a: unknown[]) => submit(...a),
}))
const trackEvent = vi.fn()
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent }) }))

import { SchoolDemoForm } from '@/components/landing-v2/SchoolDemoForm'

function renderForm() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
      <SchoolDemoForm />
    </NextIntlClientProvider>,
  )
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Tên của bạn/), ' Lan ')
  await user.type(screen.getByLabelText(/Trung tâm hoặc đơn vị/), 'Đức ngữ Hà Nội')
  await user.type(screen.getByLabelText(/^Nước/), 'Việt Nam')
  await user.selectOptions(screen.getByLabelText(/Số học viên đang học/), 'S20_50')
  await user.selectOptions(screen.getByLabelText(/Liên hệ qua/), 'ZALO')
  await user.type(screen.getByLabelText(/Số điện thoại/), '0912 345 678')
}

beforeEach(() => {
  submit.mockReset()
  trackEvent.mockReset()
})

describe('SchoolDemoForm', () => {
  it('thiếu ô bắt buộc → báo lỗi, không gọi mạng', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng điền đủ các ô có dấu *.')
    expect(screen.getByLabelText(/Tên của bạn/)).toHaveAttribute('aria-invalid', 'true')
    expect(submit).not.toHaveBeenCalled()
  })

  it('email sai dạng → báo lỗi liên hệ, không gọi mạng', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.selectOptions(screen.getByLabelText(/Liên hệ qua/), 'EMAIL')
    await user.clear(screen.getByLabelText(/^Email/))
    await user.type(screen.getByLabelText(/^Email/), 'khong-phai-email')

    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Email hoặc số liên hệ chưa đúng.')
    expect(submit).not.toHaveBeenCalled()
  })

  it('hợp lệ → gửi đúng dữ liệu đã trim, báo đã nhận, bắn lead_submit', async () => {
    submit.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)

    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(await screen.findByText('Đã nhận yêu cầu.')).toBeInTheDocument()
    expect(screen.getByText('Chúng tôi sẽ liên hệ qua Zalo để hẹn giờ demo.')).toBeInTheDocument()
    expect(submit).toHaveBeenCalledWith({
      name: 'Lan',
      organization: 'Đức ngữ Hà Nội',
      country: 'Việt Nam',
      studentCount: 'S20_50',
      contactChannel: 'ZALO',
      contact: '0912 345 678',
      message: undefined,
      locale: 'vi',
      website: '',
    })
    expect(trackEvent).toHaveBeenCalledWith('lead_submit', expect.objectContaining({ group: 'A', form: 'school_demo' }))
  })

  it('backend 429 → câu báo gửi quá nhiều, form vẫn còn để sửa', async () => {
    submit.mockRejectedValue({ response: { status: 429 } })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)

    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn đã gửi nhiều yêu cầu hôm nay.')
    expect(screen.getByRole('button', { name: /Gửi yêu cầu/ })).toBeEnabled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('lỗi mạng khác → câu chung kèm email hỗ trợ', async () => {
    submit.mockRejectedValue(new Error('Network Error'))
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)

    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('support@mydeutschflow.com')
  })
})
