import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * L3c — MỌI lối rời màn học phải về đúng nhánh cây của chính node vừa học.
 *
 * Vì sao cần cổng này: bốn lối thoát nằm rải rác trong `page.tsx` (vỏ bài học, thẻ "AI đang tạo
 * bài", và hai nút của màn tổng kết). Trước đây không ca nào phủ chúng — `SessionRecapPractice`
 * chỉ phủ phần TRÌNH BÀY của nút mời luyện, không phủ nơi nó dẫn tới. Nghiệm thu tay cũng không
 * bù được: màn tổng kết chỉ mở khi tab Phát âm đạt ≥80, tức phải thu âm bằng micro thật, nên hai
 * lối thoát của nó và đích của nút mời luyện KHÔNG kiểm được bằng tay trong một phiên tự động
 * (nghiệm thu prod 07/09/2026 dừng đúng ở đó).
 *
 * Hồi quy mà ca này bắt: đổi `roadmapHref()` mà quên một call site, hoặc trả về `/roadmap/tree`
 * kiểu v1 — trang vẫn chạy, không test nào khác đỏ, chỉ người học là rơi ra khỏi đúng nhánh cây
 * mình vừa học và phải tự dò lại từ đầu.
 */

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())

const NODE_ID = 106
/** Đích duy nhất đúng cho mọi lối thoát — mở tab cây và trỏ thẳng node vừa học. */
const NHANH_CAY = `/v2/student/roadmap?tab=tree&node=${NODE_ID}`

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ nodeId: String(NODE_ID) }),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}))

const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))

vi.mock('@/hooks/usePageTimeTracker', () => ({ usePageTimeTracker: () => {} }))
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackFeatureAction: vi.fn() }) }))
vi.mock('@/hooks/useStudentPracticeSession', () => ({
  useStudentPracticeSession: () => ({
    me: { id: 1, email: 'hocvien@example.com' },
    loading: false,
    targetLevel: 'A1',
    streakDays: 3,
  }),
}))

// Ghi hoàn thành lên máy chủ không thuộc phạm vi ca này — nhưng phải có, vì mở màn tổng kết là gọi.
vi.mock('@/lib/theoryNodeCompletion', () => ({
  completeTheoryNode: vi.fn().mockResolvedValue({ outcome: 'saved' }),
}))
vi.mock('@/lib/nodeSubmission', () => ({
  submitNodeExercises: vi.fn().mockResolvedValue({ outcome: 'saved' }),
}))

// Thân bài (5 view + phoneme coach) không liên quan tới lối thoát; thay bằng chốt rỗng cho nhẹ.
vi.mock('@/components/learn/GrammarView', () => ({ default: () => <div data-testid="than-bai" /> }))
vi.mock('@/components/learn/ReadingView', () => ({ default: () => null }))
vi.mock('@/components/learn/ListeningView', () => ({ default: () => null }))
vi.mock('@/components/learn/SpeakingView', () => ({ default: () => null }))
vi.mock('@/components/learn/WritingView', () => ({ default: () => null }))
vi.mock('@/components/learn/PhonemeCoach', () => ({ default: () => null }))

type StoreState = ReturnType<typeof khoMacDinh>
let kho: StoreState
vi.mock('@/stores/useNodeSessionStore', () => ({ useNodeSessionStore: () => kho }))

/**
 * Node LÝ THUYẾT THUẦN: chỉ có thẻ lý thuyết, không từ vựng/đọc/nghe/viết/nói.
 * `getRequiredTabs()` khi đó trả đúng một tab `grammar` ngưỡng 0, nên đánh dấu tab ấy xong là màn
 * tổng kết mở — không phải vượt cửa Phát âm ≥80 (thứ đòi micro thật, xem chú thích đầu tệp).
 */
function khoMacDinh() {
  return {
    session: {
      titleVi: 'Bảng chữ cái tiếng Đức',
      titleDe: 'Das Alphabet',
      moduleNumber: 0,
      moduleTitleVi: 'Kiến thức nền tảng',
      estimatedMinutes: 15,
      xpReward: 100,
      content: { theory_cards: [{ type: 'rule', title: 'A đến Z', body: '26 chữ cái.' }] },
    } as unknown as Record<string, unknown>,
    loading: false,
    error: null as string | null,
    activeView: 'grammar',
    setActiveView: vi.fn(),
    fetchSession: vi.fn(),
    reset: vi.fn(),
    tabCompletion: {} as Record<string, boolean>,
    tabScores: {} as Record<string, number>,
    itemAnswers: {},
    markTabCompleted: vi.fn(),
    resetTabCompletion: vi.fn(),
  }
}

