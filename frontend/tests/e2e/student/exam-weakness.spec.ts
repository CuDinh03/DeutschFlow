import { test, expect, type Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens';

/**
 * E2E Đợt 5a — Màn "Ôn yếu điểm" (/v2/student/speaking/exam/weakness). Backend mock bằng page.route
 * theo hợp đồng GET /api/speaking/exam/weakness. Ba luồng:
 *   1. Catalog → link Ôn yếu điểm → danh sách yếu điểm + ví dụ sửa + gói Redemittel.
 *   2. Lọc theo dạng bài (archetype) → ẩn yếu điểm/gói không khớp; CTA "Luyện lại Teil này"
 *      POST tạo phiên DRILL đúng provider/level/teil từ ngữ cảnh.
 *   3. Chưa có lỗi → empty state nhưng vẫn hiện gói Redemittel.
 * Không `waitForTimeout`: mọi chờ là assertion deterministic.
 */

const STUDENT_ME = { displayName: 'Test Student', role: 'STUDENT', userId: 1, email: 'student@test.com', learningTargetLevel: 'A1' };

const WEAKNESS = {
  weakPoints: [
    {
      errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE',
      ruleVi: 'Động từ chia luôn đứng vị trí 2 trong câu trần thuật.',
      totalCount: 4,
      openCount: 3,
      lastSeverity: 'MAJOR',
      lastSeenAt: new Date().toISOString(),
      exampleOriginal: 'Gern ich trinke Kaffee',
      exampleCorrection: 'Ich trinke gern Kaffee',
      contexts: [
        { provider: 'GOETHE', level: 'A1', teilNo: 2, archetype: 'CARD_QA', count: 3, lastSeenAt: new Date().toISOString() },
        { provider: 'GOETHE', level: 'A1', teilNo: 3, archetype: 'REQUEST_RESPOND', count: 1, lastSeenAt: new Date().toISOString() },
      ],
    },
    {
      errorCode: 'ARTICLE.GENDER_WRONG_DER_DIE_DAS',
      ruleVi: 'Danh từ tiếng Đức có giống cố định — học kèm mạo từ.',
      totalCount: 2,
      openCount: 2,
      lastSeverity: 'MINOR',
      lastSeenAt: new Date().toISOString(),
      exampleOriginal: 'der Küche',
      exampleCorrection: 'die Küche',
      contexts: [
        { provider: 'GOETHE', level: 'A1', teilNo: 3, archetype: 'REQUEST_RESPOND', count: 2, lastSeenAt: new Date().toISOString() },
      ],
    },
  ],
  packs: [
    { archetype: 'CARD_QA', phrases: ['Wie heißt du?', 'Entschuldigung, können Sie das bitte wiederholen?'] },
    { archetype: 'REQUEST_RESPOND', phrases: ['Kannst du mir bitte … geben?', 'Ja, gern.'] },
  ],
};

async function baseMocks(page: Page) {
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' }, ...studentCookies()]);
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN);
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDENT_ME) }));
  await page.route('**/api/auth/me/plan', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }) }));
  await page.route('**/api/speaking/exam/results', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

test.describe('Ôn yếu điểm (/v2/student/speaking/exam/weakness)', () => {
  test('danh sách yếu điểm: mã lỗi, ví dụ sửa, ngữ cảnh dạng bài, gói Redemittel', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/weakness*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WEAKNESS) }),
    );

    await page.goto('/v2/student/speaking/exam/weakness');
    const first = page.getByTestId('weak-WORD_ORDER.V2_MAIN_CLAUSE');
    await expect(first).toBeVisible();
    await expect(first).toContainText('Động từ chia luôn đứng vị trí 2');
    await expect(first).toContainText('Gern ich trinke Kaffee');
    await expect(first).toContainText('Ich trinke gern Kaffee');
    await expect(first).toContainText('Goethe A1 · Teil 2');
    await expect(page.getByTestId('weak-ARTICLE.GENDER_WRONG_DER_DIE_DAS')).toBeVisible();
    // Gói Redemittel của cả hai dạng bài đang yếu
    const packs = page.getByTestId('redemittel-packs');
    await expect(packs).toContainText('Wie heißt du?');
    await expect(packs).toContainText('Kannst du mir bitte … geben?');
  });

  test('lọc theo dạng bài + CTA tạo phiên DRILL đúng Teil từ ngữ cảnh', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/weakness*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WEAKNESS) }),
    );
    let created: Record<string, unknown> = {};
    await page.route('**/api/speaking/exam/sessions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      created = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 601, provider: 'GOETHE', level: 'A1', mode: 'DRILL', state: 'IN_PART' }),
      });
    });
    // Trang phiên chỉ cần nhận diện điều hướng — mock GET session tối thiểu.
    await page.route('**/api/speaking/exam/sessions/601', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 601 }) }),
    );

    await page.goto('/v2/student/speaking/exam/weakness');
    await expect(page.getByTestId('weak-WORD_ORDER.V2_MAIN_CLAUSE')).toBeVisible();

    // Lọc REQUEST_RESPOND: cả hai mã lỗi đều còn (đều có ngữ cảnh REQUEST_RESPOND) nhưng gói CARD_QA ẩn
    await page.getByTestId('filter-REQUEST_RESPOND').click();
    await expect(page.getByTestId('redemittel-packs')).not.toContainText('Wie heißt du?');
    await expect(page.getByTestId('redemittel-packs')).toContainText('Kannst du mir bitte … geben?');

    // CTA trong ngữ cảnh lọc REQUEST_RESPOND → drill Teil 3 (không phải Teil 2 của CARD_QA)
    await page.getByTestId('drill-WORD_ORDER.V2_MAIN_CLAUSE').click();
    await page.waitForURL(/\/v2\/student\/speaking\/exam\/session\/601\/?$/);
    expect(created).toMatchObject({ provider: 'GOETHE', level: 'A1', mode: 'DRILL', teil: 3 });
  });

  test('empty state vẫn hiện gói Redemittel; catalog có lối vào', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/blueprints*', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          id: 1, provider: 'GOETHE', level: 'A1', version: 1, title: 'Goethe-Zertifikat A1 — Sprechen', prepSec: 0,
          parts: [{ teilNo: 1, archetype: 'SELF_INTRO', title: 'Sich vorstellen', durationSec: 180, flow: 'EXAMINER_LED', hasPartner: false }],
          rubricScale: 'VHN', maxTotal: 25, speakingOnlyMin: 0,
        }]),
      }),
    );
    await page.route('**/api/speaking/exam/weakness*', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ weakPoints: [], packs: [{ archetype: 'SELF_INTRO', phrases: ['Ich heiße … / Mein Name ist …'] }] }),
      }),
    );

    // Lối vào từ catalog
    await page.goto('/v2/student/speaking/exam');
    await page.getByTestId('weakness-link').click();
    await page.waitForURL(/\/v2\/student\/speaking\/exam\/weakness\/?$/);

    await expect(page.getByText('Chưa có lỗi nào được ghi nhận')).toBeVisible();
    await expect(page.getByTestId('redemittel-packs')).toContainText('Ich heiße');
  });
});
