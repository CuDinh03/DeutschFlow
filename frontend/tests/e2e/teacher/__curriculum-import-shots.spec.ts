import { test } from '@playwright/test';
import { teacherCookies, TEACHER_TOKEN } from '../../helpers/tokens';

/**
 * Ảnh chụp wizard nhập PDF — chạy tay để soi giao diện, không phải test hồi quy.
 *
 * Tên bắt đầu bằng "__" theo quy ước của các spec chụp ảnh sẵn có trong repo (xem
 * `student/__tree-analysis-shots.spec.ts`): không assert gì, chỉ ghi PNG ra `test-results/`.
 */

const CLASS_ID = 1;
const OUT = 'test-results/curriculum-import';

function preview() {
  const lesson = (prefix: string, n: number, title: string) => ({
    clientId: `${prefix}.L${n}`,
    title: `${prefix}.${n} – ${title}`,
    cefrLevel: 'A1',
    estimatedUnits: 4,
    plannedDate: null,
    sourcePageFrom: 8 + (n - 1) * 3,
    sourcePageTo: 10 + (n - 1) * 3,
    knowledgePoints: [
      { text: 'Zahlen von 1–20', skillTag: 'SPRECHEN', contentTag: 'WORTSCHATZ' },
      { text: 'Länder und Sprachen', skillTag: 'SPRECHEN', contentTag: 'WORTSCHATZ' },
      { text: 'W-Frage', skillTag: 'HOEREN', contentTag: 'GRAMMATIK' },
    ],
    canDoStatements: [
      { text: 'Ich kann grüßen und verabschieden.', cefrLevel: 'A1', skillTag: 'SPRECHEN' },
      { text: 'Ich kann mich und andere vorstellen.', cefrLevel: 'A1', skillTag: 'SPRECHEN' },
    ],
  });

  const modules: unknown[] = [];
  let chapter = 0;
  let review = 0;
  const titles = [
    'Guten Tag!', 'Freunde, Kollegen und ich', 'In Hamburg', 'Guten Appetit!',
    'Alltag und Familie', 'Zeit mit Freunden', 'Arbeitsalltag', 'Fit und gesund',
    'Meine Wohnung', 'Studium und Beruf', 'Die Jacke gefällt mir!', 'Ab in den Urlaub!',
  ];
  const phase = ['Einstieg und Wortschatz', 'Grammatik und Verstehen', 'Anwendung und Transfer'];

  for (let i = 1; i <= 16; i++) {
    if (i % 4 === 0) {
      review += 1;
      const prefix = `P${String(review).padStart(2, '0')}`;
      modules.push({
        clientId: prefix,
        title: `${prefix} – Plattform ${review}`,
        kind: 'REVIEW',
        sourcePageFrom: 38,
        sourcePageTo: 43,
        lessons: [lesson(prefix, 1, 'Wiederholung und Training')],
      });
    } else {
      chapter += 1;
      const prefix = `K${String(chapter).padStart(2, '0')}`;
      modules.push({
        clientId: prefix,
        title: `${prefix} – ${titles[chapter - 1]}`,
        kind: 'CHAPTER',
        sourcePageFrom: 8,
        sourcePageTo: 17,
        lessons: [1, 2, 3].map((n) => lesson(prefix, n, phase[n - 1])),
      });
    }
  }
  return {
    sourceMaterialId: 55,
    sourceFileName: 'netzwerk-neu-a1-kursbuch.pdf',
    detectedTitle: 'Netzwerk neu A1',
    detectedLevel: 'A1',
    source: 'TEMPLATE',
    warnings: [],
    modules,
  };
}

test('chụp các bước của wizard', async ({ page }) => {
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...teacherCookies(),
  ]);
  await page.goto('/v2/teacher');
  await page.evaluate((t) => localStorage.setItem('accessToken', t), TEACHER_TOKEN);

  await page.route('**/api/**', (r) => r.fulfill(json([])));
  await page.route(/.+\/api\/auth\/me$/, (r) =>
    r.fulfill(json({ displayName: 'Test Teacher', role: 'TEACHER', userId: 2 })),
  );
  await page.route('**/api/v2/teacher/classes', (r) =>
    r.fulfill(json([{ id: CLASS_ID, name: 'A1 Abendkurs', isActive: true, studentCount: 8 }])),
  );
  await page.route('**/api/v2/materials', (r) =>
    r.fulfill(
      json([
        {
          id: 55,
          ownerScope: 'PERSONAL',
          title: 'netzwerk-neu-a1-kursbuch',
          kind: 'PDF',
          url: 'x',
          tags: [],
          status: 'ACTIVE',
          createdBy: 2,
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  );
  await page.route('**/api/v2/teacher/curriculum-templates', (r) =>
    r.fulfill(
      json([
        {
          id: 'netzwerk-neu-a1',
          title: 'Netzwerk neu A1',
          level: 'A1',
          chapterCount: 12,
          reviewCount: 4,
          defaultSessionsPerChapter: 3,
          defaultUnitsPerSession: 4,
        },
      ]),
    ),
  );
  await page.route(`**/curriculum-imports/preview`, (r) =>
    r.fulfill(json({ jobId: 'shot', status: 'PENDING' }, 202)),
  );
  await page.route(`**/curriculum-imports/jobs/**`, (r) =>
    r.fulfill(
      json({
        jobId: 'shot',
        status: 'COMPLETED',
        resultPayload: JSON.stringify(preview()),
        errorMessage: null,
      }),
    ),
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/v2/teacher/tc-checklist?classId=${CLASS_ID}`);
  await page.getByRole('button', { name: /Nhập PDF thành kế hoạch/i }).click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.screenshot({ path: `${OUT}/01-source.png` });

  await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/02-config.png` });

  await dialog.getByRole('button', { name: 'Phân tích' }).click();
  await dialog.getByText(/16 module · 40 buổi/).waitFor();
  await page.screenshot({ path: `${OUT}/03-preview.png` });
});
