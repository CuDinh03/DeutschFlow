import { test, expect, type Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens';

/**
 * E2E: cách xem "Danh sách" và trạng thái rỗng của /v2/student/roadmap.
 *
 * Tệp này trước đây trỏ vào `/student/roadmap` (v1) và có 3 test. Chỉ 1 test được port; 2 test
 * kia BỊ XOÁ vì chúng kiểm thử một mô hình dữ liệu đã không còn tồn tại, chứ không phải một
 * trang chỉ đổi địa chỉ:
 *
 *   · "roadmap creation status and learned node progress" — đọc `GET /skill-tree/me` (node
 *     CORE_TRUNK/SATELLITE_LEAF, %, "1 / 2"). Lộ trình /v2 KHÔNG có nguồn này: trang đọc DUY NHẤT
 *     `GET /roadmap/me`. Trục "cây kỹ năng" của v1 không có đối ứng để port sang.
 *   · "unlock job slow before completing" — bấm mở khoá node vệ tinh qua `POST /skill-tree/{id}/unlock`
 *     rồi poll `/async-jobs/{id}`. Luồng mở khoá bằng AI này không tồn tại trên /v2.
 *
 * S-03 (Wave 1) bỏ BA tab ngang hàng (Cây học tập · Bài học · Giai đoạn) — ba mental model cạnh
 * tranh — và thay bằng MỘT segmented control `Cây | Danh sách` chỉ đổi CÁCH NHÌN trên cùng một
 * dữ liệu:
 *
 *   · Cây là representation chính trên desktop — phủ riêng và kỹ ở `roadmap-tree.spec.ts`.
 *   · Danh sách là bản thay thế ACCESSIBLE của cùng `GET /roadmap/me`, và là mặc định dưới 768px.
 *   · "Giai đoạn" không còn là tab: ngữ cảnh phase được hấp thụ vào header của màn.
 *
 * Tệp này giữ phần còn lại của hợp đồng trang: cách xem danh sách và trạng thái rỗng.
 */

const STUDENT_ME = {
  displayName: 'Test Student',
  role: 'STUDENT',
  userId: 1,
  email: 'student@test.com',
  learningTargetLevel: 'A1',
};

function node(day: number, state: 'completed' | 'current' | 'locked') {
  return {
    id: 100 + day,
    code: `D${String(day).padStart(2, '0')}`,
    title: `Tag ${day}`,
    subtitle: `Ngày ${day}`,
    emoji: '📘',
    state,
    xpReward: 100,
    lessonsTotal: 3,
    lessonsCompleted: state === 'completed' ? 3 : state === 'current' ? 1 : 0,
    cefrLevel: 'A1',
    description: `Bài ngày ${day}`,
    dayNumber: day,
    weekNumber: Math.ceil(day / 5),
    progressStatus: state === 'completed' ? 'COMPLETED' : state === 'locked' ? 'LOCKED' : 'IN_PROGRESS',
    skillCounts: { HOEREN: 3, SPRECHEN: 2, LESEN: 2, SCHREIBEN: 2 },
  };
}

/** Catch-all trước, route cụ thể sau — Playwright ưu tiên route đăng ký SAU. */
async function mockRoadmap(page: Page, nodes: unknown[]) {
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
      body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }),
    }),
  );
  await page.route('**/api/roadmap/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nodes) }),
  );
}

test.describe('Lộ trình học viên (/v2)', () => {
  // Giá trị mặc định của segmented PHỤ THUỘC khổ màn (desktop → Cây, <768px → Danh sách), nên
  // viewport phải khai RÕ ở đây thay vì dựa vào mặc định của Playwright.
  test.use({ viewport: { width: 1280, height: 720 } });

  test('backend không trả node nào thì báo lộ trình rỗng và không mời đổi cách xem', async ({ page }) => {
    await mockRoadmap(page, []);
    await page.goto('/v2/student/roadmap');

    await expect(page.getByText('Chưa có bài học nào')).toBeVisible();
    await expect(
      page.getByText('Hoàn thành phần khảo sát đầu vào để nhận lộ trình cá nhân hoá.'),
    ).toBeVisible();

    // Không có node thì không có gì để nhìn theo hai cách — segmented control phải vắng mặt,
    // chứ không phải hiện ra rồi dẫn vào một khung rỗng thứ hai.
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('cách xem "Danh sách" liệt kê node kèm tiến độ và hai cửa vào bài', async ({ page }) => {
    await mockRoadmap(page, [node(1, 'completed'), node(2, 'current'), node(3, 'locked')]);
    await page.goto('/v2/student/roadmap');

    await page.getByRole('tab', { name: 'Danh sách', exact: true }).click();

    await expect(page.getByText('Ngày 1', { exact: true })).toBeVisible();
    await expect(page.getByText('3/3 bài')).toBeVisible();
    await expect(page.getByText('1/3 bài')).toBeVisible();

    // Node đã mở có cả hai cửa; node khoá không mời học.
    await expect(page.getByRole('link', { name: /Học lại/ })).toHaveAttribute(
      'href',
      /\/v2\/student\/learn\/101\/?$/,
    );
    await expect(page.getByRole('link', { name: 'Luyện 4 kỹ năng' })).toHaveCount(2);

    // Compact overview của mobile vẫn nằm trong DOM ở desktop (`md:hidden`) và dùng CHUNG nhãn
    // "Chưa mở" với badge của danh sách → phải bám vào phần tử ĐANG HIỆN, nếu không sẽ dính
    // strict-mode vì hai kết quả.
    await expect(page.getByText('Chưa mở').filter({ visible: true })).toHaveCount(1);
    // Node khoá nói rõ ĐIỀU KIỆN MỞ bằng câu chữ, không chỉ một ổ khoá (plan S-03).
    await expect(page.getByText('Hoàn thành «Ngày 2» để mở chặng này.')).toBeVisible();
  });
});
