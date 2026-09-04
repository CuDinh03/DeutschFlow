import { test, expect, type Page } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens'

/**
 * E2E: cách xem "Cây" của /v2/student/roadmap.
 *
 * Sau S-03 (Wave 1) cây không còn là một trong ba tab ngang hàng: nó là representation CHÍNH của
 * Lernweg, và segmented `Cây | Danh sách` chỉ đổi cách nhìn trên cùng một dữ liệu. Mặc định phụ
 * thuộc khổ màn — desktop mở thẳng vào cây, dưới 768px mở vào danh sách (P4-D4) — nên mọi test
 * ở đây phải khai RÕ viewport thay vì dựa vào mặc định của Playwright.
 *
 * Cây đọc đúng `GET /roadmap/me` như danh sách — không có nguồn dữ liệu riêng — nên toàn bộ
 * test này mock đúng một endpoint đó và kiểm tra cây phản ánh lại nó: đủ node, đúng motif theo
 * `progressStatus`, và mỗi kỹ năng dẫn vào runner chấm điểm thật.
 */

const SKILL_COUNTS = { HOEREN: 3, SPRECHEN: 2, LESEN: 2, SCHREIBEN: 2 }

/** 30 ngày × 6 tuần: 12 ngày đã xong, ngày 13 đang học, ngày 14 đã mở, còn lại khoá. */
function a1Roadmap() {
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const progressStatus =
      day <= 12 ? 'COMPLETED' : day === 13 ? 'IN_PROGRESS' : day === 14 ? 'AVAILABLE' : 'LOCKED'
    const state =
      progressStatus === 'COMPLETED' ? 'completed' : progressStatus === 'LOCKED' ? 'locked' : 'current'
    return {
      id: 100 + day,
      code: `D${String(day).padStart(2, '0')}`,
      title: `Tag ${day}`,
      subtitle: `Ngày ${day}`,
      emoji: '📘',
      state,
      xpReward: 100,
      lessonsTotal: 3,
      lessonsCompleted: progressStatus === 'COMPLETED' ? 3 : progressStatus === 'IN_PROGRESS' ? 1 : 0,
      cefrLevel: 'A1',
      description: `Bài ngày ${day}`,
      dayNumber: day,
      weekNumber: Math.ceil(day / 5),
      progressStatus,
      skillCounts: SKILL_COUNTS,
    }
  })
}

async function mockSession(page: Page, nodes: unknown[]) {
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...studentCookies(),
  ])
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)

  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        displayName: 'Test Student',
        role: 'STUDENT',
        userId: 1,
        email: 'student@test.com',
        learningTargetLevel: 'A1',
      }),
    }),
  )
  await page.route('**/api/auth/me/plan', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }) }),
  )
  await page.route('**/api/roadmap/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nodes) }),
  )
}

test.describe('Cây học tập (/v2)', () => {
  // Khổ desktop: mặc định của segmented là "Cây" — đó chính là hợp đồng các test dưới kiểm.
  test.use({ viewport: { width: 1280, height: 720 } })

  test('mở thẳng vào cây và vẽ đủ node của lộ trình', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const tree = page.getByRole('group', { name: 'Cây học tập' })
    await expect(tree).toBeVisible()
    await expect(tree.getByRole('button')).toHaveCount(30)

    // 6 tuần → 6 nhãn cành
    await expect(page.getByText(/Tuần 1 · Ngày 1–5/)).toBeVisible()
    await expect(page.getByText(/Tuần 6 · Ngày 26–30/)).toBeVisible()
  })

  test('mở sẵn node đang học và liệt kê 4 kỹ năng có số câu', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const panel = page.getByText('Ngày 13 · Ngày 13')
    await expect(panel).toBeVisible()

    for (const [label, count] of [
      ['Nghe', 3],
      ['Đọc', 2],
      ['Nói', 2],
      ['Viết', 2],
    ] as const) {
      await expect(page.getByText(`${label}${count} câu`, { exact: false }).first()).toBeVisible()
    }

    // Mỗi kỹ năng là một lối vào runner chấm điểm thật
    const practice = page.getByRole('link', { name: /Học & Luyện/ })
    await expect(practice).toHaveCount(4)
    await expect(practice.first()).toHaveAttribute('href', /\/v2\/student\/practice\/113\/hoeren\/?$/)
  })

  test('chạm node khoá thì báo chưa mở, không mời luyện tập', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const locked = page.getByRole('button', { name: /Ngày 30 · Ngày 30 · chưa mở/ })
    await locked.click()

    await expect(page.getByText(/Node này chưa mở/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Học & Luyện/ })).toHaveCount(0)
  })

  test('node tới được bằng bàn phím', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const node = page.getByRole('button', { name: /Ngày 14 · Ngày 14/ })
    await node.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Ngày 14 · Ngày 14')).toBeVisible()
  })

  test('lộ trình ngắn vẫn dựng cây, không cần đủ 30 ngày', async ({ page }) => {
    await mockSession(page, a1Roadmap().slice(0, 7))
    await page.goto('/v2/student/roadmap')

    const tree = page.getByRole('group', { name: 'Cây học tập' })
    await expect(tree.getByRole('button')).toHaveCount(7)
    await expect(page.getByText(/Tuần 2 · Ngày 6–7/)).toBeVisible()
  })

  test('không tràn ngang trên màn hình điện thoại', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    // Dưới 768px mặc định là DANH SÁCH (P4-D4) — cây là lựa chọn chủ động của người học. Test
    // vẫn phải đo cây ở khổ này: chọn được thì cũng phải dùng được, không tràn ngang.
    await page.getByRole('tab', { name: 'Cây', exact: true }).click()

    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return main.scrollWidth - main.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
