import { test, expect, type Page } from '@playwright/test'
import { studentCookies, teacherCookies, STUDENT_TOKEN, TEACHER_TOKEN } from '../../helpers/tokens'

/**
 * E2E: hộp thư gộp của /v2/student/messages và /v2/teacher/messages.
 *
 * Trước đây học viên KHÔNG có lối vào kênh chat nhóm lớp (chỉ giáo viên có, sau một tab riêng),
 * dù backend `/v2/classes/{id}/channel` vốn mở cho mọi thành viên lớp. Bộ test này khoá lại hai
 * điều: (1) học viên thấy và gửi được tin nhắn nhóm lớp, (2) cả hai vai đọc nhóm lớp và tin riêng
 * trong CÙNG một danh sách — không còn tab để lạc mất tin.
 */

const CLASS_MESSAGES = [
  {
    id: 11,
    senderId: 2,
    senderName: 'Cô Vũ Huyền',
    body: 'Cả lớp nhớ nộp bài Schreiben trước thứ 6 nhé.',
    createdAt: '2026-08-03T02:15:00Z',
    mine: false,
    deleted: false,
    canDelete: false,
  },
  {
    id: 12,
    senderId: 1,
    senderName: 'Test Student',
    body: 'Dạ em rõ ạ.',
    createdAt: '2026-08-03T02:20:00Z',
    mine: true,
    deleted: false,
    canDelete: true,
  },
]

const CONVERSATIONS = [
  {
    userId: 2,
    displayName: 'Vũ Huyền',
    email: 'teacher@test.com',
    lastMessage: 'haloo',
    lastAt: '2026-08-03T03:15:00Z',
    unread: 2,
  },
]

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function mockSession(page: Page, role: 'STUDENT' | 'TEACHER') {
  const isStudent = role === 'STUDENT'
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...(isStudent ? studentCookies() : teacherCookies()),
  ])
  await page.addInitScript(
    (token) => localStorage.setItem('accessToken', token),
    isStudent ? STUDENT_TOKEN : TEACHER_TOKEN,
  )

  await page.route('**/api/**', (route) => route.fulfill(json({})))
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill(
      json({
        displayName: isStudent ? 'Test Student' : 'Vũ Huyền',
        role,
        userId: isStudent ? 1 : 2,
        email: isStudent ? 'student@test.com' : 'teacher@test.com',
        learningTargetLevel: 'A1',
      }),
    ),
  )
  await page.route('**/api/auth/me/plan', (route) => route.fulfill(json({ planCode: 'PRO', tier: 'PRO' })))
  await page.route('**/api/messages/conversations', (route) => route.fulfill(json(CONVERSATIONS)))
  await page.route('**/api/v2/students/classes', (route) =>
    route.fulfill(
      json([
        { id: 7, name: 'A1.1 Buổi tối', teachers: [{ id: 2, displayName: 'Vũ Huyền', email: 'teacher@test.com', role: 'TEACHER' }] },
      ]),
    ),
  )
  await page.route('**/api/v2/teacher/classes', (route) =>
    route.fulfill(json([{ id: 7, name: 'A1.1 Buổi tối', studentCount: 12 }])),
  )
  await page.route('**/api/v2/classes/7/channel/messages', (route) => {
    if (route.request().method() === 'POST') {
      const sent = route.request().postDataJSON() as { body: string }
      return route.fulfill(
        json({
          id: 13,
          senderId: isStudent ? 1 : 2,
          senderName: isStudent ? 'Test Student' : 'Vũ Huyền',
          body: sent.body,
          createdAt: '2026-08-03T02:30:00Z',
          mine: true,
          deleted: false,
          canDelete: true,
        }),
      )
    }
    return route.fulfill(json(CLASS_MESSAGES))
  })
}

/** Khung danh sách bên trái — khoanh vùng để không dính chữ ở sidebar điều hướng hay tiêu đề trang. */
const inbox = (page: Page) => page.getByRole('complementary', { name: 'Danh sách tin nhắn' })

