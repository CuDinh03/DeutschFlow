import { test, expect } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN, teacherCookies, TEACHER_TOKEN } from '../helpers/tokens'

/**
 * E2E smoke — Galerie UI 2.0 (/v2) shell + key role dashboards render.
 *
 * Scope: confirm the v2 surface boots and the GaShell (area nav + GaTopBar) + page header render for
 * the public landing, the student dashboard, and the teacher dashboard. Backend is mocked (same
 * pattern as the other specs). `V2Gate` treats an undefined PostHog flag as preview-ok, so /v2 is
 * reachable in tests without the flag.
 *
 * Wave 1 / S-01 reshaped the shell chrome: student + teacher moved to AREA navigation (5 areas,
 * persistent) and GaTopBar dropped the decorative global search for those roles — utility there is
 * now the inbox icon + account menu. This spec is where the "persistent nav is exactly 5 areas"
 * contract is pinned; per-area destinations belong to GaLocalNav and are covered elsewhere.
 * Because the sidebar area list is `md:block` and the bottom nav is `md:hidden`, both nav landmarks
 * exist in the DOM at once — assertions filter to the VISIBLE one and the viewport is declared.
 *
 * NOTE: admin + org dashboards need admin/org JWT helpers in tests/helpers/tokens.ts (TEACHER/STUDENT
 * only exist today) → follow-up to extend coverage to all 4 roles.
 */

const ME = {
  id: 1,
  email: 'qa@local.test',
  displayName: 'QA User',
  role: 'STUDENT',
  locale: 'vi',
}

async function mockApi(page: import('@playwright/test').Page, me: Record<string, unknown>) {
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  )
  // Catch-all: every endpoint returns an empty object so pages hit their empty/zero states (the
  // dashboards guard nested optionals → no crash on empty data).
  //
  // ⚠️ Playwright resolves routes in REVERSE registration order, so this catch-all — registered
  // LAST — also swallows /auth/me: the store never gets a displayName and the student header falls
  // back to `titleFallback`. That is exactly what the assertions below encode. Registering the
  // specific route last (the order used in student/roadmap.spec.ts) would hand /auth/me the `me`
  // payload and change those headings, so don't "tidy" the order without moving the assertions.
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

test.describe('UI 2.0 (/v2) smoke', () => {
  // Shell chrome khác nhau theo breakpoint (sidebar area list ≥768px, bottom nav <768px) → khai RÕ
  // viewport thay vì dựa vào mặc định của Playwright.
  test.use({ viewport: { width: 1280, height: 720 } })

  test('public landing renders + routes to register/login', async ({ page }) => {
    await page.goto('/v2')
    await expect(page.locator('h1')).toContainText('phỏng vấn tiếng Đức')
    // Primary CTAs point at the real auth routes (href^= tolerates the app's trailing slash).
    await expect(page.locator('a[href^="/v2/register"]').first()).toBeVisible()
    await expect(page.locator('a[href^="/v2/login"]').first()).toBeVisible()
    // Marketing nav renders (anchor links into the page sections).
    await expect(page.getByRole('link', { name: 'Tính năng' })).toBeVisible()
  })

  test('student dashboard renders inside the shell', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)
    await mockApi(page, { ...ME, role: 'STUDENT' })

    await page.goto('/v2/student/dashboard')
    await expect(page.locator('h1')).toContainText('Bảng điều khiển')

    // Persistent nav của học viên: ĐÚNG 5 khu vực (Heute · Lernen · Sprechen · Prüfung ·
    // Fortschritt) — hợp đồng trung tâm của S-01, gãy ra là nav phình lại như cũ.
    const areaNav = page.getByRole('navigation', { name: 'Điều hướng khu vực' }).filter({ visible: true })
    await expect(areaNav).toHaveCount(1)
    await expect(areaNav.getByRole('link')).toHaveCount(5)
    for (const area of ['Heute', 'Lernen', 'Sprechen', 'Prüfung', 'Fortschritt']) {
      await expect(areaNav.getByRole('link', { name: new RegExp(`^${area} — `) })).toHaveCount(1)
    }

    // GaTopBar (global shell chrome) là utility: inbox thay cho ô tìm kiếm đã bỏ ở S-01.
    await expect(page.getByRole('link', { name: 'Tin nhắn', exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Tìm bài học, từ vựng, lớp…')).toHaveCount(0)

    // No app-level crash (ErrorBoundary copy must NOT appear).
    await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0)
  })

  test('teacher dashboard renders inside the shell', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...teacherCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), TEACHER_TOKEN)
    await mockApi(page, { ...ME, role: 'TEACHER', displayName: 'QA Teacher' })

    await page.goto('/v2/teacher')
    // "Trang chủ" since 076b8452 renamed the teacher dashboard title (this spec still asserted the
    // original "Dashboard & Lớp học" until 2026-08-04). It is a generic heading, so pair it with a
    // teacher-only element below — otherwise a bounce to some other page could pass this test.
    await expect(page.locator('h1')).toContainText('Trang chủ')
    // Nhãn mới sau merge main: 'Lượt ghi danh' (một học viên 2 lớp đếm 2 — nói thật hơn 'Tổng học viên').
    await expect(page.getByText('Lượt ghi danh')).toBeVisible()

    // Giáo viên cũng đã chuyển sang area nav ở S-01: Heute · Klassen · Bewerten · Materialien ·
    // Berichte. Cùng một hợp đồng 5 khu vực, khác bộ nhãn.
    const areaNav = page.getByRole('navigation', { name: 'Điều hướng khu vực' }).filter({ visible: true })
    await expect(areaNav.getByRole('link')).toHaveCount(5)
    await expect(page.getByPlaceholder('Tìm bài học, từ vựng, lớp…')).toHaveCount(0)

    await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0)
  })
})

