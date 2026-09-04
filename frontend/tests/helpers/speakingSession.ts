import type { Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from './tokens';

/**
 * Mock đủ để một phiên luyện nói mount được ở `/v2/student/speaking/live`.
 *
 * Tách ra khỏi `speaking.spec.ts` khi lô 4 của S-07 cần cùng bộ mock cho spec bố cục Studio —
 * chép bộ mock sang spec thứ hai là cách chắc chắn để hai spec trôi khỏi nhau, và cái sai sẽ nằm
 * đúng ở chỗ khó thấy nhất (một spec mock đúng endpoint, spec kia mock vào hư không như bản v1 đã
 * từng làm với `/speaking-sessions/personas`).
 */
export const STUDENT_ME = {
  displayName: 'Test Student',
  role: 'STUDENT',
  userId: 1,
  email: 'student@test.com',
  learningTargetLevel: 'A1',
};

export const SESSION = {
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

/** Trả về body của lệnh POST tạo phiên để test khẳng định đúng nhân vật được gửi lên. */
export async function mockSpeaking(page: Page): Promise<{ read: () => Record<string, unknown> }> {
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

/** Đi trọn đường setup → live, trả về khi engine đã mount. */
export async function enterSpeakingRoom(page: Page): Promise<void> {
  await page.goto('/v2/student/speaking/setup');
  const lukas = page.getByText('Lukas', { exact: true }).first();
  await lukas.click();
  await page.getByRole('button', { name: /Bắt đầu với Lukas/ }).click();
  await page.waitForURL(/\/v2\/student\/speaking\/live/, { timeout: 30_000 });
}

/**
 * Mock một lượt chat hoàn chỉnh: chỉ phát khung SSE `done`.
 *
 * Bỏ qua khung `token` có chủ ý — token đi qua `createSpeechStreamer('ai_speech_de')` để nhả dần
 * câu nói, còn thứ spec cần là **trạng thái sau lượt** (`errors` gắn vào lượt USER, `feedback` gắn
 * vào lượt AI). Chỉ `done` mới mang bộ đó, và `onDone` gán `contentDe` từ chính payload này nên
 * bỏ token không làm mất chữ nào.
 */
export async function mockChatTurn(
  page: Page,
  payload: Partial<Record<string, unknown>> = {},
): Promise<void> {
  const body = {
    messageId: 1,
    sessionId: SESSION.id,
    aiSpeechDe: 'Schön! Und was machst du danach?',
    correction: 'Ich bin nach Hause gegangen.',
    explanationVi: 'Động từ chuyển động đi với sein.',
    grammarPoint: 'Perfekt mit sein',
    learningStatus: { newWord: null, userInterestDetected: null },
    errors: [
      {
        errorCode: 'VERB.PERFEKT_AUX',
        severity: 'MAJOR',
        confidence: 0.92,
        wrongSpan: 'ich habe gegangen',
        correctedSpan: 'ich bin gegangen',
        ruleViShort: 'Động từ chuyển động dùng sein, không dùng haben.',
        exampleCorrectDe: 'Ich bin nach Hause gegangen.',
      },
    ],
    status: 'ON_TOPIC_NEEDS_IMPROVEMENT',
    feedback: 'Đúng chủ đề rồi, thử nói dài hơn một chút nhé.',
    suggestions: [
      {
        german_text: 'Danach bin ich einkaufen gegangen.',
        vietnamese_translation: 'Sau đó tôi đi mua sắm.',
        level: 'B1',
        why_to_use: 'Nối tiếp mạch chuyện, dùng đúng Perfekt với sein.',
        usage_context: 'Kể lại một ngày',
        lego_structure: 'Adv + V + S + V(inf)',
      },
    ],
    action: null,
    ...payload,
  };

  await page.route(`**/api/ai-speaking/sessions/${SESSION.id}/chat/stream`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: done\ndata: ${JSON.stringify(body)}\n\n`,
    }),
  );
}

/** Gửi một lượt bằng đường GÕ (đường mic cần audio thật). */
export async function sendTypedTurn(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Gõ thay vì nói' }).click();
  const box = page.getByRole('textbox');
  await box.fill(text);
  await box.press('Enter');
}
