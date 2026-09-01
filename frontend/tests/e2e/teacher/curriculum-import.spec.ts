import { test, expect, type Page } from '@playwright/test';
import { teacherCookies, TEACHER_TOKEN } from '../../helpers/tokens';

/**
 * Nhập PDF thành kế hoạch giảng dạy — luồng đầy đủ với backend giả lập.
 *
 * Toàn bộ phía máy chủ được mock, kể cả bước phân tích: spec này chứng minh hợp đồng của giao diện
 * (chọn lớp → mở wizard → chọn tài liệu → nhận bản nháp 16 module/40 buổi → xác nhận → danh sách
 * hiện nội dung mới), chứ không kiểm tra chất lượng đọc mục lục — phần đó do test backend lo.
 *
 * Bản nháp ở đây là dữ liệu TỔNG HỢP: tiêu đề "Einheit N" do spec tự sinh, không lấy từ giáo trình
 * có bản quyền nào.
 */

const CLASS_ID = 1;

/** 12 chương × 3 buổi + 4 buổi ôn tập = 16 module / 40 buổi — đúng hình dạng một import A1. */
function syntheticPreview() {
  const modules: unknown[] = [];
  let chapter = 0;
  let review = 0;

  const lesson = (prefix: string, n: number) => ({
    clientId: `${prefix}.L${n}`,
    title: `${prefix}.${n} – Einheit ${n}`,
    cefrLevel: 'A1',
    estimatedUnits: 4,
    plannedDate: null,
    sourcePageFrom: 8,
    sourcePageTo: 17,
    knowledgePoints: [
      { text: 'Thema A', skillTag: 'SPRECHEN', contentTag: 'WORTSCHATZ' },
      { text: 'Thema B', skillTag: null, contentTag: 'GRAMMATIK' },
      { text: 'Thema C', skillTag: null, contentTag: null },
    ],
    canDoStatements: [
      { text: 'Ich kann etwas sagen.', cefrLevel: 'A1', skillTag: 'SPRECHEN' },
      { text: 'Ich kann etwas schreiben.', cefrLevel: 'A1', skillTag: 'SCHREIBEN' },
    ],
  });

  for (let i = 1; i <= 16; i++) {
    // Cứ ba chương thì tới một buổi ôn tập, giống nhịp của một giáo trình A1.
    const isReview = i % 4 === 0;
    if (isReview) {
      review += 1;
      const prefix = `P${String(review).padStart(2, '0')}`;
      modules.push({
        clientId: prefix,
        title: `${prefix} – Wiederholung ${review}`,
        kind: 'REVIEW',
        sourcePageFrom: 38,
        sourcePageTo: 43,
        lessons: [lesson(prefix, 1)],
      });
    } else {
      chapter += 1;
      const prefix = `K${String(chapter).padStart(2, '0')}`;
      modules.push({
        clientId: prefix,
        title: `${prefix} – Kapitel ${chapter}`,
        kind: 'CHAPTER',
        sourcePageFrom: 8,
        sourcePageTo: 17,
        lessons: [lesson(prefix, 1), lesson(prefix, 2), lesson(prefix, 3)],
      });
    }
  }

  return {
    sourceMaterialId: 55,
    sourceFileName: 'Testbuch A1',
    detectedTitle: 'Testbuch A1',
    detectedLevel: 'A1',
    source: 'TEMPLATE',
    warnings: [],
    modules,
  };
}

