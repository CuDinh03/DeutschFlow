/**
 * Tests for the GaLanding mobile navigation (hamburger menu).
 *
 * ui-v2 primitives and next/link are mocked so the full landing renders in
 * jsdom. The mobile menu panel is asserted via its #ga-mobile-menu id because
 * the desktop nav renders the same link labels (hidden only by CSS).
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { GaLanding } from '@/components/landing-v2/GaLanding'
import landingVi from '../../../messages/v2/landing.vi.json'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/**
 * next/image phải mock ở jsdom vì ảnh chụp sản phẩm được import TĨNH (`landingShots.ts`).
 * Trong Next, import tĩnh trả về `{src, width, height}` — đó là thứ cho next/image biết tỉ lệ để
 * giữ chỗ. Vite/vitest thì trả về một CHUỖI đường dẫn, nên component thật ném lỗi
 * `Image ... is missing required "width" property` và làm đỏ cả tệp test vì một lý do không liên
 * quan đến hành vi đang kiểm. Mock thành <img> giữ nguyên `alt` — các phép đo a11y vẫn đúng.
 */
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string | { src: string }; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : src.src} alt={alt} />
  ),
}))

vi.mock('@/components/ui-v2', () => ({
  GaLogo: () => <span>myDeutschFlow</span>,
  GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  GaBtn: ({ children, className, asChild }: { children?: React.ReactNode; className?: string; asChild?: boolean }) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>
      return React.cloneElement(child, {
        className: [child.props.className, className].filter(Boolean).join(' '),
      })
    }
    return <span className={className}>{children}</span>
  },
}))

// 06/09/2026 (F-I18N-02a): landing đọc catalog v2.landing → render trong provider với bản vi
// (nguồn sự thật); LanguageToggle (VI/EN/DE) mock để không kéo router/api vào jsdom.
vi.mock('@/components/ui-v2/LanguageToggle', () => ({ LanguageToggle: () => <span data-testid="lang-toggle" /> }))

const renderLanding = () =>
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...landingVi } } as unknown as AbstractIntlMessages}>
      <GaLanding />
    </NextIntlClientProvider>,
  )

const menuPanel = () => document.getElementById('ga-mobile-menu')

