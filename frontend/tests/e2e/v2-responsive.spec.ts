import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { SignJWT } from 'jose'

/**
 * E2E — chống tràn ngang trên khổ điện thoại cho bề mặt /v2.
 *
 * Vì sao có bài test này: shell đã được vá responsive (PR #243/#244) nhưng NỘI DUNG bên trong
 * trang vẫn là bố cục desktop cứng (padding px-10, dải KPI `repeat(N, 1fr)` cố định, bảng không
 * có vùng cuộn) — người dùng vẫn chụp được ảnh giao diện vỡ trên iPhone. Lỗi kiểu này không có
 * bài test nào bắt được vì nó không làm hỏng logic, chỉ hỏng bố cục.
 *
 * Bất biến được canh giữ: ở khổ 320px và 390px, KHÔNG trang nào của /v2 được phép cuộn ngang
 * (`document.documentElement.scrollWidth <= clientWidth`). Khi hỏng, test in ra ĐÚNG phần tử
 * đang đẩy tràn kèm class của nó để sửa được ngay, thay vì chỉ báo "sai số đo".
 *
 * Ở chiều ngược lại, `desktop giữ nguyên` khoá cứng giao ước của đợt vá: từ 1024px trở lên
 * GaPageHdr phải y hệt thiết kế gốc (px-[52px] · pt-9 · h1 36px) và dải KPI phải đủ 4 cột.
 *
 * Đăng nhập: token được KÝ LÚC CHẠY bằng JWT_SECRET của môi trường (đọc từ env, nếu không có thì
 * từ .env.local/.env) — không nhúng JWT literal vào repo vì gitleaks chặn merge khi thấy chuỗi
 * ba đoạn base64, kể cả token giả. Khi không tìm thấy secret nào (dev server chạy chế độ không
 * verifier) thì cookie phiên là đủ để middleware cho qua — xem src/middleware.ts.
 *
 * Chạy với server khác cổng: E2E_BASE_URL=http://localhost:3100 npx playwright test v2-responsive
 */

const ME = { id: 1, userId: 1, email: 'qa@local.test', displayName: 'QA User', locale: 'vi' }

const BASE_URL = process.env.E2E_BASE_URL
if (BASE_URL) test.use({ baseURL: BASE_URL })

