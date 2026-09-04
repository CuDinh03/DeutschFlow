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
  // Mock STATEFUL theo hợp đồng V285 (#409): server giữ nháp + đồng hồ. Trạng thái sống trong
  // closure Node của Playwright nên qua page.reload() vẫn còn — đúng như server thật.
  const draftStore: {
    startedAtMs: number | null
    version: number
    answers: Record<string, string>
    sectionIndex: number
    finished: boolean
  } = { startedAtMs: null, version: 0, answers: {}, sectionIndex: 0, finished: false }
  const remainingSeconds = () =>
    Math.max(0, 30 * 60 - Math.floor((Date.now() - (draftStore.startedAtMs ?? Date.now())) / 1000))

  await page.route('**/api/mock-exams/attempts/77/draft', async (r) => {
    const body = r.request().postDataJSON() as {
      answers?: Record<string, string>
      sectionIndex?: number
    }
    draftStore.answers = body?.answers ?? {}
    draftStore.sectionIndex = body?.sectionIndex ?? 0
    draftStore.version += 1
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: draftStore.version, remaining_seconds: remainingSeconds() }),
    })
  })
  await page.route('**/api/mock-exams/attempts/77/finish', async (r) => {
    draftStore.finished = true
    draftStore.answers = {}
    draftStore.version = 0
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**/api/mock-exams/attempts/77/result', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 77, exam_id: 1, started_at: new Date().toISOString(), status: 'COMPLETED', total_score: 20, passed: false }),
    }),
  )
  // Trả CÙNG một attempt id mọi lần — đúng như backend làm khi còn attempt IN_PROGRESS —
  // kèm nháp server đã autosave và số giây còn lại tính từ lần start ĐẦU TIÊN.
  await page.route('**/api/mock-exams/1/start', (r) => {
    if (draftStore.startedAtMs === null || draftStore.finished) {
      draftStore.startedAtMs = Date.now()
      draftStore.finished = false
      draftStore.answers = {}
      draftStore.version = 0
    }
    const hasDraft = Object.keys(draftStore.answers).length > 0
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 77,
        sections_json: JSON.stringify(SECTIONS),
        time_limit_minutes: 30,
        remaining_seconds: remainingSeconds(),
        draft: hasDraft
          ? {
              answers_json: JSON.stringify(draftStore.answers),
              section_index: draftStore.sectionIndex,
              version: draftStore.version,
              saved_at: new Date().toISOString(),
            }
          : undefined,
      }),
    })
  })
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

    // Lời hứa autosave phải nằm TRƯỚC khi vào bài và nói đúng sự thật server-side (V285/#409).
    await expect(page.getByText(/tự động lưu lên hệ thống/)).toBeVisible()

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

    // Chờ server XÁC NHẬN lưu (nhãn chỉ đổi sang "Đã lưu" sau onSaved), thay vì chờ theo đồng hồ.
    await expect(page.getByText(/^Đã lưu/)).toBeVisible({ timeout: 10000 })
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

  test('nộp xong thì nháp server bị dọn — lần thi sau không nhặt lại bài cũ', async ({ page }) => {
    await setup(page)
    await enterExam(page)
    await page.locator('input[name="q1"][value="A"]').check()
    await expect(page.getByText(/^Đã lưu/)).toBeVisible({ timeout: 10000 })

    // Nộp: finish phải mang đáp án lên server, và mock dọn nháp như backend thật (#409).
    const finishReq = page.waitForRequest(
      (req) => req.url().includes('/mock-exams/attempts/77/finish') && req.method() === 'POST',
    )
    page.on('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Nộp bài', exact: true }).click()
    const req = await finishReq
    expect((req.postDataJSON() as { answers: Record<string, string> }).answers.q1).toBe('A')

    // Sang màn kết quả — rồi vào lại đề: server không còn nháp nên bài mới phải TRỐNG.
    await expect(page.getByRole('button', { name: /Xem đáp án|đáp án/i })).toBeVisible({ timeout: 15000 })
    await page.goto('/v2/student/mock-exam/run?examId=1')
    await expect(page.locator('input[name="q1"]').first()).toBeVisible({ timeout: 30000 })
    await expect(page.locator('input[name="q1"][value="A"]')).not.toBeChecked()
  })
})