describe('GaLanding — menu mobile', () => {
  it('mở và đóng menu bằng nút hamburger, đồng bộ aria-expanded', () => {
    renderLanding()

    expect(menuPanel()).toBeNull()
    const openBtn = screen.getByRole('button', { name: 'Mở menu' })
    expect(openBtn.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(openBtn)
    expect(menuPanel()).not.toBeNull()
    const closeBtn = screen.getByRole('button', { name: 'Đóng menu' })
    expect(closeBtn.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(closeBtn)
    expect(menuPanel()).toBeNull()
  })

  it('đóng menu khi chọn một liên kết điều hướng', () => {
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = menuPanel()
    expect(panel).not.toBeNull()

    fireEvent.click(within(panel as HTMLElement).getByText('Hành trình'))
    expect(menuPanel()).toBeNull()
  })

  it('menu chứa đủ liên kết điều hướng, Đăng nhập và CTA Học thử', () => {
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const panel = within(menuPanel() as HTMLElement)

    expect(panel.getByText('Phỏng vấn theo nghề')).toBeDefined()
    expect(panel.getByText('Luyện thi')).toBeDefined()
    expect(panel.getByText('Cho trung tâm')).toBeDefined()
    expect(panel.getByText('Đăng nhập')).toBeDefined()
    expect(panel.getByText('Học thử miễn phí')).toBeDefined()
  })

  it('CTA trung tâm dẫn tới route thật, không giả làm video demo', () => {
    renderLanding()

    // 19/10/2026 (đợt 1 A+B+E): khối giáo viên gộp vào S7 "Trung tâm và nhà tuyển dụng".
    // Không có nút giả làm video ("Xem demo 90 giây" đã bị gỡ từ P0.2).
    // 24/10/2026 (đợt 3a): hai nút dẫn sang trang trung tâm — form đặt lịch demo và khối giáo viên tự
    // do (trang /giao-vien-mien-phi cũ đã gộp vào đó, 301).
    expect(screen.getByRole('link', { name: /Nhận tư vấn cho trung tâm/ })).toHaveAttribute('href', '/trung-tam/#dat-lich')
    expect(screen.getByRole('link', { name: 'Gói miễn phí cho giáo viên' })).toHaveAttribute('href', '/trung-tam/#giao-vien')
    // Mục menu "Cho trung tâm" cũng sang trang riêng thay vì neo trên trang chủ.
    for (const link of screen.getAllByRole('link', { name: 'Cho trung tâm' })) {
      expect(link).toHaveAttribute('href', '/trung-tam/')
    }
    expect(screen.queryByText('Xem demo 90 giây')).not.toBeInTheDocument()
  })

  it('các control chính trên header mobile có vùng chạm tối thiểu 44px', () => {
    renderLanding()

    expect(screen.getByRole('button', { name: 'Mở menu' }).className).toContain('h-11')
    expect(screen.getByRole('link', { name: /Học thử Học thử miễn phí/ }).className).toContain('h-11')
  })

  it('không dùng số liệu hoặc lời chứng thực chưa có nguồn', () => {
    renderLanding()

    expect(screen.queryByText('92%')).not.toBeInTheDocument()
    expect(screen.queryByText('2.400+')).not.toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Thị Lan')).not.toBeInTheDocument()
  })
})

describe('GaLanding — ô "Bạn làm nghề gì?" (đợt 1 A+B+E)', () => {
  it('mặc định hiện câu hỏi thật của vị trí đầu bếp, kể cả câu mở đầu dùng chung', () => {
    renderLanding()

    expect(screen.getByText(/Nennen Sie einen HACCP-\/Hygiene-Vorfall in der Küche/)).toBeInTheDocument()
    expect(screen.getByText(/relevante Erfahrung für Koch\/Köchin/)).toBeInTheDocument()
  })

  it('tìm "kellner" (không phân biệt hoa thường) rồi chọn → hiện câu hỏi của nhân vật phục vụ', () => {
    renderLanding()

    const input = screen.getByRole('combobox', { name: 'Bạn làm nghề gì?' })
    fireEvent.change(input, { target: { value: 'kellner' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText(/Wie behandeln Sie einen unzufriedenen Gast\? STAR-Beispiel für Kellner\/in\./)).toBeInTheDocument()
  })

  it('tìm theo tiếng Việt không dấu vẫn ra ("thu ngan" → Kassierer/in)', () => {
    renderLanding()

    fireEvent.change(screen.getByRole('combobox', { name: 'Bạn làm nghề gì?' }), { target: { value: 'thu ngan' } })
    expect(screen.getByRole('option', { name: /Kassierer\/in/ })).toBeInTheDocument()
  })

  it('nghề chưa có bộ câu hỏi riêng → nói thật là dùng bộ câu hỏi chung, không bịa câu hỏi', () => {
    renderLanding()

    fireEvent.change(screen.getByRole('combobox', { name: 'Bạn làm nghề gì?' }), { target: { value: 'điều dưỡng' } })
    expect(screen.getByText('Chưa có bộ câu hỏi riêng cho “điều dưỡng”')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Luyện với bộ câu hỏi chung' })).toHaveAttribute('href', '/v2/onboarding')
  })

  it('không còn lời hứa đã gỡ ở đợt 0 (phát âm từng câu, chấm điểm tức thì, C1)', () => {
    const { container } = renderLanding()
    const text = container.textContent ?? ''

    expect(text).not.toMatch(/sửa phát âm|chấm điểm tức thì|ngay lần đầu/)
    // C1 chỉ được nhắc như yêu cầu của lộ trình du học, kèm câu nói rõ là CHƯA có lộ trình C1.
    expect(text).not.toMatch(/A1 (đến|–) C1|A1–C1/)
    expect(text).toContain('Chưa có lộ trình C1')
  })
})

describe('GaLanding — làm mới hình ảnh 19/10/2026', () => {
  it('menu có mục Về chúng tôi trỏ /about/', () => {
    renderLanding()
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    expect(within(nav).getByRole('link', { name: 'Về chúng tôi' }).getAttribute('href')).toBe('/about/')
  })

  it('dàn người phỏng vấn có nhân vật của app và hai nghề Sắp có', () => {
    renderLanding()
    const cast = document.getElementById('cast')
    expect(cast).not.toBeNull()
    for (const name of ['Klaus', 'Niklas', 'Sarah', 'Max']) {
      expect(within(cast as HTMLElement).getByText(name)).toBeTruthy()
    }
    expect(within(cast as HTMLElement).getAllByText('Sắp có')).toHaveLength(2)
    expect(within(cast as HTMLElement).getByText('Điều dưỡng')).toBeTruthy()
    expect(within(cast as HTMLElement).getByText('Xây dựng')).toBeTruthy()
  })

  it('dải người làm sản phẩm có ảnh và lối sang Về chúng tôi', () => {
    renderLanding()
    expect(screen.getByAltText('Đinh Huy Cự, người làm myDeutschFlow')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Đọc câu chuyện/ }).getAttribute('href')).toBe('/about/')
  })
})
