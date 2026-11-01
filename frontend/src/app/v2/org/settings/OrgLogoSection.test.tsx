/**
 * Khu logo ở `/v2/org/settings` — đợt 4A A+B+E. Máy chủ mới là cổng thật; test này chốt phần báo sớm
 * (sai định dạng, quá 1 MB thì không gọi API) và đường tải lên, gỡ logo.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../OrgLicenseGate', () => ({
  OrgWriteGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const getOrgLogo = vi.fn()
const uploadOrgLogo = vi.fn()
const removeOrgLogo = vi.fn()
vi.mock('@/lib/orgApi', () => ({
  getOrgLogo: () => getOrgLogo(),
  uploadOrgLogo: (f: File) => uploadOrgLogo(f),
  removeOrgLogo: () => removeOrgLogo(),
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => String(e) }))

import { OrgLogoSection } from './OrgLogoSection'

const pick = (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('Khu logo trung tâm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrgLogo.mockResolvedValue(null)
  })

  it('tải lên PNG rồi hiện logo bằng URL máy chủ trả về', async () => {
    uploadOrgLogo.mockResolvedValue('https://r2.test/signed')
    render(<OrgLogoSection />)
    await waitFor(() => expect(getOrgLogo).toHaveBeenCalled())

    pick(new File(['x'], 'logo.png', { type: 'image/png' }))

    await waitFor(() => expect(uploadOrgLogo).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('img')?.getAttribute('src')).toBe('https://r2.test/signed'))
  })

  it('SVG và tệp quá 1 MB bị chặn trước khi gọi API', async () => {
    render(<OrgLogoSection />)
    await waitFor(() => expect(getOrgLogo).toHaveBeenCalled())

    pick(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    pick(new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2))
    expect(uploadOrgLogo).not.toHaveBeenCalled()
  })

  it('gỡ logo thì về trạng thái chưa có logo', async () => {
    getOrgLogo.mockResolvedValue('https://r2.test/signed')
    removeOrgLogo.mockResolvedValue(undefined)
    render(<OrgLogoSection />)

    const removeButton = await screen.findByRole('button', { name: /gỡ logo/i })
    fireEvent.click(removeButton)

    await waitFor(() => expect(removeOrgLogo).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('img')).toBeNull())
  })
})
