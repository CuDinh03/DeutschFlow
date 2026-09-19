import { test, expect, type Page } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens'

/**
 * E2E — "sau onboarding" trên web (Đợt 4 PR-3, 19/09/2026; kế hoạch 17/09 §4.4 W9/W10, §7.1).
 *
 *  1. W9 ăn mừng `/v2/onboarding/celebrate`: một trang cho ba nguồn activation, CTA về dashboard.
 *  2. W10 checklist tuần đầu trên dashboard: tích ô theo `GET /onboarding/progress` (server), A1+ bỏ
 *     qua thấy "Kiểm tra đầu vào" (AC-ONB-15), ẩn khi không có hàng / đã xong / quá 7 ngày.
 *  3. Ngày 1 hoàn thành LẦN ĐẦU → ăn mừng (fixture L1); lần sau ở lại trang.
 *
 * Backend mock hoàn toàn qua `page.route` — không cần Postgres. Chờ theo `data-testid`/role,
 * không `waitForTimeout`.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function progress(p: Record<string, unknown> = {}) {
  return { flowVersion: 'onb_v3', lastStep: 'CLAIMED', completedActivities: [], activatedAt: null, coreCompletedAt: null, ...p }
}

async function setup(page: Page, opts: { progress: Record<string, unknown> | null; level?: string }) {
  await page.context().addCookies([
    { name: 'locale', value: 'vi', domain: 'localhost', path: '/' },
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...studentCookies(),
  ])
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)

  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route(/.+\/api\/auth\/me$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ displayName: 'Test Student', role: 'STUDENT', userId: 1, email: 's@t.com', learningTargetLevel: 'B1' }),
    }),
  )
  await page.route('**/api/auth/me/plan', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'FREE', tier: 'FREE', isTrial: true, trialEndsAt: new Date(Date.now() + 30 * DAY_MS).toISOString() }) }),
  )
  await page.route('**/api/roadmap/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/onboarding/me/profile', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentLevel: opts.level ?? 'A0', assignedPersonaCode: 'ANNA', targetLevel: 'B1' }) }),
  )
  // `readProgress` trả bản mặc định khi không có hàng — mô phỏng y hệt.
  const body = opts.progress ?? { flowVersion: 'onb_v3', lastStep: 'INTRO', completedActivities: [], activatedAt: null, coreCompletedAt: null }
  await page.route('**/api/onboarding/progress', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

test.describe('W9 — ăn mừng', () => {
  test('kind=placement&passed=0: rớt vẫn ăn mừng; mentor từ hồ sơ; CTA về dashboard', async ({ page }) => {
    await setup(page, { progress: progress({ completedActivities: ['FIRST_LESSON:PLACEMENT'], activatedAt: new Date().toISOString() }), level: 'B1' })
    await page.goto('/v2/onboarding/celebrate?kind=placement&passed=0')

    const card = page.getByTestId('celebrate')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { level: 1 })).toHaveText('Bạn đã làm được!')
    await expect(card.getByText('Kiểm tra đầu vào xong')).toBeVisible()
    await expect(card.getByText('mình đã biết chỗ cần ôn', { exact: false })).toBeVisible()
    await expect(page.getByTestId('celebrate-mentor')).toContainText('Anna')
    await expect(card.getByText('Tuần đầu của bạn')).toBeVisible()

    await page.getByTestId('celebrate-cta').click()
    await expect(page).toHaveURL(/\/v2\/student\/dashboard\/?$/)
  })

  test('kind=mock_exam và kind lạ (rơi về Ngày 1) đều là một trang ăn mừng, không 404', async ({ page }) => {
    await setup(page, { progress: progress({}) })
    await page.goto('/v2/onboarding/celebrate?kind=mock_exam')
    await expect(page.getByTestId('celebrate').getByText('Nói thử xong')).toBeVisible()

    await page.goto('/v2/onboarding/celebrate?kind=khong-co')
    await expect(page.getByTestId('celebrate').getByText('Ngày 1 hoàn thành')).toBeVisible()
  })
})