/**
 * Hợp đồng điều hướng sau B-05 (gom nhóm local nav) và B-06 (một nơi duy nhất cho tài khoản).
 * Tách describe riêng vì hai bài dưới đo ở khổ màn khác nhau — mặc định của shell phụ thuộc
 * breakpoint nên viewport phải khai rõ ở từng nhóm.
 */
test.describe('Điều hướng cấp 2 — Lernen gom nhóm (B-05)', () => {
  // 1440 là khổ mà 10 ô phẳng cũ đã phải cuộn ngang; đo lại đúng ở đó.
  test.use({ viewport: { width: 1440, height: 900 } })

  test('còn 5 ô cấp 1 và không cuộn ngang', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)
    await mockApi(page, { ...ME, role: 'STUDENT' })

    await page.goto('/v2/student/roadmap')
    const localNav = page.getByRole('navigation', { name: 'Điều hướng trong khu vực' })
    await expect(localNav).toBeVisible()

    // 2 destination đi thẳng + 3 nhóm mở menu = 5 ô. Nhiều hơn là nav lại phình.
    await expect(localNav.locator(':scope > *')).toHaveCount(5)
    await expect(localNav.getByRole('link')).toHaveCount(2)
    await expect(localNav.getByRole('button')).toHaveCount(3)

    // Bất biến chính của B-05: hàng tab không còn phải cuộn.
    const overflow = await localNav.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('nhóm mở ra menu và mọi destination cũ vẫn tới được', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)
    await mockApi(page, { ...ME, role: 'STUDENT' })

    await page.goto('/v2/student/roadmap')
    await page.getByRole('button', { name: /^Thư viện/ }).click()

    // Bốn destination của Bibliothek nằm sau đúng MỘT cú bấm (ràng buộc ≤2 cấp).
    for (const name of ['Bài học', 'Từ vựng', 'Ngữ pháp', 'Bài tập bổ trợ']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
    }
    await page.getByRole('link', { name: 'Từ vựng', exact: true }).click()
    await expect(page).toHaveURL(/\/v2\/student\/vocabulary\/?$/)
  })
})

test.describe('Ngăn kéo điều hướng trên mobile (B-06)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('giáo viên bấm "Mehr" thì thấy được Berichte', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...teacherCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), TEACHER_TOKEN)
    await mockApi(page, { ...ME, role: 'TEACHER', displayName: 'QA Teacher' })

    await page.goto('/v2/teacher')

    // Berichte là area `mobileInMore`: không có ô riêng ở bottom nav, chỉ tới được qua "Mehr".
    const drawer = page.getByRole('complementary', { name: 'Điều hướng chính' })
    const berichte = drawer.getByRole('link', { name: /^Berichte/ })

    // Ngăn kéo đóng = trượt hẳn ra ngoài mép trái. Khẳng định điều này TRƯỚC để bài test không
    // xanh giả: `translate-x` không xoá phần tử khỏi cây, nên `toBeVisible()` một mình là vô nghĩa
    // — `toBeInViewport` mới phân biệt được "có trong DOM" với "người dùng thấy được".
    await expect(berichte).not.toBeInViewport()

    await page.getByRole('button', { name: 'Thêm', exact: true }).click()

    // Ngăn kéo trượt vào trong 200ms; assertion này tự thử lại nên không cần chờ theo đồng hồ.
    await expect(berichte).toBeInViewport()
  })

  test('tài khoản chỉ có MỘT nhà: account menu, không còn footer sidebar', async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ])
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)
    await mockApi(page, { ...ME, role: 'STUDENT' })

    await page.goto('/v2/student/dashboard')

    // Menu đóng: không nơi nào trong shell nói "Đăng xuất".
    await expect(page.getByRole('button', { name: /Đăng xuất/i })).toHaveCount(0)

    await page.getByRole('button', { name: 'Tài khoản', exact: true }).click()
    await expect(page.getByRole('button', { name: /Đăng xuất/i })).toHaveCount(1)
    // Utility cũng chỉ còn ở đây, không song song trong ngăn kéo.
    await expect(page.getByRole('link', { name: 'Học phí', exact: true })).toHaveCount(1)
  })
})
