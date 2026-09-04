import { test, expect, type Page } from '@playwright/test'
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens'

/**
 * E2E — Prüfung hub và Exam Shell (S-09 / backlog B-14).
 *
 * Tệp này canh hai thứ khác nhau:
 *
 *  1. **Hợp đồng vỏ thi** (acceptance criteria S-09 §1): trong lúc thi KHÔNG có XP, streak, nav
 *     toàn cục hay animation trang trí — kiểm bằng DOM chứ không bằng mắt.
 *  2. **Chống tái phát B-13**: tải lại giữa bài phải giữ nguyên đáp án, và đồng hồ phải ĐI TIẾP
 *     chứ không đầy lại. Đây là hai phép đo đã đỏ trong probe B-13 và là lý do S-09 được xếp
 *     trước S-06.
 */

const EXAM = {
  id: 1,
  cefr_level: 'A1',
  exam_format: 'GOETHE',
  title: 'Goethe A1 — Modellsatz',
  total_points: 100,
  pass_points: 60,
  time_limit_minutes: 30,
}

const SECTIONS = {
  sections: [
    {
      name: 'LESEN',
      label_vi: 'Đọc hiểu',
      time_minutes: 25,
      max_points: 25,
      teile: [
        {
          teil: 1,
          instruction_vi: 'Chọn đáp án đúng',
          items: [
            { id: 'q1', question: 'Wie heißt du?', type: 'MULTIPLE_CHOICE', options: { A: 'Anna', B: 'Berlin' } },
            { id: 'q2', question: 'Woher kommst du?', type: 'MULTIPLE_CHOICE', options: { A: 'Gut', B: 'Aus Vietnam' } },
            { id: 'q3', question: 'Richtig oder falsch?', type: 'RICHTIG_FALSCH' },
          ],
        },
      ],
    },
    {
      name: 'HOEREN',
      label_vi: 'Nghe hiểu',
      time_minutes: 5,
      max_points: 10,
      teile: [{ teil: 1, instruction_vi: 'Nghe và chọn', items: [] }],
    },
  ],
}

async function setup(page: Page) {
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...studentCookies(),
  ])
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN)

  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route(/.+\/api\/auth\/me$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        displayName: 'Test Student',
        role: 'STUDENT',
        userId: 1,
        email: 's@t.com',
        learningTargetLevel: 'B1',
      }),
    }),
  )
  await page.route('**/api/auth/me/plan', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }) }),
  )
  await page.route(/.+\/api\/mock-exams\?/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([EXAM]) }),
  )
  await page.route('**/api/mock-exams/attempts/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  // Trả CÙNG một attempt id mọi lần — đúng như backend làm khi còn attempt IN_PROGRESS.
  await page.route('**/api/mock-exams/1/start', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 77, sections_json: JSON.stringify(SECTIONS), time_limit_minutes: 30 }),
    }),
  )
}

/** Đồng hồ của vỏ thi, dạng `m:ss`. */
const clock = (page: Page) => page.getByText(/^\d+:\d\d$/).first()

/** `m:ss` → giây, để so sánh được hai lần đo. */
function toSeconds(text: string | null): number {
  const [m, s] = (text ?? '0:00').split(':').map(Number)
  return m * 60 + s
}

async function enterExam(page: Page) {
  await page.goto('/v2/student/mock-exam/run?examId=1')
  await expect(page.locator('input[name="q1"]').first()).toBeVisible({ timeout: 30000 })
}

