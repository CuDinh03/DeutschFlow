import { test, expect, type Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../helpers/tokens';

/**
 * E2E: gói cước / hạn mức và vòng ôn tập SRS — trên bề mặt /v2.
 *
 * Trước đây tệp này trỏ vào cây v1 (`/student/interviews`, `/student/pricing`,
 * `/student/vocabulary`, `/payment/success`). Đã port sang /v2 và bỏ phần kiểm thử tính năng
 * ĐÃ GỠ KHỎI SẢN PHẨM — xem ghi chú ở từng describe.
 *
 * Bản đồ port:
 *   /student/interviews → /v2/student/interviews   (giữ nguyên hợp đồng: badge hạn mức FREE)
 *   /student/pricing    → /v2/payment              (2 gói, KHÔNG còn nút MoMo)
 *   /student/vocabulary → /v2/student/review        (thẻ FSRS thật: /srs/due + /srs/review)
 */

const STUDENT_ME = {
  displayName: 'E2E Student',
  role: 'STUDENT',
  userId: 1,
  email: 'e2e@test.com',
  learningTargetLevel: 'A1',
};

/**
 * Catch-all PHẢI đăng ký trước: Playwright ưu tiên route đăng ký SAU, nên route cụ thể bên dưới
 * mới đè được nó. Đăng ký ngược lại thì catch-all nuốt hết và trang mất dữ liệu.
 */
async function mockSession(page: Page, planCode: 'FREE' | 'PRO' = 'FREE') {
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...studentCookies(),
  ]);
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN);

  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDENT_ME) }),
  );
  await page.route('**/api/auth/me/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ planCode, tier: planCode }),
    }),
  );
}

// ─── Hạn mức phỏng vấn theo gói ────────────────────────────────────────────

test.describe('Hạn mức phỏng vấn (/v2/student/interviews)', () => {
  /** `useAiSpeakingQuota` đọc GET /ai-speaking/quota; trang đọc GET /ai-speaking/sessions. */
  async function mockInterviews(page: Page, planCode: 'FREE' | 'PRO') {
    await mockSession(page, planCode);
    await page.route('**/api/ai-speaking/quota', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Đúng DTO AiSpeakingQuota (canStartSession · remainingSpendable · planCode). Bản v1 mock
        // ra {weeklyUsed, weeklyLimit, blocked} — những trường KHÔNG có trong hợp đồng; mock sai
        // hình vẫn "chạy được" chỉ vì trang chỉ đọc planCode, nhưng nó che mất mọi thay đổi DTO.
        body: JSON.stringify({
          canStartSession: true,
          remainingSpendable: planCode === 'FREE' ? 3 : 100_000,
          planCode,
        }),
      }),
    );
    await page.route('**/api/ai-speaking/sessions**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  }

  test('gói FREE thấy badge hạn mức tuần', async ({ page }) => {
    await mockInterviews(page, 'FREE');
    await page.goto('/v2/student/interviews');

    await expect(page.getByRole('heading', { name: 'Kết quả phỏng vấn' })).toBeVisible();
    await expect(page.getByText('0/3 tuần này')).toBeVisible();
  });

  test('gói PRO không thấy badge hạn mức', async ({ page }) => {
    await mockInterviews(page, 'PRO');
    await page.goto('/v2/student/interviews');

    // Neo khẳng định TRƯỚC khi phủ định: một trang không render gì cũng "không có badge",
    // nên nếu thiếu bước này thì test vẫn xanh kể cả khi trang vỡ. Bản v1 chính là như vậy.
    await expect(page.getByRole('heading', { name: 'Kết quả phỏng vấn' })).toBeVisible();
    await expect(page.getByText('0 phiên phỏng vấn')).toBeVisible();
    await expect(page.getByText(/tuần này/)).toHaveCount(0);
  });
});

// ─── Trang gói cước ────────────────────────────────────────────────────────

