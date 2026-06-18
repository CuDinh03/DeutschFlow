import { test, expect } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN, teacherCookies, TEACHER_TOKEN } from '../helpers/tokens'

/**
 * E2E smoke — Galerie UI 2.0 (/v2) shell + key role dashboards render.
 *
 * Scope: confirm the v2 surface boots and the GaShell (sidebar + GaTopBar) + page header render for
 * the public landing, the student dashboard, and the teacher dashboard. Backend is mocked (same
 * pattern as the other specs). `V2Gate` treats an undefined PostHog flag as preview-ok, so /v2 is
 * reachable in tests without the flag.
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
  // Specific: /auth/me drives the sidebar user footer.
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  )
  // Catch-all: every other endpoint returns an empty object so pages hit their empty/zero states
  // (the dashboards guard nested optionals → no crash on empty data).
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

test.describe('UI 2.0 (/v2) smoke', () => {
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
    // GaTopBar (global shell chrome) is present.
    await expect(page.getByPlaceholder('Tìm bài học, từ vựng, lớp…')).toBeVisible()
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
    await expect(page.locator('h1')).toContainText('Dashboard & Lớp học')
    await expect(page.getByPlaceholder('Tìm bài học, từ vựng, lớp…')).toBeVisible()
    await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0)
  })
})
