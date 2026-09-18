/**
 * Mỗi ngôn ngữ thuần một thứ tiếng — kiểm trên chữ THẬT render ra (owner chốt 10/09/2026).
 *
 * Bối cảnh: owner soi `/v2/student/dashboard` ở cả ba ngôn ngữ và thấy ngôn ngữ nào cũng lẫn tiếng
 * Đức. Có ba nguyên nhân chồng lên nhau, nhìn giống hệt nhau trên màn hình:
 *
 *   1. Lối "nhãn Đức + dòng nghĩa" (handoff §20) in nhãn Đức ở CẢ ba ngôn ngữ. Là thiết kế, không
 *      phải lỗi — nay owner bỏ: menu và eyebrow/CTA đọc theo đúng ngôn ngữ người dùng chọn.
 *   2. Ở bản `de`, dòng nghĩa trùng từng chữ với nhãn nên rail in "Heute / Heute", nút "Weiterlernen"
 *      đội dòng phụ "Weiter lernen". Sau (1) thì dòng nghĩa hết việc và đã gỡ hẳn.
 *   3. Tên chặng lộ trình luôn lấy `subtitle` (tiếng Việt) làm tiêu đề chính, kể cả ở `de`/`en`.
 *
 * Test dùng catalog THẬT chứ không mock trả key: (1) và (2) nằm ở chính NỘI DUNG catalog, mock trả
 * key luôn cho hai chuỗi khác nhau nên không bao giờ tái hiện được lỗi.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { GaSidebar } from '@/components/ui-v2/GaSidebar'
import { GaShellNavProvider } from '@/components/ui-v2/GaShellNav'
import { ContinueLearning } from '@/components/learning/ContinueLearning'
import { ROLE_AREAS } from '@/components/ui-v2/nav'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'
import type { UiLocale } from '@/test/intlCatalog'

/** Locale đổi được giữa các test; phải mang tiền tố `mock` để vitest cho factory tham chiếu. */
const mockState = { locale: 'de' as UiLocale }

vi.mock('next/navigation', () => ({ usePathname: () => '/v2/student/dashboard' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next-intl', async () => {
  const { catalogT, catalogMessages } = await import('@/test/intlCatalog')
  return {
    useLocale: () => mockState.locale,
    useTranslations: (namespace?: string) => catalogT(namespace, mockState.locale),
    useMessages: () => catalogMessages(mockState.locale),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})
vi.mock('@/lib/authSession', () => ({
  logout: vi.fn(),
  getOrgRole: () => 'STUDENT',
  getAccessToken: () => null,
}))
vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { displayName: 'Đinh Huy Cự', email: 'a@example.com' } }),
}))

/** Node lộ trình như `/roadmap/me` trả: `title` tiếng Đức, `subtitle` bản dịch tiếng Việt. */
const NODE = {
  id: 12,
  title: 'Familie & Freunde',
  subtitle: 'Gia đình và Bạn bè',
  cefrLevel: 'A1',
  lessonsTotal: 3,
  lessonsCompleted: 0,
} as unknown as RoadmapNode

const STUDENT_NAV = { role: 'student', rootHref: '/v2/student/dashboard', sections: [] } as never

const renderSidebar = () =>
  render(
    <GaShellNavProvider>
      <GaSidebar nav={STUDENT_NAV} />
    </GaShellNavProvider>,
  )

/** Chữ cái chỉ có trong tiếng Việt / chỉ có trong tiếng Đức — đủ để bắt chuỗi lạc ngôn ngữ. */
const VI_LETTERS = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/
const DE_LABELS = ['Heute', 'Lernen', 'Sprechen', 'Prüfung', 'Fortschritt', 'Weiterlernen']

afterEach(cleanup)

describe('locale de — chỉ tiếng Đức', () => {
  beforeEach(() => {
    mockState.locale = 'de'
  })

  it('rail area: đủ 5 area, mỗi nhãn in ĐÚNG MỘT lần', () => {
    renderSidebar()
    expect(screen.getAllByRole('link')).toHaveLength(ROLE_AREAS.student!.areas.length)
    for (const label of ['Heute', 'Lernen', 'Sprechen', 'Prüfung', 'Fortschritt']) {
      expect(screen.getAllByText(label), `"${label}" bị in hai lần`).toHaveLength(1)
    }
  })

  it('rail area: tên truy cập là chính nhãn, không đọc "Heute — Heute"', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Heute' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Heute\s+—\s+Heute/ })).toBeNull()
  })

  it('khối học tiếp: tiêu đề chặng tiếng Đức, không dòng phụ tiếng Việt', () => {
    const { container } = render(<ContinueLearning node={NODE} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Familie & Freunde')
    expect(container.textContent).not.toMatch(VI_LETTERS)
  })

  it('khối học tiếp: nút CTA không đội dòng phụ lặp lại chính nó', () => {
    render(<ContinueLearning node={NODE} />)
    expect(screen.queryByText('Weiter lernen')).toBeNull()
    // Eyebrow + nhãn nút, đều là "Weiterlernen" trong bản de.
    expect(screen.getAllByText('Weiterlernen')).toHaveLength(2)
  })
})

describe('locale vi — chỉ tiếng Việt', () => {
  beforeEach(() => {
    mockState.locale = 'vi'
  })

  it('rail area: nhãn tiếng Việt, không còn chữ Đức nào', () => {
    const { container } = renderSidebar()
    for (const label of ['Hôm nay', 'Học', 'Luyện nói', 'Luyện thi', 'Tiến bộ']) {
      expect(screen.getAllByText(label), `thiếu nhãn "${label}"`).toHaveLength(1)
    }
    for (const german of DE_LABELS) expect(container.textContent).not.toContain(german)
  })

  it('khối học tiếp: eyebrow/CTA tiếng Việt; tên chặng tiếng Việt, tiếng Đức là dòng ngữ cảnh', () => {
    render(<ContinueLearning node={NODE} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Gia đình và Bạn bè')
    // Tên chặng tiếng Đức là DỮ LIỆU bài học, vẫn giữ làm dòng ngữ cảnh — khác với nhãn giao diện.
    expect(screen.getByText('Familie & Freunde')).toBeTruthy()
    expect(screen.getByText('Đang học')).toBeTruthy()
    expect(screen.getByText('Tiếp tục học')).toBeTruthy()
    expect(screen.queryByText('Weiterlernen')).toBeNull()
  })
})

describe('locale en — chỉ tiếng Anh (tên chặng lấy bản tiếng Đức)', () => {
  beforeEach(() => {
    mockState.locale = 'en'
  })

  it('rail area: nhãn tiếng Anh, không còn chữ Đức nào', () => {
    const { container } = renderSidebar()
    for (const label of ['Today', 'Learn', 'Speaking', 'Exam prep', 'Progress']) {
      expect(screen.getAllByText(label), `thiếu nhãn "${label}"`).toHaveLength(1)
    }
    for (const german of DE_LABELS) expect(container.textContent).not.toContain(german)
  })

  it('khối học tiếp: eyebrow/CTA tiếng Anh, tên chặng tiếng Đức, KHÔNG chữ tiếng Việt', () => {
    const { container } = render(<ContinueLearning node={NODE} />)
    // Giáo trình chưa có `title_en`; owner chốt người xem EN đọc tên tiếng Đức chứ không tiếng Việt.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Familie & Freunde')
    expect(screen.getByText('Continue learning')).toBeTruthy()
    expect(container.textContent).not.toMatch(VI_LETTERS)
  })
})