/**
 * ĐÃ XOÁ khỏi tệp này (KHÔNG port): hai test "3 thẻ gói (FREE/PRO/ULTRA)" và "bấm nâng cấp PRO gọi
 * MoMo create-order rồi chuyển tới payUrl". Cả hai kiểm thử hành vi ĐÃ BỊ GỠ CÓ CHỦ Ý khỏi sản
 * phẩm, không phải hành vi bị chuyển sang route mới:
 *   · ULTRA đã hoãn — v1.0 chỉ còn FREE + PRO (đúng ở CẢ trang v1 lẫn /v2/payment).
 *   · MoMo/Stripe đã gỡ theo quyết định billing đã chốt (SePay là kênh VN, ship ở v1.1); nút gói
 *     trả phí giờ là CTA "Sắp ra mắt" bị disable, không có lệnh gọi tạo đơn nào để bắt.
 * Port chúng đồng nghĩa viết test cho tính năng không tồn tại. Thay bằng một test khoá đúng hợp
 * đồng hiện tại của trang.
 *
 * CŨNG ĐÃ XOÁ — và đây là test ĐANG XANH, nên ghi rõ để rà lại được: "Payment success page syncs
 * order and shows success state" (`/payment/success?orderId=…` → POST /payments/momo/sync-order).
 * Trang `/payment/success` nằm trong cây v1 sắp xoá, KHÔNG có bản /v2, và không có MỘT liên kết
 * nào trỏ tới nó trong toàn bộ `src/` — lối vào duy nhất là cú redirect trở về từ MoMo, tức đúng
 * kênh đã hoãn. Nó xanh vì mock dựng lại được một luồng không ai tới được nữa. Nếu SePay/MoMo bật
 * lại ở v1.1 thì viết mới trên bề mặt /v2 chứ không hồi sinh test này.
 */
test.describe('Trang gói cước (/v2/payment)', () => {
  test('hiện đúng 2 gói và CTA trả phí đang chờ SePay', async ({ page }) => {
    await mockSession(page, 'FREE');
    await page.goto('/v2/payment');

    await expect(page.getByRole('heading', { name: 'Nâng cấp gói' })).toBeVisible();

    // v1.0: FREE + PRO. ULTRA đã hoãn — nếu thêm gói thứ ba thì phải sửa test này CÓ Ý THỨC.
    await expect(page.getByText('Miễn phí', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pro', { exact: true })).toBeVisible();
    await expect(page.getByText('299.000₫')).toBeVisible();

    // Chưa có thanh toán tự phục vụ: CTA gói trả phí phải bị vô hiệu hoá, không dẫn đi đâu cả.
    const paidCta = page.getByRole('button', { name: 'Sắp ra mắt' });
    await expect(paidCta).toBeVisible();
    await expect(paidCta).toBeDisabled();
    await expect(page.getByText('Thanh toán qua SePay sẽ sớm có mặt.')).toBeVisible();
  });
});

// ─── Vòng ôn tập SRS ───────────────────────────────────────────────────────

/**
 * `/student/vocabulary` (v1) trộn danh sách từ với thẻ ôn. Trên /v2 hai thứ tách hẳn:
 * `/v2/student/vocabulary` là DANH SÁCH từ (GET /words), còn vòng ôn FSRS nằm ở
 * `/v2/student/review` (GET /srs/due → POST /srs/review) — đó mới là đích port đúng.
 */
test.describe('Vòng ôn tập SRS (/v2/student/review)', () => {
  const DUE_CARDS = [
    {
      id: 1,
      vocabId: 'vocab-hund',
      german: 'der Hund',
      meaning: 'con chó',
      exampleDe: 'Der Hund bellt.',
      speakDe: 'der Hund',
      repetitions: 2,
      nextReviewAt: new Date().toISOString(),
    },
  ];

  test('tải thẻ tới hạn, lật thẻ và chấm điểm gửi đúng payload', async ({ page }) => {
    await mockSession(page, 'FREE');
    await page.route('**/api/srs/due', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DUE_CARDS) }),
    );
    await page.route('**/api/review-tasks/me/today', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tasks: [], lockedCount: 0 }),
      }),
    );

    let reviewBody: Record<string, unknown> = {};
    await page.route('**/api/srs/review', async (route) => {
      reviewBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextDue: new Date(Date.now() + 86400000).toISOString(), xpEarned: 5 }),
      });
    });

    await page.goto('/v2/student/review');

    // Mặt trước: chỉ có từ tiếng Đức, chưa lộ nghĩa.
    await expect(page.getByText('der Hund', { exact: true })).toBeVisible();
    await expect(page.getByText('con chó')).toHaveCount(0);

    await page.getByRole('button', { name: 'Hiện nghĩa' }).click();
    await expect(page.getByText('con chó')).toBeVisible();

    // Chấm "Tốt" → quality 4 theo bảng map GRADES của trang.
    await page.getByRole('button', { name: 'Tốt' }).click();

    await expect.poll(() => reviewBody.vocabId).toBe('vocab-hund');
    expect(reviewBody.quality).toBe(4);

    // Hết thẻ → màn hình tổng kết.
    await expect(page.getByText('Đã ôn xong 1 thẻ!')).toBeVisible();
  });

  test('hàng đợi rỗng thì báo không còn thẻ', async ({ page }) => {
    await mockSession(page, 'FREE');
    await page.route('**/api/srs/due', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/api/review-tasks/me/today', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tasks: [], lockedCount: 0 }),
      }),
    );

    await page.goto('/v2/student/review');

    await expect(page.getByText('Không có thẻ nào cần ôn')).toBeVisible();
  });
});