test.describe('Prüfung hub (S-09)', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('ba nhóm là ba việc KHÁC nhau, mỗi nhóm một đích riêng', async ({ page }) => {
    await setup(page)
    await page.goto('/v2/student/exam')

    // Trước redesign, bốn thẻ "luyện kỹ năng" có ba href trùng nhau. Giờ mỗi nhóm đi một nơi.
    await expect(page.getByRole('link', { name: /Chọn đề và bắt đầu/ })).toHaveAttribute(
      'href',
      /\/v2\/student\/mock-exam\/?$/,
    )
    await expect(page.getByRole('heading', { name: 'Đo mức sẵn sàng B1' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lịch sử và phiếu điểm' })).toBeVisible()

    // Cảnh báo phạm vi lưu phải nằm TRƯỚC khi vào bài, không phải sau khi mất bài (B-13).
    await expect(page.getByText(/lưu trên thiết bị này/)).toBeVisible()

    // Ngữ cảnh cấp độ chỉ in khi có dữ liệu thật — mock trả B1.
    await expect(page.getByText(/Goethe B1/)).toBeVisible()
  })
})

test.describe('Exam Shell — hợp đồng "không phân tán"', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('0 nav toàn cục, 0 XP, 0 streak, 0 animation trang trí', async ({ page }) => {
    await setup(page)

    // Đối chứng: ngoài phòng thi, chrome của role shell CÓ mặt. Không có bước này thì phép đo
    // dưới đây vô nghĩa — một trang trắng cũng "không có nav".
    await page.goto('/v2/student/exam')
    await expect(page.getByRole('navigation', { name: 'Điều hướng khu vực' }).first()).toBeAttached()

    await enterExam(page)

    // `display:none` gỡ chrome khỏi cả tab order lẫn cây accessibility, nên phép đếm role là 0.
    expect(await page.getByRole('navigation').count()).toBe(0)
    await expect(page.locator('#ga-shell-sidebar')).toBeHidden()

    // Không gamification trong lúc thi.
    await expect(page.getByText(/\bXP\b/)).toHaveCount(0)
    await expect(page.getByText(/streak|chuỗi ngày/i)).toHaveCount(0)

    // Không animation trang trí. Đồng hồ cũ dùng `animate-pulse` khi còn <5 phút — DS §7 cấm.
    // Spinner của nút nộp chỉ xuất hiện khi đang nộp, nên lúc này phải sạch.
    expect(await page.locator('[class*="animate-"]').count()).toBe(0)
  })

  test('thoát khỏi phòng thi thì chrome quay lại — không kẹt vĩnh viễn', async ({ page }) => {
    await setup(page)
    await enterExam(page)
    expect(await page.getByRole('navigation').count()).toBe(0)

    page.on('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Thoát', exact: true }).click()

    await expect(page.locator('#ga-shell-sidebar')).toBeVisible()
  })
})

test.describe('Chống tái phát B-13 — tải lại không được mất bài', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('đáp án và đồng hồ sống qua một lần tải lại', async ({ page }) => {
    await setup(page)
    await enterExam(page)

    await page.locator('input[name="q1"][value="A"]').check()
    await page.locator('input[name="q2"][value="B"]').check()

    // Chờ đúng cái nhãn nói thật về phạm vi lưu, thay vì chờ theo đồng hồ.
    await expect(page.getByText(/Đã lưu trên thiết bị này/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('2/3 câu')).toBeVisible()

    await page.waitForTimeout(3000)
    const before = toSeconds(await clock(page).textContent())

    await page.reload()
    await expect(page.locator('input[name="q1"]').first()).toBeVisible({ timeout: 30000 })

    // 1. Đáp án còn nguyên (B-13 đo được: cả hai mất sạch).
    await expect(page.locator('input[name="q1"][value="A"]')).toBeChecked()
    await expect(page.locator('input[name="q2"][value="B"]')).toBeChecked()
    await expect(page.getByText('2/3 câu')).toBeVisible()

    // 2. Đồng hồ ĐI TIẾP chứ không đầy lại (B-13 đo được: 29:56 → 30:00).
    const after = toSeconds(await clock(page).textContent())
    expect(after).toBeLessThanOrEqual(before)
    expect(after).toBeGreaterThan(before - 30)
  })

  test('nộp xong thì nháp bị dọn — lần thi sau không nhặt lại bài cũ', async ({ page }) => {
    await setup(page)
    await enterExam(page)
    await page.locator('input[name="q1"][value="A"]').check()
    await expect(page.getByText(/Đã lưu trên thiết bị này/)).toBeVisible({ timeout: 10000 })

    const stored = () => page.evaluate(() => localStorage.getItem('df.exam.draft.v1.77'))
    expect(await stored()).not.toBeNull()

    page.on('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Nộp bài', exact: true }).click()
    await expect.poll(stored, { timeout: 15000 }).toBeNull()
  })
})