async function mockBackend(page: Page) {
  const preview = syntheticPreview();
  /** Lớp bắt đầu rỗng; commit mới đổ nội dung vào — đó là bằng chứng "chỉ ghi khi xác nhận". */
  let lessons: unknown[] = [];
  let modules: unknown[] = [];
  let commitCalls = 0;

  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  // Catch-all phải đăng ký TRƯỚC các route cụ thể (Playwright ưu tiên route đăng ký sau).
  await page.route('**/api/**', (route) => route.fulfill(json([])));

  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill(json({ displayName: 'Test Teacher', role: 'TEACHER', userId: 2 })),
  );

  await page.route('**/api/v2/teacher/classes', (route) =>
    route.fulfill(json([{ id: CLASS_ID, name: 'A1 Abendkurs', isActive: true, studentCount: 8 }])),
  );

  await page.route('**/api/v2/materials', (route) =>
    route.fulfill(
      json([
        {
          id: 55,
          ownerScope: 'PERSONAL',
          title: 'Testbuch A1',
          kind: 'PDF',
          url: 'https://example.invalid/x.pdf',
          tags: [],
          status: 'ACTIVE',
          createdBy: 2,
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  );

  await page.route('**/api/v2/teacher/curriculum-templates', (route) =>
    route.fulfill(
      json([
        {
          id: 'testbuch-a1',
          title: 'Testbuch A1',
          level: 'A1',
          chapterCount: 12,
          reviewCount: 4,
          defaultSessionsPerChapter: 3,
          defaultUnitsPerSession: 4,
        },
      ]),
    ),
  );

  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/curriculum-imports/preview`, (route) =>
    route.fulfill(json({ jobId: 'job-e2e-1', status: 'PENDING' }, 202)),
  );

  await page.route(
    `**/api/v2/teacher/classes/${CLASS_ID}/curriculum-imports/jobs/**`,
    (route) =>
      route.fulfill(
        json({
          jobId: 'job-e2e-1',
          status: 'COMPLETED',
          resultPayload: JSON.stringify(preview),
          errorMessage: null,
        }),
      ),
  );

  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/curriculum-imports/commit`, (route) => {
    commitCalls += 1;
    const body = JSON.parse(route.request().postData() || '{}');
    const sent = body.modules as Array<{ title: string; lessons: Array<{ title: string }> }>;

    modules = sent.map((m, i) => ({ id: 100 + i, classId: CLASS_ID, orderIndex: i, title: m.title }));
    lessons = sent.flatMap((m, mi) =>
      m.lessons.map((l, li) => ({
        id: 1000 + mi * 10 + li,
        classId: CLASS_ID,
        moduleId: 100 + mi,
        orderIndex: mi * 10 + li,
        title: l.title,
        description: '',
        cefrLevel: 'A1',
        plannedDate: null,
        estimatedUnits: 4,
        completed: false,
        knowledgePoints: [],
        canDoStatements: [],
      })),
    );

    return route.fulfill(
      json({
        modulesCreated: modules.length,
        lessonsCreated: lessons.length,
        moduleIds: modules.map((m: any) => m.id),
        skippedModuleTitles: [],
        replayed: false,
      }),
    );
  });

  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/lessons`, (route) =>
    route.fulfill(json(lessons)),
  );
  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/modules`, (route) =>
    route.fulfill(json(modules)),
  );

  return { commitCalls: () => commitCalls };
}

test.describe('Nhập PDF thành kế hoạch giảng dạy', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
      ...teacherCookies(),
    ]);
    await page.goto('/v2/teacher');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), TEACHER_TOKEN);
  });

  test('chọn lớp → wizard → xem trước 16 module/40 buổi → xác nhận → danh sách hiện nội dung mới', async ({
    page,
  }) => {
    const backend = await mockBackend(page);

    await page.goto(`/v2/teacher/tc-checklist?classId=${CLASS_ID}`);

    // Trước khi nhập, lớp chưa có nội dung nào.
    await expect(page.getByText('Lớp chưa có bài học nào', { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /Nhập PDF thành kế hoạch/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Bước 1: tài liệu nguồn đã có sẵn trong thư viện.
    await expect(dialog.getByLabel(/Tài liệu PDF trong thư viện/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();

    // Bước 2: preset mặc định 3 buổi/Kapitel, 4 tiết/buổi.
    await expect(dialog.getByLabel(/Số buổi mỗi Kapitel/i)).toHaveValue('3');
    await expect(dialog.getByLabel(/Số tiết 45' mỗi buổi/i)).toHaveValue('4');
    expect(backend.commitCalls()).toBe(0);

    await dialog.getByRole('button', { name: 'Phân tích' }).click();

    // Bước 3: bản nháp đúng hình dạng một giáo trình A1 — và vẫn chưa ghi gì.
    await expect(dialog.getByText(/16 module · 40 buổi · 160 tiết/)).toBeVisible({
      timeout: 20_000,
    });
    expect(backend.commitCalls()).toBe(0);

    await dialog.getByRole('button', { name: /Nhập tất cả/ }).click();

    // Wizard đóng, toast báo kết quả, danh sách nạp lại với nội dung vừa nhập.
    await expect(page.getByText('Đã nhập 16 module và 40 buổi học.')).toBeVisible({
      timeout: 20_000,
    });
    // Tiêu đề module xuất hiện ở nhiều nơi (header nhóm, dòng bài, select gán module) nên phải
    // chỉ đích danh header nhóm, nếu không strict mode của Playwright sẽ báo locator mơ hồ.
    await expect(page.getByRole('option', { name: 'K01 – Kapitel 1' }).first()).toBeAttached();
    await expect(page.getByRole('option', { name: 'P01 – Wiederholung 1' }).first()).toBeAttached();
    await expect(page.getByText('K01.1 – Einheit 1').first()).toBeVisible();
    expect(backend.commitCalls()).toBe(1);
  });

  test('bỏ chọn một module thì module đó không được nhập', async ({ page }) => {
    await mockBackend(page);

    await page.goto(`/v2/teacher/tc-checklist?classId=${CLASS_ID}`);
    await page.getByRole('button', { name: /Nhập PDF thành kế hoạch/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    await dialog.getByRole('button', { name: 'Phân tích' }).click();
    await expect(dialog.getByText(/16 module · 40 buổi/)).toBeVisible({ timeout: 20_000 });

    await dialog.getByLabel('Nhập module K01 – Kapitel 1').uncheck();

    // Tổng cập nhật tại chỗ: 15 module / 37 buổi.
    await expect(dialog.getByText(/15 module · 37 buổi/)).toBeVisible();
    await dialog.getByRole('button', { name: /Nhập tất cả/ }).click();

    await expect(page.getByText('Đã nhập 15 module và 37 buổi học.')).toBeVisible({
      timeout: 20_000,
    });
    // Module bị bỏ chọn không được ghi, nên không có buổi nào của nó trong danh sách.
    await expect(page.getByRole('option', { name: 'K01 – Kapitel 1' })).toHaveCount(0);
    await expect(page.getByText('K01.1 – Einheit 1')).toHaveCount(0);
  });

  test('đóng wizard giữa chừng không ghi gì vào lớp', async ({ page }) => {
    const backend = await mockBackend(page);

    await page.goto(`/v2/teacher/tc-checklist?classId=${CLASS_ID}`);
    await page.getByRole('button', { name: /Nhập PDF thành kế hoạch/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    await dialog.getByRole('button', { name: 'Phân tích' }).click();
    await expect(dialog.getByText(/16 module · 40 buổi/)).toBeVisible({ timeout: 20_000 });

    // Bước cấu hình chỉ có "Quay lại"/"Phân tích"; nút huỷ nằm ở bước chọn tài liệu.
    await dialog.getByRole('button', { name: 'Quay lại' }).click();
    await dialog.getByRole('button', { name: 'Quay lại' }).click();
    await dialog.getByRole('button', { name: 'Huỷ' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(backend.commitCalls()).toBe(0);
    await expect(page.getByText('Lớp chưa có bài học nào', { exact: false })).toBeVisible();
  });
});
