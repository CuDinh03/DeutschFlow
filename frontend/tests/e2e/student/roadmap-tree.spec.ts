import { test, expect, type Page } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens'

/**
 * E2E: tab "Cây học tập" của /v2/student/roadmap.
 *
 * Cây đọc đúng `GET /roadmap/me` như tab "Bài học" — không có nguồn dữ liệu riêng — nên toàn bộ
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

/** Camera giờ là CSS transform (để glide được) — đọc style thay vì attribute. */
const cameraTransform = (page: Page) =>
  page.locator('svg.rt-canvas > g').first().evaluate((el) => (el as SVGGElement).style.transform)

function parseCamera(transform: string): { x: number; y: number; scale: number } {
  const t = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform)
  const s = /scale\((-?[\d.]+)\)/.exec(transform)
  return { x: t ? Number(t[1]) : 0, y: t ? Number(t[2]) : 0, scale: s ? Number(s[1]) : 1 }
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

    // Auto-focus đang nhắm node 13 — thu nhỏ về toàn cây trước thì node 30 mới nằm trong khung.
    await page.getByRole('button', { name: '⤢', exact: true }).click()
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

  // Regression QA prod 17/08: `onWheel` cũ đọc `event.currentTarget` bên trong updater setCamera —
  // React đã null hoá nó ở render phase ⇒ MỘT nấc lăn chuột sập cả trang (error boundary nuốt cây).
  test('lăn chuột trên cây: zoom tại chỗ, không sập trang', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const tree = page.getByRole('group', { name: 'Cây học tập' })
    await expect(tree).toBeVisible()
    const before = await cameraTransform(page)

    await tree.hover()
    await page.mouse.wheel(0, -240)

    // Cây còn sống (không rơi vào error boundary) và camera thực sự đã zoom.
    await expect(tree.getByRole('button')).toHaveCount(30)
    expect(await cameraTransform(page)).not.toBe(before)
  })

  // Regression QA prod 17/08: zoomBy cũ chỉ nhân scale quanh gốc (0,0) — mỗi nấc + là khung nhìn
  // trôi về góc, node đang học bay khỏi màn hình.
  test('nút + phóng quanh tâm khung nhìn, không trôi về góc', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')
    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()

    const before = parseCamera(await cameraTransform(page))
    await page.getByRole('button', { name: '+', exact: true }).click()
    const after = parseCamera(await cameraTransform(page))

    expect(after.scale).toBeCloseTo(Math.min(2.4, before.scale * 1.25), 3)
    // Neo tâm ⇒ translate phải bù theo scale, không giữ nguyên như bản lỗi.
    expect(after.x).not.toBeCloseTo(before.x, 3)
  })

  // Đợt 1 (F8): mở tab là camera tự nhắm node đang học — không còn toàn cây co nhỏ với node ~8px.
  test('mở tab: camera auto-focus node đang học, có nút ⌖ quay lại', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')
    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()

    const cam = parseCamera(await cameraTransform(page))
    expect(cam.scale).toBeGreaterThan(1)

    // Kéo cây đi chỗ khác rồi bấm ⌖ — camera phải quay về đúng chỗ auto-focus.
    const focusBtn = page.getByRole('button', { name: 'Về bài đang học' })
    await expect(focusBtn).toBeVisible()
    const tree = page.getByRole('group', { name: 'Cây học tập' })
    const box = (await tree.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 90, { steps: 4 })
    await page.mouse.up()
    expect(parseCamera(await cameraTransform(page)).x).not.toBeCloseTo(cam.x, 1)

    await focusBtn.click()
    const backCam = parseCamera(await cameraTransform(page))
    expect(backCam.x).toBeCloseTo(cam.x, 1)
    expect(backCam.y).toBeCloseTo(cam.y, 1)
  })

  // Đợt 1 (T7): URL-as-state — refresh/share giữ đúng tab + node đang chọn.
  test('deep-link ?node= chọn sẵn node, click node ghi vào URL', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap?tab=tree&node=114')

    // Panel mở đúng node 14 từ URL thay vì node đang học (13).
    await expect(page.getByText('Ngày 14 · Ngày 14')).toBeVisible()

    // Người dùng chọn node khác → URL cập nhật để share được.
    await page.getByRole('button', { name: /Ngày 12 · Ngày 12/ }).click()
    await expect(page.getByText('Ngày 12 · Ngày 12')).toBeVisible()
    expect(page.url()).toContain('node=112')
  })

  // Regression QA prod 17/08: panel cây inactive mang class `flex` đè thuộc tính `hidden` của
  // Radix ⇒ div rỗng flex-1 vẫn chiếm chỗ, tab Bài học/Giai đoạn hở ~300px trắng trên đầu.
  test('chuyển tab Bài học: panel cây ẩn hẳn, không để lại khoảng trống', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')
    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()

    await page.getByRole('tab', { name: 'Bài học' }).click()

    const gap = await page.evaluate(() => {
      const tablist = document.querySelector('[role="tablist"]')
      const panel = document.querySelector('[role="tabpanel"][data-state="active"]')
      if (!tablist || !panel) return Number.NaN
      return panel.getBoundingClientRect().top - tablist.getBoundingClientRect().bottom
    })
    expect(gap).toBeLessThan(60)
  })

  test('không tràn ngang trên màn hình điện thoại', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      return main.scrollWidth - main.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
