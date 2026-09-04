import { test, expect } from '@playwright/test';
import { mockSpeaking } from '../helpers/speakingSession';

/**
 * E2E: chọn nhân vật → tạo phiên → vào engine hội thoại, trên bề mặt /v2.
 *
 * Port từ `/speaking` → `/v2/student/speaking/setup`, `/speaking/chat` → `/v2/student/speaking/live`.
 * Hai trang v2 này TÁI DÙNG đúng <CompanionSelect> / <SpeakingChatExperience> của v1, chỉ tiêm
 * route v2, nên hợp đồng người dùng giữ nguyên 1:1 — port là đúng việc, không phải viết mới.
 *
 * Bộ mock đã dời sang `tests/helpers/speakingSession.ts` để spec bố cục Studio (lô 4 của S-07)
 * dùng chung, thay vì hai spec giữ hai bản mock rồi trôi khỏi nhau. Hai chỗ bản v1 mock SAI mà vẫn
 * "xanh" nhờ catch-all nuốt lỗi đã được ghi lại trong helper đó.
 */

test.describe('Luồng luyện nói (/v2)', () => {
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
