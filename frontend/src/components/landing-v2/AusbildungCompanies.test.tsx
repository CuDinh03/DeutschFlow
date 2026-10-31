import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AUSBILDUNG_COPY } from '@/content/ausbildung'
import { AUSBILDUNG_COMPANIES } from '@/lib/ausbildung'
import { AusbildungCompanies } from './AusbildungCompanies'

const copy = AUSBILDUNG_COPY.vi.companies

describe('AusbildungCompanies', () => {
  it('mặc định hiện mọi doanh nghiệp, mở website của doanh nghiệp ở tab mới', () => {
    render(<AusbildungCompanies copy={copy} companies={AUSBILDUNG_COMPANIES} />)
    expect(screen.getByRole('status')).toHaveTextContent(`${AUSBILDUNG_COMPANIES.length} doanh nghiệp`)

    const link = screen.getByRole('link', { name: /Deutsche Bahn/ })
    expect(link).toHaveAttribute('href', 'https://db.jobs/de-de/dein-einstieg/ausbildung')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('lọc theo ngành rồi quay lại Tất cả', () => {
    render(<AusbildungCompanies copy={copy} companies={AUSBILDUNG_COMPANIES} />)
    const filters = within(screen.getByRole('group', { name: copy.filterLabel }))
    const logistics = AUSBILDUNG_COMPANIES.filter((c) => c.workplace === 'logistik')

    fireEvent.click(filters.getByRole('button', { name: copy.groups.logistik }))

    expect(filters.getByRole('button', { name: copy.groups.logistik })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('link')).toHaveLength(logistics.length)
    expect(screen.queryByRole('link', { name: /REWE/ })).toBeNull()

    fireEvent.click(filters.getByRole('button', { name: copy.all }))
    expect(screen.getAllByRole('link')).toHaveLength(AUSBILDUNG_COMPANIES.length)
  })

  it('không có nút lọc cho ngành chưa có doanh nghiệp nào', () => {
    render(<AusbildungCompanies copy={copy} companies={AUSBILDUNG_COMPANIES} />)
    const buttons = within(screen.getByRole('group', { name: copy.filterLabel })).getAllByRole('button')
    expect(buttons).toHaveLength(1 + new Set(AUSBILDUNG_COMPANIES.map((c) => c.workplace)).size)
  })
})
