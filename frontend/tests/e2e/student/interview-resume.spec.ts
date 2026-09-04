import { test, expect, type Page } from '@playwright/test';
import { mockSpeaking } from '../../helpers/speakingSession';

/**
 * S-06 AC-2 (nửa UI) — phiên phỏng vấn dở phải quay lại được.
 *
 * Dữ liệu chưa bao giờ mất: backend ghi từng lượt ngay khi nó hoàn tất (verify ở B-15). Cái thiếu
 * là ĐƯỜNG QUAY LẠI — engine đọc phiên từ `useChatStore` và trước lô này không màn nào nạp lại
 * store cho một phiên cũ, nên phiên dở là ngõ cụt.
 *
 * Phép đo quan trọng nhất ở đây KHÔNG phải "URL đã đổi" mà là **lịch sử có mặt trong phòng**: một
 * cú `router.push` mù cũng làm URL đổi, rồi engine thấy store rỗng và đá ngược về màn setup.
 */

const SESSION_ID = 7788;

const INCOMPLETE_SESSION = {
  id: SESSION_ID,
  topic: 'Bewerbungsgespräch',
  cefrLevel: 'B1',
  persona: 'LUKAS',
  responseSchema: 'V1',
  sessionMode: 'INTERVIEW',
  status: 'IN_PROGRESS', // dây thật của API — KHÔNG phải tên enum ACTIVE/ENDED của backend
  startedAt: '2026-08-28T09:00:00',
  lastActivityAt: '2026-08-28T09:12:00',
  endedAt: null,
  messageCount: 3,
  interviewPosition: 'Backend Entwickler',
  experienceLevel: '1-2Y',
};

const HISTORY = [
  {
    id: 1,
    role: 'ASSISTANT',
    userText: null,
    aiSpeechDe: 'Guten Tag! Erzählen Sie kurz von sich.',
    correction: null,
    explanationVi: '',
    grammarPoint: null,
    createdAt: '2026-08-28T09:00:05',
    errors: [],
  },
  {
    id: 2,
    role: 'USER',
    userText: 'Ich habe drei Jahre als Entwickler gearbeitet.',
    aiSpeechDe: null,
    correction: null,
    explanationVi: null,
    grammarPoint: null,
    createdAt: '2026-08-28T09:01:00',
    errors: [],
  },
  {
    id: 3,
    role: 'ASSISTANT',
    userText: null,
    aiSpeechDe: 'Interessant. Welche Sprachen nutzen Sie?',
    correction: null,
    explanationVi: '',
    grammarPoint: null,
    assistantFeedback: 'Rõ ràng.',
    createdAt: '2026-08-28T09:01:10',
    errors: [],
  },
];

async function mockInterviewHub(page: Page, sessions: unknown[] = [INCOMPLETE_SESSION]) {
  await mockSpeaking(page);
  // Đăng ký SAU bộ mock chung: Playwright ưu tiên route đăng ký sau.
  await page.route(/\/api\/ai-speaking\/sessions(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: sessions }),
    });
  });
  await page.route(`**/api/ai-speaking/sessions/${SESSION_ID}/messages`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HISTORY) }),
  );
}

test.describe('Phỏng vấn dở — nút "Tiếp tục" (S-06 AC-2)', () => {
  test('mở lại phiên và mang theo NGUYÊN lịch sử vào phòng', async ({ page }) => {
    await mockInterviewHub(page);

    await page.goto('/v2/student/interviews');
    await expect(page.getByText('Backend Entwickler')).toBeVisible();

    await page.getByRole('button', { name: 'Tiếp tục phiên' }).click();

    await expect(page).toHaveURL(/\/v2\/student\/speaking\/live/, { timeout: 30_000 });
    // Engine KHÔNG đá ngược về setup — nghĩa là store đã có selectedCompanion.
    await expect(page).not.toHaveURL(/\/setup/);
    // Và lịch sử thật sự có mặt, không phải một phòng trống.
    await expect(page.getByText('Guten Tag! Erzählen Sie kurz von sich.')).toBeVisible();
    await expect(page.getByText('Ich habe drei Jahre als Entwickler gearbeitet.')).toBeVisible();
    await expect(page.getByText('Welche Sprachen nutzen Sie?')).toBeVisible();
  });

  test('phiên ĐÃ hoàn tất thì không mời tiếp tục', async ({ page }) => {
    await mockInterviewHub(page, [{ ...INCOMPLETE_SESSION, status: 'COMPLETED' }]);

    await page.goto('/v2/student/interviews');
    await expect(page.getByText('Backend Entwickler')).toBeVisible(); // đối chứng dương
    await expect(page.getByRole('button', { name: 'Tiếp tục phiên' })).toHaveCount(0);
  });

  test('nhân vật lạ thì báo rõ thay vì mở một phòng sai người', async ({ page }) => {
    await mockInterviewHub(page, [{ ...INCOMPLETE_SESSION, persona: 'NGUOI_LA' }]);

    await page.goto('/v2/student/interviews');
    await page.getByRole('button', { name: 'Tiếp tục phiên' }).click();

    // Lọc theo visible: Next tự chèn một `role="alert"` rỗng (`__next-route-announcer__`), nên
    // `getByRole('alert')` trần luôn ra 2 kết quả và vấp strict mode.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Không nhận ra người phỏng vấn' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/v2\/student\/interviews/);
  });
});
