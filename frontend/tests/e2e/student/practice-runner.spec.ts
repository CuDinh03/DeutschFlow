import { test, expect, type Page } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens'

/**
 * E2E: runner luyện kỹ năng /v2/student/practice/[nodeId]/[skill] — "áo" Lernbaum (L3b).
 *
 * Mock đúng contract backend: `start` trả 202 + job → poll `/async-jobs/{id}` → đề; `submit` trả
 * điểm. Kiểm: màn chờ ươm mầm thay spinner, 6 lá tô dần theo câu trả lời, CTA "Về cây" mang
 * `feiern=<skill>`, và các nhánh lỗi 429/409 không còn bị nuốt thành "không tải được".
 */

const EXERCISES = [
  { type: 'MULTIPLE_CHOICE', instruction_de: 'Wähle die richtige Antwort.', question_de: 'Wie heißt du?', options: ['Ich heiße Anna.', 'Ich bin 20.'], correct_index: 0 },
  { type: 'MULTIPLE_CHOICE', instruction_de: 'Wähle die richtige Antwort.', question_de: 'Woher kommst du?', options: ['Aus Wien.', 'Um acht.'], correct_index: 0 },
]

async function mockSession(page: Page) {
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
      body: JSON.stringify({ displayName: 'Test Student', role: 'STUDENT', userId: 1, email: 'student@test.com', learningTargetLevel: 'A1' }),
    }),
  )
  await page.route('**/api/onboarding/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasPlan: true }) }),
  )
}

/** `start` → 202 job; job PENDING lần đầu rồi COMPLETED; đề 2 câu; submit trả điểm cho trước. */
async function mockGeneration(page: Page, scorePercent: number) {
  let polls = 0
  await page.route('**/api/skill-tree/113/practice/LESEN/start', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: 'job-1', status: 'PENDING' }) }),
  )
  await page.route('**/api/async-jobs/job-1', (route) => {
    polls += 1
    // 2 vòng PENDING (~3s) để assertion màn chờ không đua với job xong.
    const done = polls >= 3
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'job-1', jobType: 'PRACTICE', status: done ? 'COMPLETED' : 'PENDING', resultPayload: done ? JSON.stringify({ sessionId: 900 }) : null, errorMessage: null }),
    })
  })
  await page.route('**/api/skill-tree/practice/900', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: 900, skillType: 'LESEN', generation: 1, status: 'ACTIVE', scorePercent: 0, exercises: EXERCISES, sourceNodeTitle: 'Tag 13', sourceNodeTitleVi: 'Ngày 13' }),
    }),
  )
  await page.route('**/api/skill-tree/practice/900/submit', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scorePercent, xpEarned: 10, status: 'COMPLETED' }) }),
  )
}

test.describe('Runner luyện kỹ năng (/v2) — áo Lernbaum', () => {
  test('màn chờ ươm mầm khi đề sinh nền, 6 lá tô dần, ≥70% thì "Về cây" là CTA chính mang feiern', async ({ page }) => {
    await mockSession(page)
    await mockGeneration(page, 100)
    await page.goto('/v2/student/practice/113/lesen')

    // Link "Về cây" giữa chừng — không mang feiern (chưa có gì để ăn mừng).
    await expect(page.getByRole('link', { name: 'Về cây' })).toHaveAttribute('href', /\/v2\/student\/roadmap\/?\?tab=tree&node=113$/)

    // 202 + job PENDING → nghi thức ươm mầm, không phải spinner.
    const wait = page.getByTestId('seedling-wait')
    await expect(wait).toContainText('Đang ươm đề cho riêng bạn')

    // Đề về → 2 lá, chưa lá nào tô.
    const progress = page.getByTestId('leaf-progress')
    await expect(progress).toHaveAttribute('aria-valuenow', '0')
    await expect(progress).toHaveAttribute('aria-valuemax', '2')
    await expect(wait).toHaveCount(0)

    await page.getByRole('button', { name: /Ich heiße Anna/ }).click()
    await expect(progress).toHaveAttribute('aria-valuenow', '1')
    await expect(progress.locator('[data-leaf-filled="true"]')).toHaveCount(1)
    await page.getByRole('button', { name: /Aus Wien/ }).click()
    await expect(progress).toHaveAttribute('aria-valuenow', '2')

    await page.getByRole('button', { name: /Nộp bài/ }).click()
    await expect(page.getByText('100%')).toBeVisible()
    const back = page.getByTestId('back-to-tree')
    await expect(back).toHaveText(/Về cây — xem nó lớn lên/)
    await expect(back).toHaveAttribute('href', /\/v2\/student\/roadmap\/?\?tab=tree&node=113&feiern=lesen$/)
  })

  test('dưới 70%: "Về cây" vẫn mang feiern (cánh nhún) nhưng làm thêm bài mới là CTA chính', async ({ page }) => {
    await mockSession(page)
    await mockGeneration(page, 50)
    await page.goto('/v2/student/practice/113/lesen')
    await page.getByRole('button', { name: /Ich bin 20/ }).click()
    await page.getByRole('button', { name: /Um acht/ }).click()
    await page.getByRole('button', { name: /Nộp bài/ }).click()
    const back = page.getByTestId('back-to-tree')
    await expect(back).toHaveText('Về cây')
    await expect(back).toHaveAttribute('href', /feiern=lesen$/)
  })

  test('429 hết lượt AI: thông điệp đúng nhánh, không mời thử lại vô ích', async ({ page }) => {
    await mockSession(page)
    await page.route('**/api/skill-tree/113/practice/LESEN/start', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'Quota Exceeded', status: 429, detail: 'Hết 20.000 token ngày.' }),
      }),
    )
    await page.goto('/v2/student/practice/113/lesen')
    const banner = page.getByRole('alert').filter({ hasText: /./ })
    await expect(banner).toContainText('dùng hết lượt AI')
    await expect(banner).toContainText('Hết 20.000 token ngày.')
    await expect(banner.getByRole('button', { name: /Thử lại/ })).toHaveCount(0)
    await expect(page.getByTestId('seedling-wait')).toHaveCount(0)
  })

  test('job sinh đề FAILED: báo đúng là sinh đề hỏng và cho thử lại', async ({ page }) => {
    await mockSession(page)
    await page.route('**/api/skill-tree/113/practice/LESEN/start', (route) =>
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: 'job-x', status: 'PENDING' }) }),
    )
    await page.route('**/api/async-jobs/job-x', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'job-x', jobType: 'PRACTICE', status: 'FAILED', resultPayload: null, errorMessage: 'LLM timeout' }),
      }),
    )
    await page.goto('/v2/student/practice/113/lesen')
    const banner = page.getByRole('alert').filter({ hasText: /./ })
    await expect(banner).toContainText('Sinh đề không thành công')
    await expect(banner).toContainText('LLM timeout')
    await expect(banner.getByRole('button', { name: /Thử lại/ })).toBeVisible()
  })
})
