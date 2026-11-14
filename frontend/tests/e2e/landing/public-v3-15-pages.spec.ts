import { test, expect, type Page } from '@playwright/test'

/**
 * E2E — Nghiệm thu hệ thống thiết kế Warm Modern German EdTech v3.4 trên đủ 15 nhóm trang công khai trước đăng nhập.
 *
 * Chạy với server tuỳ cổng:
 *   E2E_BASE_URL=http://localhost:3105 npx playwright test tests/e2e/landing/public-v3-15-pages.spec.ts
 */

const BASE_URL = process.env.E2E_BASE_URL
if (BASE_URL) test.use({ baseURL: BASE_URL })

const PUBLIC_ROUTES: { id: string; path: string }[] = [
  { id: '01-home', path: '/' },
  { id: '02-interview-hub', path: '/phong-van/' },
  { id: '04-exam-hub', path: '/luyen-thi/' },
  { id: '05-telc-b1', path: '/luyen-thi/telc-b1/' },
  { id: '06-free-grade', path: '/free-grade/' },
  { id: '07-pricing', path: '/chi-phi/' },
  { id: '08-b2b-schools', path: '/trung-tam/' },
  { id: '09-guide-index', path: '/cam-nang/' },
  { id: '10-guide-article', path: '/cam-nang/phong-van-tieng-duc-nghe-bep/' },
  { id: '11-what-is', path: '/mydeutschflow-la-gi/' },
  { id: '12-about', path: '/about/' },
  { id: '13-ausbildung-preview', path: '/hoc-nghe/?ban-nhap=1' },
  { id: '14a-privacy', path: '/privacy/' },
  { id: '14b-terms', path: '/terms/' },
  { id: '14c-support', path: '/support/' },
  { id: '14d-not-found', path: '/duong-dan-khong-ton-tai-404/' },
  { id: '15a-login', path: '/v2/login' },
  { id: '15b-register', path: '/v2/register' },
]

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    const diff = doc.scrollWidth - doc.clientWidth
    if (diff <= 1) return null
    const culprits: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const rect = el.getBoundingClientRect()
      if (rect.right > doc.clientWidth + 1) {
        culprits.push(`${el.tagName.toLowerCase()}.${el.className} (right=${Math.round(rect.right)} > ${doc.clientWidth})`)
        if (culprits.length >= 5) break
      }
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, culprits }
  })
  expect(overflow, `Tràn ngang tại ${label}`).toBeNull()
}

test.describe('Public v3.4 — 390px iPhone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const route of PUBLIC_ROUTES) {
    test(`${route.id} (${route.path}) không tràn ngang và có đúng 1 thẻ h1`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await assertNoHorizontalOverflow(page, `${route.path} @ 390px`)
      await expect(page.locator('h1')).toHaveCount(1)
    })
  }

  test('Floating Sheet menu (#ga-mobile-menu) mở gọn, đồng bộ nhận diện và có App Store id6785281013', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const menuTrigger = page.locator('header button[aria-controls="ga-mobile-menu"]')
    await expect(menuTrigger).toBeVisible()
    await menuTrigger.click()

    const sheet = page.locator('#ga-mobile-menu .md-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.locator('a[href*="6785281013"]')).toBeVisible()
    await assertNoHorizontalOverflow(page, '#ga-mobile-menu open @ 390px')
  })

  test('Trang /v2/verify-email: 6 ô OTP nằm gọn trong khung 390px và dán chuỗi có khoảng trắng hoạt động đúng', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        'df.pendingSignup',
        JSON.stringify({
          email: 'hocvien@example.com',
          expiresInSeconds: 600,
          resendCooldownSeconds: 0,
        }),
      )
    })
    await page.goto('/v2/verify-email', { waitUntil: 'domcontentloaded' })
    await assertNoHorizontalOverflow(page, '/v2/verify-email @ 390px')

    const inputs = page.locator('.ga-otp-grid input')
    await expect(inputs).toHaveCount(6)

    const fitsInParent = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.ga-otp-grid')
      const card = grid?.closest('form')
      if (!grid || !card) return false
      return grid.getBoundingClientRect().right <= card.getBoundingClientRect().right + 1
    })
    expect(fitsInParent).toBe(true)

    await inputs.first().focus()
    await page.evaluate(() => {
      const first = document.querySelector<HTMLInputElement>('.ga-otp-grid input')
      if (!first) return
      const dt = new DataTransfer()
      dt.setData('text/plain', '482 913')
      first.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })

    const values = await inputs.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
    expect(values).toEqual(['4', '8', '2', '9', '1', '3'])
  })
})

test.describe('Public v3.4 — Desktop 1280px & 1440px brand contract', () => {
  for (const width of [1280, 1440]) {
    test(`Trang chủ @ ${width}px: chữ Flow luôn đỏ trên cả header sáng & footer tối, không tràn ngang`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await assertNoHorizontalOverflow(page, `/ @ ${width}px`)

      // Kiểm tra chữ Flow giữ màu đỏ thương hiệu rgb(227, 38, 29) trên cả header và footer
      const flowColors = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll<HTMLElement>('header span, footer span')).filter(
          (el) => el.textContent === 'Flow',
        )
        return spans.map((el) => window.getComputedStyle(el).color)
      })
      expect(flowColors.length).toBeGreaterThanOrEqual(2)
      for (const c of flowColors) {
        expect(c).toBe('rgb(227, 38, 29)')
      }

      // Nút App Store id6785281013 hiện diện ở cả header xl và footer
      await expect(page.locator('header a[href*="6785281013"]')).toBeVisible()
      await expect(page.locator('footer a[href*="6785281013"]')).toBeVisible()
    })
  }
})
