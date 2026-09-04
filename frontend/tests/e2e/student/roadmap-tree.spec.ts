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
      prerequisiteCode: day > 1 ? `D${String(day - 1).padStart(2, '0')}` : null,
    }
  })
}

// Mock `GET /skill-tree/{nodeId}/practice` (Đợt 2) — row SQL snake_case như backend trả.
// Đăng ký SAU `mockSession` để thắng route api chung (route đăng ký sau khớp trước).
async function mockPracticeOverview(
  page: Page,
  nodeId: number,
  sessions: Record<string, unknown>[],
) {
  await page.route(new RegExp(`/api/skill-tree/${nodeId}/practice$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nodeTitle: `Tag ${nodeId - 100}`, sessions }),
    }),
  )
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

    // B-04: MỘT CTA chính (Học) + 4 hàng kỹ năng là hành động phụ — mỗi hàng là một link trọn
    // hàng vào runner chấm điểm thật. Đếm TRONG landmark panel (trang còn CTA luyện khác ở hero),
    // match bằng href để không gãy khi đổi chữ.
    const sidePanel = page.getByRole('complementary', { name: 'Chi tiết node' })
    await expect(sidePanel.getByRole('link', { name: 'Học kiến thức' })).toHaveAttribute(
      'href',
      /\/v2\/student\/learn\/113\/?$/,
    )
    const practice = sidePanel.locator('a[href*="/v2/student/practice/113/"]')
    await expect(practice).toHaveCount(4)
    await expect(practice.first()).toHaveAttribute('href', /\/v2\/student\/practice\/113\/hoeren\/?$/)
    await expect(practice.first()).toContainText('Nghe')
  })

  // Đợt 2 (N7): node khoá không nói suông "chưa mở" — nó kể node nào đang chặn và dẫn tới đó.
  test('chạm node khoá thì nêu điều kiện mở + link tới bài đang chặn, không mời luyện tập', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    // Auto-focus đang nhắm node 13 — thu nhỏ về toàn cây trước thì node 30 mới nằm trong khung.
    await page.getByRole('button', { name: '⤢', exact: true }).click()
    const locked = page.getByRole('button', { name: /Ngày 30 · Ngày 30 · chưa mở/ })
    await locked.click()

    await expect(page.getByText(/Xong Ngày 29 · Ngày 29 thì nụ này nở/)).toBeVisible()
    // Node khoá không mời gọi gì TRONG panel: 0 link luyện VÀ 0 CTA học (B-04 giữ hành vi cũ).
    const sidePanel = page.getByRole('complementary', { name: 'Chi tiết node' })
    await expect(sidePanel.locator('a[href*="/v2/student/practice/"]')).toHaveCount(0)
    await expect(sidePanel.getByRole('link', { name: 'Học kiến thức' })).toHaveCount(0)

    // "Tới bài đang chặn" nhảy panel sang node 29 và ghi URL để share được.
    await page.getByRole('button', { name: 'Tới bài đang chặn' }).click()
    await expect(page.getByText('Ngày 29 · Ngày 29')).toBeVisible()
    expect(page.url()).toContain('node=129')
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

  // Regression QA prod 17/08 (gốc: panel Radix inactive vẫn chiếm chỗ). S-03 đổi sang segmented
  // Cây|Danh sách và panel cây UNMOUNT hẳn khi rời — phép đo mới: rời cây thì group biến mất
  // khỏi DOM, danh sách hiện ngay, không còn vùng trắng vì không còn panel rỗng nào tồn tại.
  test('chuyển sang Danh sách: panel cây gỡ hẳn khỏi DOM, danh sách hiện ngay', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')
    await expect(page.getByRole('group', { name: 'Cây học tập' })).toBeVisible()

    await page.getByRole('tab', { name: 'Danh sách' }).click()

    await expect(page.getByRole('group', { name: 'Cây học tập' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'true')
  })

  // Đợt 1 (T5): lựa chọn tắt hiệu ứng phải sống qua lần vào sau.
  test('nút tắt hiệu ứng nhớ qua reload', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')
    await page.getByRole('button', { name: 'Tắt hiệu ứng' }).click()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Bật hiệu ứng' })).toBeVisible()
  })

  // Đợt 2 (N1): hero CTA "Học tiếp" — 1 click từ đầu tab cây vào runner của node đang học.
  test('hero CTA Học tiếp dẫn vào runner của node đang học, kỹ năng đầu khi chưa có điểm', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await page.goto('/v2/student/roadmap')

    const cta = page.getByRole('link', { name: /Học tiếp: Ngày 13 · Nghe/ })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/v2\/student\/practice\/113\/hoeren\/?$/)
  })

  // Đợt 2 (N1+N2): có điểm luyện tập thì CTA nhắm kỹ năng còn thiếu, panel khoe điểm tốt nhất,
  // và cánh hoa của kỹ năng đã đạt tô màu kỹ năng đó.
  test('điểm luyện tập đổ vào CTA, panel và cánh hoa', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await mockPracticeOverview(page, 113, [
      { skill_type: 'HOEREN', status: 'COMPLETED', score_percent: 85, best_score_percent: 85 },
      { skill_type: 'LESEN', status: 'ACTIVE', score_percent: null, best_score_percent: 40 },
    ])
    await page.goto('/v2/student/roadmap')

    // Nghe đã đạt 85% ⇒ kỹ năng còn thiếu kế tiếp là Đọc.
    const cta = page.getByRole('link', { name: /Học tiếp: Ngày 13 · Đọc/ })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/v2\/student\/practice\/113\/lesen\/?$/)

    // Panel node đang chọn (mặc định node 13) khoe điểm tốt nhất từng kỹ năng.
    await expect(page.getByText('tốt nhất 85%')).toBeVisible()
    await expect(page.getByText('tốt nhất 40%')).toBeVisible()
    await expect(page.getByText(/1\/4 kỹ năng đạt từ 70% trở lên/)).toBeVisible()

    // Cánh hoa: kỹ năng đã đạt tô màu (Nghe 85% ≥ 70), kỹ năng chưa đạt giữ ngà (Đọc 40% < 70).
    // Assert qua data-attr thay vì màu fill — bộ botanical v2 tô cánh bằng gradient path.
    await expect(
      page.locator('svg.rt-canvas [data-skill-petal="hoeren"][data-mastered="true"]'),
    ).toHaveCount(1)
    await expect(
      page.locator('svg.rt-canvas [data-skill-petal="lesen"][data-mastered="false"]'),
    ).toHaveCount(1)
    await expect(
      page.locator('svg.rt-canvas [data-skill-petal="sprechen"][data-mastered="false"]'),
    ).toHaveCount(1)
  })

  // ── L3a — Nghi thức trở về: `?feiern=<skill>` đọc MỘT lần, đối chiếu điểm vừa tải rồi diễn bậc ──
  test('feiern bậc 1: cánh vừa đạt bung màu, param bị xoá khỏi URL, cây về tĩnh trong 3s', async ({ page }) => {
    await mockSession(page, a1Roadmap())
    await mockPracticeOverview(page, 113, [
      { skill_type: 'HOEREN', status: 'COMPLETED', score_percent: 85, best_score_percent: 85 },
    ])
    await page.goto('/v2/student/roadmap?tab=tree&node=113&feiern=hoeren')

    const gaining = page.locator('svg.rt-canvas [data-skill-petal="hoeren"][data-ritual="rt-rit-petal-gain"]')
    await expect(gaining).toHaveCount(1)
    await expect(page.locator('svg.rt-canvas [data-skill-petal="hoeren"][data-mastered="true"]')).toHaveCount(1)
    // Param nghi thức là một lần — refresh không diễn lại.
    await expect.poll(() => page.evaluate(() => window.location.search)).not.toContain('feiern')
    expect(await page.evaluate(() => window.location.search)).toContain('node=113')
    // Xong ≤2,5s thì gỡ class, cây trở về tĩnh lặng.
    await expect(gaining).toHaveCount(0, { timeout: 4000 })
  })

  test('feiern bậc 3: node cuối tuần hoá lá → hoa khép, lá mở, nụ kế nở, tuần khép tán, camera lướt sang', async ({ page }) => {
    // Ngày 15 (cuối tuần 3) vừa xong; backend đã đóng node và mở ngày 16 thành hoa.
    const nodes = a1Roadmap().map((n) => {
      const day = n.dayNumber
      const progressStatus =
        day <= 15 ? 'COMPLETED' : day === 16 ? 'IN_PROGRESS' : day === 17 ? 'AVAILABLE' : 'LOCKED'
      return { ...n, progressStatus, state: progressStatus === 'COMPLETED' ? 'completed' : progressStatus === 'LOCKED' ? 'locked' : 'current' }
    })
    await mockSession(page, nodes)
    await mockPracticeOverview(page, 115, ['HOEREN', 'LESEN', 'SPRECHEN', 'SCHREIBEN'].map((skill_type) => ({
      skill_type, status: 'COMPLETED', score_percent: 90, best_score_percent: 90,
    })))
    await mockPracticeOverview(page, 116, [])
    await page.goto('/v2/student/roadmap?tab=tree&node=115&feiern=schreiben')

    const tree = page.locator('svg.rt-canvas')
    await expect(tree.locator('[data-ritual="flower-out"]')).toHaveCount(1)
    await expect(tree.locator('[data-ritual="leaf-in"]')).toHaveCount(1)
    await expect(tree.locator('[data-ritual="bud-out"]')).toHaveCount(1)
    await expect(tree.locator('[data-ritual="flower-in"]')).toHaveCount(1)
    await expect(tree.locator('[data-ritual="week-close"]')).toHaveCount(1)
    // Nhãn tuần đã xong chuyển tông xanh (bền, không chỉ lúc diễn).
    await expect(tree.locator('text[data-week-complete="true"]')).toHaveCount(3)

    // Camera mở ở node vừa luyện (115) rồi lướt sang hoa kế (116) trong nghi thức.
    const start = parseCamera(await cameraTransform(page))
    await expect.poll(async () => parseCamera(await cameraTransform(page)).x, { timeout: 4000 }).not.toBe(start.x)
    await expect(tree.locator('[data-ritual]')).toHaveCount(0, { timeout: 4000 })
    // Hero CTA đã đổi theo hoa kế.
    await expect(page.getByRole('link', { name: /Học tiếp: Ngày 16/ })).toBeVisible()
  })

  test('feiern dưới giảm chuyển động: đổi trạng thái tức thì, không gắn class nghi thức', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockSession(page, a1Roadmap())
    await mockPracticeOverview(page, 113, [
      { skill_type: 'HOEREN', status: 'COMPLETED', score_percent: 85, best_score_percent: 85 },
    ])
    await page.goto('/v2/student/roadmap?tab=tree&node=113&feiern=hoeren')

    await expect(page.locator('svg.rt-canvas [data-skill-petal="hoeren"][data-mastered="true"]')).toHaveCount(1)
    await expect(page.locator('svg.rt-canvas [data-ritual]')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.location.search)).not.toContain('feiern')
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