test.describe('W10 — checklist tuần đầu trên dashboard', () => {
  test('A0 đã xong Ngày 1: 1/3 việc, mục Ngày 1 gạch bỏ, hai mục còn lại là link', async ({ page }) => {
    await setup(page, { progress: progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: new Date().toISOString() }) })
    await page.goto('/v2/student/dashboard')

    const list = page.getByTestId('starter-checklist')
    await expect(list).toBeVisible()
    await expect(page.getByTestId('starter-progress')).toHaveText('1/3 việc')
    await expect(page.getByTestId('starter-item-first_lesson')).toHaveAttribute('data-done', 'true')
    await expect(page.getByTestId('starter-item-roadmap_node').getByRole('link')).toHaveAttribute('href', /^\/v2\/student\/roadmap\/?$/)
    await expect(page.getByTestId('starter-item-mock_exam').getByRole('link')).toHaveAttribute('href', /^\/v2\/onboarding\/mock-exam\/?$/)
  })

  test('A1+ bỏ qua Chọn đường: có mục "Kiểm tra đầu vào" trỏ ?placement=1 (AC-ONB-15)', async ({ page }) => {
    await setup(page, { progress: progress({}), level: 'B1' })
    await page.goto('/v2/student/dashboard')

    const item = page.getByTestId('starter-item-placement')
    await expect(item).toBeVisible()
    await expect(item.getByRole('link')).toHaveAttribute('href', /^\/v2\/onboarding\/?\?placement=1$/)
    await expect(page.getByTestId('starter-item-first_lesson')).toHaveCount(0)
  })

  test('?placement=1 (từ checklist) → vào thẳng bài 10 câu, không chạy lại wizard (W-1)', async ({ page }) => {
    await setup(page, { progress: progress({}), level: 'B1' })
    let created = 0
    await page.route('**/api/skill-tree/placement-test', (r) => {
      created += 1
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          testId: 't1',
          questions: [
            { id: 1, skillSection: 'LESEN', type: 'MULTIPLE_CHOICE', questionDe: 'Wie heißt du?', questionVi: 'Bạn tên gì?', options: ['Anna', 'Berlin'] },
          ],
        }),
      })
    })

    await page.goto('/v2/onboarding?placement=1')

    await expect(page.getByText('Wie heißt du?')).toBeVisible()
    expect(created).toBe(1)
    // Không phải wizard, không phải Chọn đường: vào thẳng câu hỏi.
    await expect(page.getByTestId('path-choice')).toHaveCount(0)
    await expect(page.getByText('Bạn tên gì?')).toBeVisible()
  })

  test('placement: lần đầu → ăn mừng; làm lại từ checklist (đã có PLACEMENT) → dashboard, không ăn mừng lần hai', async ({ page }) => {
    const QUESTION_PAGE = {
      testId: 't1',
      questions: [{ id: 1, skillSection: 'LESEN', type: 'MULTIPLE_CHOICE', questionDe: 'Wie heißt du?', questionVi: 'Bạn tên gì?', options: ['Anna', 'Berlin'] }],
    }
    const RESULT = { passed: true, scorePercent: 100, correctCount: 1, totalQuestions: 1 }
    async function runPlacement() {
      await page.route('**/api/skill-tree/placement-test', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(QUESTION_PAGE) }))
      await page.route('**/api/skill-tree/placement-test/t1/submit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESULT) }))
      await page.goto('/v2/onboarding?placement=1')
      await page.getByRole('radio', { name: /Anna/ }).click()
      await page.getByRole('button', { name: 'Nộp bài' }).click()
      await page.getByRole('button', { name: /Bắt đầu lộ trình cá nhân hóa/ }).click()
    }

    // Lần đầu: chưa có FIRST_LESSON:PLACEMENT ⇒ ăn mừng.
    await setup(page, { progress: progress({}), level: 'B1' })
    await runPlacement()
    await expect(page).toHaveURL(/\/v2\/onboarding\/celebrate\/?\?kind=placement&passed=1$/)

    // Làm lại: đã có PLACEMENT ⇒ về dashboard.
    await page.route('**/api/onboarding/progress', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(progress({ completedActivities: ['FIRST_LESSON:PLACEMENT'], activatedAt: new Date().toISOString() })) }),
    )
    await runPlacement()
    await expect(page).toHaveURL(/\/v2\/student\/dashboard\/?$/)
  })

  test('không có hàng progress (tài khoản cũ) ⇒ dashboard không có checklist', async ({ page }) => {
    await setup(page, { progress: null })
    await page.goto('/v2/student/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('starter-checklist')).toHaveCount(0)
  })

  test('đã xong đủ, hoặc quá 7 ngày ⇒ tự ẩn', async ({ page }) => {
    await setup(page, {
      progress: progress({
        completedActivities: ['FIRST_LESSON:BEGINNER_SESSION', 'FIRST_LESSON:ROADMAP_NODE', 'FIRST_LESSON:MOCK_EXAM'],
        activatedAt: new Date().toISOString(),
      }),
    })
    await page.goto('/v2/student/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('starter-checklist')).toHaveCount(0)

    await page.route('**/api/onboarding/progress', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: new Date(Date.now() - 8 * DAY_MS).toISOString() })),
      }),
    )
    await page.goto('/v2/student/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('starter-checklist')).toHaveCount(0)
  })
})

