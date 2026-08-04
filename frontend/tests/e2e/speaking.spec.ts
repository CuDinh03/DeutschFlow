import { test, expect, type Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../helpers/tokens';

/**
 * E2E: chọn nhân vật → tạo phiên → vào engine hội thoại, trên bề mặt /v2.
 *
 * Port từ `/speaking` → `/v2/student/speaking/setup`, `/speaking/chat` → `/v2/student/speaking/live`.
 * Hai trang v2 này TÁI DÙNG đúng <CompanionSelect> / <SpeakingChatExperience> của v1, chỉ tiêm
 * route v2, nên hợp đồng người dùng giữ nguyên 1:1 — port là đúng việc, không phải viết mới.
 *
 * Hai chỗ bản v1 mock SAI mà vẫn "xanh" nhờ catch-all `**\/api\/**` nuốt lỗi, nay sửa hẳn:
 *   · Danh sách nhân vật KHÔNG đến từ API. Nó là hằng số PERSONA_LIST trong `src/lib/personas.ts`
 *     (nhóm mặc định 'it': Lukas · Emma · Anna · Klaus). Mock `/speaking-sessions/personas` là
 *     mock vào hư không — đó là lý do test cũ mock ra Klaus/Anna rồi lại đi tìm "Lukas".
 *   · Endpoint tạo phiên là POST `/ai-speaking/sessions`, KHÔNG phải `/speaking-sessions`.
 */

const STUDENT_ME = {
  displayName: 'Test Student',
  role: 'STUDENT',
  userId: 1,
  email: 'student@test.com',
  learningTargetLevel: 'A1',
};

const SESSION = {
  id: 4242,
  topic: 'Alltag',
  cefrLevel: 'B1',
  persona: 'LUKAS',
  responseSchema: 'V1',
  sessionMode: 'COMMUNICATION',
  status: 'ACTIVE',
  startedAt: new Date().toISOString(),
  lastActivityAt: null,
  turns: [],
};

test.describe('Luồng luyện nói (/v2)', () => {
  /** Trả về body của lệnh POST tạo phiên để test khẳng định đúng nhân vật được gửi lên. */
  async function mockSpeaking(page: Page): Promise<{ read: () => Record<string, unknown> }> {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...studentCookies(),
    ]);
    await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN);

    // Catch-all trước, route cụ thể sau (Playwright ưu tiên route đăng ký sau).
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
        body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }),
      }),
    );
    // Hạn mức phải còn: nút bắt đầu bị disable khi quotaLoading hoặc quotaBlocked.
    await page.route('**/api/ai-speaking/quota', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ canStartSession: true, remainingSpendable: 100000, planCode: 'PRO' }),
      }),
    );

    let createBody: Record<string, unknown> = {};
    await page.route('**/api/ai-speaking/sessions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      createBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(SESSION),
      });
    });
    await page.route(`**/api/ai-speaking/sessions/${SESSION.id}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }),
    );

    return { read: () => createBody };
  }

  test('chọn nhân vật, tạo phiên và vào được engine hội thoại', async ({ page }) => {
    const created = await mockSpeaking(page);

    await page.goto('/v2/student/speaking/setup');

    // Nhóm mặc định 'it' — Lukas là nhân vật đầu tiên của PERSONA_LIST.
    const lukas = page.getByText('Lukas', { exact: true }).first();
    await expect(lukas).toBeVisible();
    await lukas.click();

    // CTA chỉ hiện sau khi đã chọn nhân vật (isReady) và tắt trạng thái tải hạn mức.
    const start = page.getByRole('button', { name: /Bắt đầu với Lukas/ });
    await expect(start).toBeEnabled();
    await start.click();

    // Ngân sách rộng CÓ CHỦ Ý: `router.push` phải nạp xong route đích trước khi URL đổi, và trên
    // `next dev` lần đầu vào /v2/student/speaking/live là một lượt biên dịch nguội (vài giây).
    // Nút CTA cũng đứng yên ở trạng thái `confirming` suốt lúc đó — `setConfirming(false)` chỉ nằm
    // ở nhánh lỗi — nên "chưa đổi URL" KHÔNG phân biệt được đang biên dịch với đã hỏng.
    await expect(page).toHaveURL(/\/v2\/student\/speaking\/live/, { timeout: 30_000 });

    // Phiên được tạo với ĐÚNG nhân vật đã chọn — nếu chỉ khẳng định URL thì một CTA điều hướng
    // "mù" (không gọi API) vẫn làm test xanh.
    await expect.poll(() => created.read().persona).toBe('LUKAS');
    expect(created.read().sessionMode).toBe('COMMUNICATION');

    // Engine đã mount với phiên vừa nạp vào store, không bị đá ngược về setup.
    await expect(page.getByText('Lukas', { exact: true }).first()).toBeVisible();
  });

  test('vào thẳng engine khi chưa có phiên thì bị đá về trang chọn nhân vật', async ({ page }) => {
    await mockSpeaking(page);

    await page.goto('/v2/student/speaking/live');

    await expect(page).toHaveURL(/\/v2\/student\/speaking\/setup/, { timeout: 30_000 });
  });
});