test.describe('Hộp thư gộp — học viên', () => {
  test('thấy nhóm lớp và tin riêng trong cùng một danh sách', async ({ page }) => {
    await mockSession(page, 'STUDENT')
    await page.goto('/v2/student/messages')

    // Hai nhóm, một danh sách.
    const list = inbox(page)
    await expect(list.getByText('Nhóm lớp', { exact: true })).toBeVisible()
    await expect(list.getByText('Cá nhân', { exact: true })).toBeVisible()

    // Kênh lớp — thứ trước đây học viên không có lối vào.
    await expect(list.getByRole('button', { name: /A1\.1 Buổi tối/ })).toBeVisible()
    await expect(list.getByText('GV: Vũ Huyền')).toBeVisible()

    // Tin riêng vẫn còn nguyên, kèm số chưa đọc. Lọc theo `haloo` vì hàng nhóm lớp cũng
    // mang tên giáo viên ở dòng phụ ("GV: Vũ Huyền").
    await expect(list.getByRole('button', { name: /Vũ Huyền.*haloo/ })).toBeVisible()
    // 2 chưa đọc hiện ở hai chỗ: tổng trên đầu danh sách và huy hiệu của chính hàng đó.
    await expect(list.getByText('2', { exact: true })).toHaveCount(2)
  })

  test('mở kênh lớp và đọc được tin của giáo viên', async ({ page }) => {
    await mockSession(page, 'STUDENT')
    await page.goto('/v2/student/messages')

    await inbox(page).getByRole('button', { name: /A1\.1 Buổi tối/ }).click()

    await expect(page.getByText('Kênh chat cả lớp')).toBeVisible()
    await expect(page.getByText('Cả lớp nhớ nộp bài Schreiben trước thứ 6 nhé.')).toBeVisible()
    await expect(page.getByText('Cô Vũ Huyền')).toBeVisible()
    await expect(page.getByText('Dạ em rõ ạ.')).toBeVisible()
  })

  test('gửi được tin vào kênh lớp', async ({ page }) => {
    await mockSession(page, 'STUDENT')
    await page.goto('/v2/student/messages')

    await inbox(page).getByRole('button', { name: /A1\.1 Buổi tối/ }).click()
    await page.getByPlaceholder('Nhắn cả lớp…').fill('Em nộp rồi ạ.')
    await page.getByRole('button', { name: 'Gửi' }).click()

    await expect(page.getByText('Em nộp rồi ạ.')).toBeVisible()
  })

  test('chuyển qua lại giữa nhóm lớp và tin riêng không cần đổi tab', async ({ page }) => {
    await mockSession(page, 'STUDENT')
    // Đăng ký SAU mockSession: Playwright ưu tiên route đăng ký sau, nếu đặt trước thì
    // catch-all `**/api/**` của mockSession sẽ nuốt mất.
    await page.route('**/api/messages/with/2', (route) =>
      route.fulfill(
        json([
          { id: 21, senderId: 2, recipientId: 1, body: 'haloo', createdAt: '2026-08-03T03:15:00Z', readAt: null, mine: false },
        ]),
      ),
    )
    await page.goto('/v2/student/messages')

    const list = inbox(page)
    await list.getByRole('button', { name: /A1\.1 Buổi tối/ }).click()
    await expect(page.getByText('Kênh chat cả lớp')).toBeVisible()

    await list.getByRole('button', { name: /Vũ Huyền.*haloo/ }).click()
    await expect(page.getByText('Kênh chat cả lớp')).toBeHidden()
    await expect(page.getByPlaceholder('Nhập tin nhắn…')).toBeVisible()
  })
})

test.describe('Hộp thư gộp — giáo viên', () => {
  test('nhóm lớp và tin riêng nằm chung, không còn tab Trực tiếp/Nhóm lớp', async ({ page }) => {
    await mockSession(page, 'TEACHER')
    await page.goto('/v2/teacher/messages')

    const list = inbox(page)
    await expect(list.getByRole('button', { name: /A1\.1 Buổi tối/ })).toBeVisible()
    await expect(list.getByText('12 học viên')).toBeVisible()

    // Tab cũ đã gỡ — segmented control không còn.
    await expect(page.getByRole('radiogroup', { name: 'Chế độ nhắn tin' })).toHaveCount(0)

    // Nút soạn tin riêng vẫn còn.
    await expect(list.getByRole('button', { name: /Nhắn học viên/ })).toBeVisible()
  })
})