test.describe('Ngày 1 → ăn mừng (fixture L1)', () => {
  const SESSION = {
    welcomeMessage: 'Willkommen!',
    firstSpeakingPrompt: 'Sag Hallo.',
    encouragement: 'Super!',
    items: [
      { sequenceOrder: 1, itemType: 'VOCABULARY', titleDe: 'Hallo', titleVi: 'Xin chào', exampleDe: null, audioHint: null },
      { sequenceOrder: 2, itemType: 'PHRASE', titleDe: 'Guten Morgen', titleVi: 'Chào buổi sáng', exampleDe: null, audioHint: null },
    ],
  }

  test('hoàn thành lần đầu (activatedAt null) → /v2/onboarding/celebrate?kind=beginner', async ({ page }) => {
    await setup(page, { progress: progress({}) })
    await page.route('**/api/beginner/first-session', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }),
    )
    let completed = 0
    await page.route('**/api/beginner/first-session/complete', (r) => { completed += 1; return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) })

    await page.goto('/v2/student/beginner')
    await expect(page.getByText('Hallo', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Hoàn thành/ }).click()

    await expect(page).toHaveURL(/\/v2\/onboarding\/celebrate\/?\?kind=beginner$/)
    await expect(page.getByTestId('celebrate').getByText('Ngày 1 hoàn thành')).toBeVisible()
    expect(completed).toBe(1)
  })

  test('mở lại Ngày 1 khi đã kích hoạt → ở lại trang, không ăn mừng lần hai', async ({ page }) => {
    await setup(page, { progress: progress({ completedActivities: ['FIRST_LESSON:BEGINNER_SESSION'], activatedAt: new Date().toISOString() }) })
    await page.route('**/api/beginner/first-session', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }),
    )
    await page.goto('/v2/student/beginner')
    await page.getByRole('button', { name: /Hoàn thành/ }).click()

    await expect(page.getByText('Super!')).toBeVisible()
    await expect(page).toHaveURL(/\/v2\/student\/beginner\/?$/)
  })
})

test.describe('Nói thử → báo cáo → ăn mừng chỉ lần đầu', () => {
  const REPORT = {
    id: 1,
    estimated_cefr: 'A2',
    radar_chart: { grammar: 60, pronunciation: 55, vocabulary: 70, fluency: 50 },
    top_errors: [
      { type: 'grammar', original: 'Ich bin Student seit zwei Jahre', corrected: 'Ich bin seit zwei Jahren Student', explanation_vi: 'Dativ sau seit' },
    ],
    summary_vi: 'Tốt.',
  }
  async function openReport(page: Page, query: string) {
    await setup(page, { progress: progress({}), level: 'B1' })
    // Nút "Mở khóa" (mở paywall chứa "Tiếp tục miễn phí") chỉ hiện cho FREE không trial — đúng thiết kế Đợt 0.
    await page.route('**/api/auth/me/plan', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'FREE', tier: 'FREE', isTrial: false, trialEndsAt: null }) }))
    await page.route('**/api/onboarding/placement-tests/latest', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPORT) }))
    await page.goto(`/v2/onboarding/error-report?${query}`)
    await page.getByRole('button', { name: /Mở khóa toàn bộ lỗi/ }).click()
    await page.getByRole('button', { name: 'Tiếp tục miễn phí' }).click()
  }

  test('mock-exam gắn celebrate=1 khi là lần đầu ⇒ "Tiếp tục miễn phí" → ăn mừng', async ({ page }) => {
    await openReport(page, 'id=1&celebrate=1')
    await expect(page).toHaveURL(/\/v2\/onboarding\/celebrate\/?\?kind=mock_exam$/)
  })

  test('xem lại / làm lại (không có cờ) ⇒ về dashboard thẳng', async ({ page }) => {
    await openReport(page, 'id=1')
    await expect(page).toHaveURL(/\/v2\/student\/dashboard\/?$/)
  })
})