/** JWT_SECRET từ môi trường, nếu không có thì đọc thẳng .env.local / .env như Next.js vẫn làm. */
function jwtSecret(): string | null {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  for (const file of ['.env.local', '.env']) {
    try {
      const line = readFileSync(resolve(process.cwd(), file), 'utf8')
        .split('\n')
        .find((l) => l.startsWith('JWT_SECRET='))
      if (line) return line.slice('JWT_SECRET='.length).trim().replace(/^["']|["']$/g, '')
    } catch {
      // file không tồn tại — thử file tiếp theo
    }
  }
  return null
}

const SECRET = jwtSecret()

/** Token HS256 hợp lệ cho vai trò cần test; null khi môi trường không cấu hình verifier. */
async function accessToken(role: string, sub = '1'): Promise<string | null> {
  if (!SECRET) return null
  return new SignJWT({ role, sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET))
}

/**
 * Một handler DUY NHẤT cho mọi lệnh gọi API. Không tách `/auth/me` thành route riêng:
 * Playwright ưu tiên route đăng ký SAU, nên catch-all sẽ đè mất route riêng đăng ký trước và
 * app mất vai trò người dùng → bị đá về dashboard mặc định, test đo nhầm trang.
 *
 * Với endpoint còn lại: path kết thúc bằng id số → trả object (endpoint chi tiết), còn lại trả
 * mảng rỗng (endpoint danh sách). Đủ để trang render khung thật thay vì màn hình lỗi.
 */
/** Trang phân trang kiểu Spring cần `{content: []}`; trả mảng trần vào đó là trang nổ `.content.filter`. */
const PAGE_SHAPE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

/**
 * Endpoint cần shape riêng vì trang đọc thẳng vào trường bên trong. Danh sách này chỉ đủ để các
 * trang trong ROUTES render được khung thật — không mô phỏng nghiệp vụ.
 */
const FIXTURES: [RegExp, unknown][] = [
  [/\/org\/classes\b/, PAGE_SHAPE],
  [/\/org\/analytics\b/, {
    studentCount: 0, teacherCount: 0, classCount: 0, tokensThisMonth: 0, monthlyTokenPool: 0,
    poolUsagePercent: 0, poolUnlimited: false, activeStudents7d: 0, cefrDistribution: [],
  }],
  [/\/org\/?$/, { name: 'QA Org', planCode: 'ORG_PRO', seatUsed: 0, seatLimit: 10, teacherCount: 0, studentCount: 0 }],
]

async function mockApi(page: Page, role: string) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const fixture = FIXTURES.find(([re]) => re.test(path))
    const body = /\/auth\/me\b/.test(path)
      ? JSON.stringify({ ...ME, role })
      : fixture
        ? JSON.stringify(fixture[1])
        : /\/\d+\/?$/.test(path)
          ? JSON.stringify({ ...PAGE_SHAPE, items: [], data: [], total: 0 })
          : '[]'
    route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

async function gotoAs(page: Page, role: string, path: string) {
  const token = await accessToken(role)
  const cookies: [string, string][] = [
    ['refresh_token', '1'],
    ['auth_logged_in', '1'],
    ['auth_role', role],
    ['NEXT_LOCALE', 'vi'],
  ]
  if (token) cookies.push(['auth_access', token])
  await page.context().addCookies(
    cookies.map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' })),
  )
  if (token) await page.addInitScript((t) => localStorage.setItem('accessToken', t), token)
  await mockApi(page, role)
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
}

/**
 * Đo tràn ngang ở ĐÚNG vùng cuộn của app.
 *
 * Cạm bẫy đã mắc một lần và phải ghi lại: GaShell dựng `overflow-hidden` ở gốc và
 * `<main class="overflow-y-auto">`, mà đặt overflow-y:auto thì trình duyệt tính overflow-x
 * thành `auto` luôn → <main> là vùng cuộn riêng. Hệ quả: nội dung tràn bên trong app KHÔNG
 * bao giờ làm `document.documentElement.scrollWidth` lớn lên. Một bài test đo ở documentElement
 * sẽ LUÔN xanh kể cả khi bố cục vỡ tan — đúng nghĩa test mù. Phải đo main.scrollWidth.
 *
 * Thủ phạm = phần tử vượt mép phải vùng nhìn thấy của main, mà đường đi lên (dừng TRƯỚC main)
 * không gặp vùng cuộn ngang có chủ đích — bảng bọc trong overflow-x-auto là HỢP LỆ, không tính.
 */
const MEASURE = `(() => {
  const de = document.documentElement
  const main = document.querySelector('main') || de
  const rightEdge = main.getBoundingClientRect().left + main.clientWidth
  const culprits = []
  for (const el of main.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    const over = Math.round(r.right - rightEdge)
    if (over <= 1) continue
    let p = el.parentElement, intentional = false
    while (p && p !== main) {
      if (getComputedStyle(p).overflowX !== 'visible') { intentional = true; break }
      p = p.parentElement
    }
    if (intentional) continue
    culprits.push(over + 'px  <' + el.tagName.toLowerCase() + '> ' + String(el.className).slice(0, 110))
  }
  let cssRules = 0
  for (const sheet of document.styleSheets) {
    try { cssRules += sheet.cssRules.length } catch (e) { /* stylesheet khác origin */ }
  }
  return {
    overflow: Math.max(main.scrollWidth - main.clientWidth, de.scrollWidth - de.clientWidth),
    culprits: culprits.slice(0, 5),
    cssRules,
    elementCount: main.querySelectorAll('*').length,
  }
})()`

type Measurement = { overflow: number; culprits: string[]; cssRules: number; elementCount: number }

/**
 * Hai điều kiện tiên quyết để một phép đo bố cục có nghĩa. Thiếu một trong hai thì kết quả
 * "không tràn" là rỗng nghĩa chứ không phải đạt:
 *  - CSS phải nạp được: nếu chunk style lỗi (build hỏng, 500) thì mọi phần tử thành block xếp
 *    dọc và không bao giờ tràn. Đã dính bẫy này thật.
 *  - Trang phải render nội dung: một <main> trống cũng không tràn.
 */
function assertMeasurable(m: Measurement, path: string) {
  expect(m.cssRules, `${path}: CSS không nạp được (${m.cssRules} luật) — phép đo vô nghĩa`).toBeGreaterThan(100)
  expect(m.elementCount, `${path}: <main> gần như trống (${m.elementCount} phần tử) — phép đo vô nghĩa`).toBeGreaterThan(10)
}

const ROUTES: [string, string][] = [
  ['STUDENT', '/v2/student/dashboard'],
  ['STUDENT', '/v2/student/classes'],
  ['STUDENT', '/v2/student/vocabulary'],
  ['TEACHER', '/v2/teacher'],
  ['TEACHER', '/v2/teacher/grading'],
  ['MANAGER', '/v2/org'],
  ['ADMIN', '/v2/admin/users'],
  ['ADMIN', '/v2/admin/revenue'],
]

for (const width of [320, 390]) {
  test.describe(`/v2 không tràn ngang @${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })

    for (const [role, path] of ROUTES) {
      test(`${path} (${role})`, async ({ page }) => {
        await gotoAs(page, role, path)

        // Trang phải render thật, không rơi vào ErrorBoundary — nếu không phép đo vô nghĩa.
        await expect(page.getByText('Có lỗi xảy ra')).toHaveCount(0)

        const m = (await page.evaluate(MEASURE)) as Measurement
        assertMeasurable(m, path)
        expect(
          m.overflow,
          `${path} tràn ngang ${m.overflow}px ở khổ ${width}. Thủ phạm:\n  ${m.culprits.join('\n  ')}`,
        ).toBeLessThanOrEqual(1)
      })
    }
  })
}

test.describe('phép đo tự nó phải bắt được lỗi', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  /**
   * Đối chứng âm. Một bài test bố cục không thể tự chứng minh nó đang canh gác thứ gì:
   * nếu phép đo nhìn nhầm chỗ, MỌI test ở trên vẫn xanh trong khi giao diện vỡ tan
   * (đúng lỗi đã mắc: đo documentElement thay vì <main>). Nên chèn một khối rộng 2000px
   * và bắt buộc phép đo phải phát hiện — nếu test này hỏng thì cả tệp là vô giá trị.
   */
  test('chèn khối 2000px vào main thì phép đo phải phát hiện', async ({ page }) => {
    await gotoAs(page, 'ADMIN', '/v2/admin/users')
    const before = (await page.evaluate(MEASURE)) as Measurement
    assertMeasurable(before, '/v2/admin/users')
    expect(before.overflow).toBeLessThanOrEqual(1)

    await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'e2e-overflow-probe'
      probe.style.width = '2000px'
      probe.style.height = '10px'
      document.querySelector('main')?.appendChild(probe)
    })

    const after = (await page.evaluate(MEASURE)) as Measurement
    expect(after.overflow).toBeGreaterThan(1000)
    expect(after.culprits.join(' ')).toContain('e2e-overflow-probe')
  })
})

test.describe('desktop giữ nguyên (giao ước: >=1024px không đổi một pixel)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('GaPageHdr giữ đúng px-[52px] · pt-9 · h1 36px', async ({ page }) => {
    await gotoAs(page, 'ADMIN', '/v2/admin/users')
    const hdr = page.locator('header').filter({ hasText: 'Quản lý người dùng' })
    await expect(hdr).toHaveCSS('padding-left', '52px')
    await expect(hdr).toHaveCSS('padding-top', '36px')
    await expect(hdr).toHaveCSS('padding-bottom', '26px')
    await expect(hdr.locator('h1')).toHaveCSS('font-size', '36px')
  })

  test('dải KPI vẫn đủ 4 cột (biến CSS --ga-*-cols phải được Tailwind sinh ra)', async ({ page }) => {
    await gotoAs(page, 'ADMIN', '/v2/admin/users')
    // Dải 4 ô chỉ tiêu ngay dưới header; nếu class arbitrary property bị JIT bỏ sót thì
    // grid-template-columns tụt về 1 track và lỗi này KHÔNG nhìn ra bằng mắt trên desktop.
    const tracks = await page.evaluate(() => {
      const strip = Array.from(document.querySelectorAll('div.grid')).find(
        (el) => el.children.length === 4 && /border/.test(el.className),
      )
      return strip ? getComputedStyle(strip).gridTemplateColumns.trim().split(/\s+/).length : 0
    })
    expect(tracks).toBe(4)
  })
})
