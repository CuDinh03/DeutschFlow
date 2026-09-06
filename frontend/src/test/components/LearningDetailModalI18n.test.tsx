/**
 * i18n đợt 3 (audit UTF-8/i18n 06/09/2026, F-I18N-02 nhóm b) — LearningDetailModal (admin) từng
 * ghim cứng ~74 dòng tiếng Việt: admin chọn EN/DE mở "Hồ sơ học tập" vẫn thấy tiếng Việt.
 *
 * Render với catalog THẬT locale `de` (nextIntlCatalogMock): nhãn Đức phải xuất hiện; enum quen
 * (goal/speed) dịch theo khoá, enum lạ vẫn hiện giá trị thô như trước.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LearningDetailModal from '@/components/admin/LearningDetailModal'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('de'))
// Logo framer-motion chỉ hiện lúc tải — không phải đối tượng test.
vi.mock('@/components/BauhausLogo', () => ({ CompleteBauhausLogo: () => null }))

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, put: mocks.put },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
    isAxiosErr: () => false,
  }
})

function detailWith(learningProfile: Record<string, unknown>) {
  return { learningProfile, xpGamification: {}, streak: {}, speakingAi: {}, vocabularySrs: {} }
}

function renderModal() {
  return render(<LearningDetailModal userId={7} userName="Anna" onClose={() => {}} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LearningDetailModal — catalog de', () => {
  it('tiêu đề, tab và trạng thái chưa có hồ sơ hiện tiếng Đức', async () => {
    mocks.get.mockResolvedValue({ data: detailWith({ notConfigured: true }) })
    renderModal()

    expect(screen.getByRole('heading', { name: 'Lernprofil' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'SRS-Vokabeln' })).toBeTruthy()
    expect(await screen.findByText('Diese Person hat noch kein Lernprofil eingerichtet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lernprofil anlegen' })).toBeTruthy()
  })

  it('hồ sơ đã cấu hình: enum quen dịch theo khoá, enum lạ giữ giá trị thô', async () => {
    mocks.get.mockResolvedValue({
      data: detailWith({ goalType: 'HOBBY', learningSpeed: 'FAST', currentLevel: 'A2', targetLevel: 'B1' }),
    })
    renderModal()

    expect(await screen.findByText('Lerntempo')).toBeTruthy()
    // Stat "Tempo" + hàng "Lerntempo" đều hiện FAST → "Schnell"
    expect(screen.getAllByText('Schnell')).toHaveLength(2)
    expect(screen.getByText('HOBBY')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Profil bearbeiten' })).toBeTruthy()
  })

  it('tab SRS-Vokabeln rỗng hiện chuỗi Đức', async () => {
    mocks.get.mockResolvedValue({ data: detailWith({ notConfigured: true }) })
    const user = userEvent.setup()
    renderModal()
    await screen.findByText('Diese Person hat noch kein Lernprofil eingerichtet.')

    await user.click(screen.getByRole('button', { name: 'SRS-Vokabeln' }))
    expect(screen.getByText('Noch keine SRS-Einträge.')).toBeTruthy()
  })
})
