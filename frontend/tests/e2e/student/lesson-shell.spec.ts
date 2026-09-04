import { test, expect, type Page } from '@playwright/test';
import { mockPracticeRunner, NODE_ID, EXERCISES } from '../../helpers/practiceSession';
import { mockLearnNode, LEARN_NODE_ID } from '../../helpers/learnNode';

/**
 * S-04 / B-17 — đo trước, dựng sau.
 *
 * B-13 đã dạy một bài đắt: engine THI trông như có lưu bài, thực ra không ghi gì cho tới `/finish`,
 * và nút "Tiếp tục" cấp lại đồng hồ đầy. Runner LUYỆN ở đây có cùng hình dạng đáng ngờ — `answers`
 * chỉ nằm trong `useState`, không `localStorage`, không `beforeunload` — nên phải ĐO chứ không suy.
 *
 * AC-2 của S-04 nói thẳng: "Thoát giữa chừng: 0 trường hợp mất dữ liệu đã nhập (test có kịch bản)".
 * Đây là kịch bản đó.
 */

const RUNNER = `/v2/student/practice/${NODE_ID}/lesen`;

const option = (page: Page, exerciseIdx: number, optionIdx = 0) =>
  page.getByRole('button', { name: new RegExp(EXERCISES[exerciseIdx].options[optionIdx]) });

/** Một câu đã trả lời thì mọi phương án của nó bị disabled — đó là dấu vết duy nhất còn đọc được. */
async function answeredCount(page: Page): Promise<number> {
  let n = 0;
  for (let i = 0; i < EXERCISES.length; i += 1) {
    if (await option(page, i).isDisabled()) n += 1;
  }
  return n;
}

test.describe('Runner luyện tập — giữ bài khi rời trang (S-04 AC-2)', () => {
  test('trả lời rồi TẢI LẠI: bài đã làm phải còn', async ({ page }) => {
    await mockPracticeRunner(page);
    await page.goto(RUNNER);

    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });
    await option(page, 0).click();
    await option(page, 1).click();
    expect(await answeredCount(page)).toBe(2); // đối chứng dương: phép đo có bắt được trạng thái

    await page.reload();
    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });

    expect(await answeredCount(page)).toBe(2);
  });

  test('trả lời rồi ĐI CHỖ KHÁC và quay lại: bài đã làm phải còn', async ({ page }) => {
    await mockPracticeRunner(page);
    await page.goto(RUNNER);

    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });
    await option(page, 0).click();
    expect(await answeredCount(page)).toBe(1);

    await page.goto(`/v2/student/practice/${NODE_ID}`);
    await page.goto(RUNNER);
    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });

    expect(await answeredCount(page)).toBe(1);
  });

  test('bài đã làm được ghi xuống thiết bị, không chỉ nằm trong bộ nhớ trang', async ({ page }) => {
    await mockPracticeRunner(page);
    await page.goto(RUNNER);
    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });

    const before = await page.evaluate(() => JSON.stringify(window.localStorage));
    await option(page, 0).click();
    const after = await page.evaluate(() => JSON.stringify(window.localStorage));

    expect(after).not.toBe(before);
  });
});

test.describe('LessonShell — một vỏ, hai chế độ (S-04 AC-1)', () => {
  test('bài LUYỆN: vỏ có thoát · tiến độ theo bước · segmented Học|Luyện', async ({ page }) => {
    await mockPracticeRunner(page);
    await page.goto(RUNNER);
    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole('button', { name: 'Thoát' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Luyện' })).toHaveAttribute('aria-selected', 'true');

    // Runner CŨ không báo tiến độ gì cả — nút nộp chỉ hiện khi đã trả lời hết.
    // Trang luyện có HAI progressbar sau merge Lernbaum: thanh của vỏ + dải lá LeafProgress.
    // Spec này canh HỢP ĐỒNG CỦA VỎ nên trỏ đích danh thanh 'Tiến độ bài'.
    const bar = page.getByRole('progressbar', { name: 'Tiến độ bài' });
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByText(`Bước 0/${EXERCISES.length}`)).toBeVisible();

    await option(page, 0).click();
    await expect(bar).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByText(`Bước 1/${EXERCISES.length}`)).toBeVisible();
  });

  test('bài LUYỆN: nhãn nháp nêu ĐÚNG phạm vi — trên thiết bị này, không nói trống không', async ({
    page,
  }) => {
    await mockPracticeRunner(page);
    await page.goto(RUNNER);
    await expect(option(page, 0)).toBeVisible({ timeout: 30_000 });

    await option(page, 0).click();
    await expect(page.getByText(/trên thiết bị này/)).toBeVisible();
  });

  test('bài HỌC: vỏ mang chương · mục tiêu · thời lượng · tiến độ, và segmented ở chế độ Học', async ({
    page,
  }) => {
    await mockLearnNode(page);
    await page.goto(`/v2/student/learn/${LEARN_NODE_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Nói về công việc' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Module 8 · Công việc và nghề nghiệp')).toBeVisible();
    await expect(page.getByText('Nói về công việc hằng ngày')).toBeVisible();
    await expect(page.getByText('~12 phút')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Học' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('progressbar', { name: 'Tiến độ bài' })).toBeVisible();
  });

  test('bài HỌC: thiếu thời lượng/mục tiêu thì BỎ HẲN ô, không in ô rỗng', async ({ page }) => {
    await mockLearnNode(page, { estimatedMinutes: null, overviewVi: null });
    await page.goto(`/v2/student/learn/${LEARN_NODE_ID}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Nói về công việc' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/phút/)).toHaveCount(0);
    await expect(page.getByText('Mục tiêu:')).toHaveCount(0);
  });

  test('segmented đưa từ bài HỌC sang bài LUYỆN của cùng node', async ({ page }) => {
    await mockLearnNode(page);
    await page.goto(`/v2/student/learn/${LEARN_NODE_ID}`);
    await expect(page.getByRole('tab', { name: 'Luyện' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('tab', { name: 'Luyện' }).click();
    await expect(page).toHaveURL(new RegExp(`/v2/student/practice/${LEARN_NODE_ID}/?$`));
  });
});
