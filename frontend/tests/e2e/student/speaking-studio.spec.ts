import { test, expect, type Page } from '@playwright/test';
import {
  mockSpeaking,
  enterSpeakingRoom,
  mockChatTurn,
  sendTypedTurn,
} from '../../helpers/speakingSession';

/**
 * S-07 lô 4 — hợp đồng bố cục Studio.
 *
 * Giữ hai thứ mà chỉ có phép đo trên trình duyệt mới bắt được:
 *  · **Ba vùng ở ≥1280** (ngữ cảnh trái · transcript giữa · phản hồi phải) và việc dải ngữ cảnh
 *    GẬP LẠI ở khổ nhỏ hơn. Đo bằng `toBeInViewport()` chứ không phải `toBeVisible()`: một phần tử
 *    dịch ra ngoài màn hình vẫn "visible" theo DOM (bài học của ngăn kéo nav ở B-06).
 *  · **AC-1: nút nói là phần tử lớn nhất trong phiên.** Đây là toàn bộ lý do tồn tại của lô 2; một
 *    lần đổi class vô ý là nó lặng lẽ quay về bố cục mời-gõ cũ mà không test nào đỏ.
 *
 * Mỗi phép đo có ĐỐI CHỨNG DƯƠNG: khẳng định dải ngữ cảnh CÓ mặt ở 1440 trước, rồi mới khẳng định
 * nó vắng ở 1024 — nếu không, một trang trắng cũng làm test xanh.
 */

const RAIL = 'Bối cảnh phiên';

const rail = (page: Page) => page.getByRole('complementary', { name: RAIL });
const feedbackPanel = (page: Page) => page.locator('#speaking-copilot-panel');
const micButton = (page: Page) => page.getByRole('button', { name: 'Sử dụng giọng nói (STT)' });

async function area(page: Page, locator: ReturnType<typeof micButton>): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('phần tử không có hộp bao — không đo được');
  return box.width * box.height;
}

test.describe('Studio luyện nói — bố cục 3 vùng (S-07)', () => {
  test('ở 1440 có đủ ba vùng: ngữ cảnh trái · transcript giữa · phản hồi phải', async ({ page }) => {
    await mockSpeaking(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);

    await expect(rail(page)).toBeInViewport();
    await expect(page.locator('main').last()).toBeInViewport();
    await expect(feedbackPanel(page)).toBeInViewport();

    // Ba vùng phải xếp NGANG, không phải chồng dọc — trái < giữa < phải theo trục x.
    const railBox = await rail(page).boundingBox();
    const mainBox = await page.locator('main').last().boundingBox();
    const panelBox = await feedbackPanel(page).boundingBox();
    expect(railBox!.x).toBeLessThan(mainBox!.x);
    expect(mainBox!.x).toBeLessThan(panelBox!.x);
  });

  test('dưới 1280 dải ngữ cảnh gập lại, phản hồi vẫn còn (2 vùng)', async ({ page }) => {
    await mockSpeaking(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);
    await expect(rail(page)).toBeInViewport(); // đối chứng dương

    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(rail(page)).not.toBeInViewport();
    await expect(feedbackPanel(page)).toBeInViewport();
  });

  test('ở khổ điện thoại cả hai panel bên đều gập, transcript chiếm trọn', async ({ page }) => {
    await mockSpeaking(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);
    await expect(feedbackPanel(page)).toBeInViewport(); // đối chứng dương

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(rail(page)).not.toBeInViewport();
    await expect(feedbackPanel(page)).not.toBeInViewport();
    await expect(page.locator('main').last()).toBeInViewport();
  });

  test('AC-1: nút nói lớn hơn hẳn đường gõ, ở cả desktop lẫn điện thoại', async ({ page }) => {
    await mockSpeaking(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);

    const typeToggle = page.getByRole('button', { name: 'Gõ thay vì nói' });
    expect(await area(page, micButton(page))).toBeGreaterThan(await area(page, typeToggle));

    await page.setViewportSize({ width: 390, height: 844 });
    const micBox = (await micButton(page).boundingBox())!;
    expect(await area(page, micButton(page))).toBeGreaterThan(await area(page, typeToggle));
    // Vùng chạm tối thiểu của plan §Responsive ở 390.
    expect(Math.min(micBox.width, micBox.height)).toBeGreaterThanOrEqual(44);
  });

  test('chưa nói lượt nào thì vùng phản hồi nói rõ là chưa có gì, không dựng ô rỗng', async ({
    page,
  }) => {
    await mockSpeaking(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);

    await expect(feedbackPanel(page)).toContainText('Phản hồi sẽ xuất hiện ở đây');
    // Không được có ô chiều nào — chưa có lượt nào để chấm.
    await expect(feedbackPanel(page).getByText('Ngữ pháp', { exact: true })).toHaveCount(0);
  });

  test('sau một lượt thật, phản hồi hiện dạng tóm tắt và bằng chứng chỉ mở khi bấm', async ({
    page,
  }) => {
    await mockSpeaking(page);
    await mockChatTurn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);

    await sendTypedTurn(page, 'Gestern ich habe gegangen nach Hause.');

    const panel = feedbackPanel(page);
    // Tóm tắt: có chiều Ngữ pháp và chiều Phù hợp — cả hai đều có nguồn dữ liệu thật ở lượt này.
    await expect(panel.getByText('Ngữ pháp', { exact: true })).toBeVisible();
    await expect(panel.getByText('Phù hợp', { exact: true })).toBeVisible();
    // Chưa chấm phát âm ở lượt gõ ⇒ KHÔNG được dựng chiều phát âm.
    await expect(panel.getByText('Phát âm', { exact: true })).toHaveCount(0);

    // Bằng chứng còn đóng: span sai chưa có mặt.
    await expect(panel.getByText('ich habe gegangen')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Xem bằng chứng' }).first().click();
    await expect(panel.getByText('ich bin gegangen')).toBeVisible();
    await expect(
      panel.getByText('Động từ chuyển động dùng sein, không dùng haben.'),
    ).toBeVisible();
  });

  /**
   * ĐỐI CHỨNG DƯƠNG cho phép chặn gợi ý lúc thu âm — và chỉ có thế.
   *
   * Nhánh thật sự cần canh (mic đang mở ⇒ gợi ý không được bật) KHÔNG đo được ở đây: bật thu âm
   * cần quyền micro + thiết bị media giả, tức phải đổi launch args của Playwright. Nên phép đo này
   * chỉ chứng minh đồng hồ chờ vẫn CHẠY khi rảnh — nếu `!isListening` bị viết hỏng thành một điều
   * kiện luôn-sai, test này đỏ. Đừng đọc tên cũ rồi tưởng nhánh kia đã có người canh.
   */
  test('đồng hồ chờ vẫn bật gợi ý khi người học đứng yên (đối chứng cho phép chặn lúc thu âm)', async ({
    page,
  }) => {
    await mockSpeaking(page);
    await mockChatTurn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterSpeakingRoom(page);
    await sendTypedTurn(page, 'Gestern ich habe gegangen nach Hause.');

    const panel = feedbackPanel(page);
    // Đối chứng dương: để yên đủ lâu thì gợi ý PHẢI hiện (bộ đếm hội thoại = 10s).
    await expect(panel.getByText('Từ vựng', { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