/** `GET /roadmap/me` — mảng node; node kế tiếp có hay không do ca test quyết. */
function loTrinh({ coNodeKeTiep }: { coNodeKeTiep: boolean }) {
  const data = [
    { id: NODE_ID, title: 'Das Alphabet', subtitle: 'Bảng chữ cái tiếng Đức', dayNumber: 1 },
    ...(coNodeKeTiep ? [{ id: 107, title: 'Die Zahlen', subtitle: 'Số đếm', dayNumber: 2 }] : []),
  ]
  return { data }
}

/** Nghe đã 100%, ba kỹ năng còn lại chưa có session ⇒ `nextSkillToPractice` trả `lesen` (Đọc). */
const THONG_KE_LUYEN = {
  data: { sessions: [{ skill_type: 'hoeren', best_score_percent: 100, status: 'COMPLETED' }] },
}

async function moTrang({ coNodeKeTiep = false }: { coNodeKeTiep?: boolean } = {}) {
  apiGet.mockImplementation((url: string) => {
    if (url === '/roadmap/me') return Promise.resolve(loTrinh({ coNodeKeTiep }))
    if (url === `/skill-tree/${NODE_ID}/practice`) return Promise.resolve(THONG_KE_LUYEN)
    return Promise.reject(new Error(`URL ngoài dự kiến: ${url}`))
  })
  const { default: Page } = await import('@/app/v2/student/learn/[nodeId]/page')
  render(<Page />)
  await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/roadmap/me'))
}

beforeEach(() => {
  push.mockClear()
  apiGet.mockReset()
  kho = khoMacDinh()
})

describe('màn học node — bốn lối thoát về đúng nhánh cây', () => {
  it('lối 1 · nút Thoát của vỏ bài học', async () => {
    await moTrang()

    await userEvent.click(screen.getByRole('button', { name: 'Thoát' }))

    expect(push).toHaveBeenCalledWith(NHANH_CAY)
  })

  it('lối 2 · nút Quay lại Lộ trình trên thẻ "bài đang được AI tạo"', async () => {
    kho.session = null as never
    kho.error = 'chưa sinh xong'
    await moTrang()

    await userEvent.click(screen.getByRole('button', { name: /Quay lại Lộ trình/ }))

    expect(push).toHaveBeenCalledWith(NHANH_CAY)
  })

  it('lối 3 · nút Về lộ trình học của màn tổng kết', async () => {
    kho.tabCompletion = { grammar: true }
    await moTrang()

    await userEvent.click(await screen.findByRole('button', { name: 'Về lộ trình học' }))

    expect(push).toHaveBeenCalledWith(NHANH_CAY)
  })

  it('lối 4 · nút chính của màn tổng kết khi KHÔNG còn bài kế tiếp', async () => {
    kho.tabCompletion = { grammar: true }
    await moTrang({ coNodeKeTiep: false })

    await userEvent.click(await screen.findByRole('button', { name: 'Về lộ trình' }))

    expect(push).toHaveBeenCalledWith(NHANH_CAY)
  })

  it('cùng nút đó khi CÓ bài kế tiếp thì sang bài kế, không về cây', async () => {
    kho.tabCompletion = { grammar: true }
    await moTrang({ coNodeKeTiep: true })

    await userEvent.click(await screen.findByRole('button', { name: /Tiếp theo: Số đếm/ }))

    expect(push).toHaveBeenCalledWith('/v2/student/learn/107')
    expect(push).not.toHaveBeenCalledWith(NHANH_CAY)
  })
})

describe('màn học node — lời mời luyện kỹ năng còn yếu', () => {
  it('dẫn tới runner của ĐÚNG kỹ năng chưa đạt ngưỡng, không phải trang luyện chung', async () => {
    kho.tabCompletion = { grammar: true }
    await moTrang()

    // Nghe đã 100%, Đọc là kỹ năng đầu tiên chưa đạt theo thứ tự Nghe → Đọc → Nói → Viết.
    await userEvent.click(await screen.findByRole('button', { name: 'Luyện Đọc ngay' }))

    expect(push).toHaveBeenCalledWith(`/v2/student/practice/${NODE_ID}/lesen`)
  })
})

describe('màn học node — tiêu đề nêu ngày giáo trình', () => {
  it('ghép "Ngày N · <tên bài>" khi lộ trình có số ngày', async () => {
    await moTrang()

    expect(await screen.findByText('Ngày 1 · Bảng chữ cái tiếng Đức')).toBeInTheDocument()
  })
})
