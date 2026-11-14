import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { GuideVocabDeck } from '@/components/marketing/GuideVocabDeck'
import { GuideIndexCatalog } from '@/components/marketing/GuideIndexCatalog'
import { LegalDocGa } from '@/components/legal/LegalDocGa'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('Public v3.4 — Cẩm nang & Pháp lý (PR 4)', () => {
  it('GuideVocabDeck tô mạo từ der/die/das, lọc theo giống và bật chế độ tự nhẩm nghĩa', () => {
    const koch = GUIDE_ARTICLES[0]!
    render(<GuideVocabDeck items={koch.vocab} />)

    expect(screen.getByText('der Bon')).toBeTruthy()
    expect(screen.getByText('phiếu gọi món')).toBeTruthy()

    // Lọc chỉ danh từ giống trung (das)
    fireEvent.click(screen.getByRole('button', { name: 'das' }))
    expect(screen.getByText('das HACCP-Protokoll')).toBeTruthy()
    expect(screen.queryByText('der Bon')).toBeNull()

    // Bật chế độ tự nhẩm rồi chạm để mở nghĩa
    fireEvent.click(screen.getByRole('button', { name: /Tự nhẩm nghĩa tiếng Việt/ }))
    expect(screen.getByText(/Chạm để xem nghĩa tiếng Việt/)).toBeTruthy()
    fireEvent.click(screen.getByText('das HACCP-Protokoll'))
    expect(screen.getByText('sổ ghi kiểm soát an toàn thực phẩm')).toBeTruthy()
  })

  it('GuideIndexCatalog hiển thị bài đã xuất bản kèm số câu hỏi đã duyệt và bộ lọc nghề', () => {
    render(<GuideIndexCatalog articles={GUIDE_ARTICLES} />)
    expect(screen.getByRole('button', { name: /Tất cả/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/3 câu hỏi đã duyệt/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Phỏng vấn tiếng Đức nghề bếp/ })).toHaveAttribute(
      'href',
      '/cam-nang/phong-van-tieng-duc-nghe-bep/',
    )
  })

  it('LegalDocGa chuyển đổi ngôn ngữ văn bản VI / EN / DE mượt ngay trên trang', () => {
    window.localStorage.clear()
    render(
      <LegalDocGa
        docs={{
          vi: '# Chính sách bảo mật\nNội dung tiếng Việt.',
          en: '# Privacy Policy\nEnglish body.',
          de: '# Datenschutzerklärung\nDeutscher Inhalt.',
        }}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Chính sách bảo mật' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /English|EN/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Deutsch|DE/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeTruthy()
  })
})
