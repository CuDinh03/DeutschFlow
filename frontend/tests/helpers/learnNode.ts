import type { Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from './tokens';

/**
 * Mock đủ để `/v2/student/learn/{nodeId}` mount với nội dung thật.
 *
 * `estimatedMinutes` và `content.overview` là hai trường mà `LessonShell` chỉ vẽ KHI CÓ — nên
 * helper cho phép bỏ chúng đi để spec kiểm được cả nhánh vắng, thứ hay bị bỏ quên hơn nhánh có.
 */
export const LEARN_NODE_ID = 5150;

interface Options {
  estimatedMinutes?: number | null;
  overviewVi?: string | null;
}

export async function mockLearnNode(page: Page, opts: Options = {}): Promise<void> {
  const { estimatedMinutes = 12, overviewVi = 'Nói về công việc hằng ngày' } = opts;

  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' },
    ...studentCookies(),
  ]);
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN);

  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route(/.+\/api\/auth\/me$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        displayName: 'Test Student',
        role: 'STUDENT',
        userId: 1,
        email: 'student@test.com',
        learningTargetLevel: 'A1',
      }),
    }),
  );
  await page.route('**/api/onboarding/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"hasPlan":true}' }),
  );
  await page.route('**/api/roadmap/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.route(`**/api/skill-tree/node/${LEARN_NODE_ID}/session`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nodeId: LEARN_NODE_ID,
        titleDe: 'Über die Arbeit sprechen',
        titleVi: 'Nói về công việc',
        descriptionVi: 'Bài về chủ đề công việc.',
        emoji: '💼',
        phase: 'CORE',
        cefrLevel: 'A2',
        difficulty: 2,
        xpReward: 150,
        moduleNumber: 8,
        moduleTitleVi: 'Công việc và nghề nghiệp',
        estimatedMinutes,
        sessionType: 'LESSON',
        hasContent: true,
        dependenciesMet: true,
        userStatus: 'IN_PROGRESS',
        content: {
          title: { de: 'Über die Arbeit sprechen', vi: 'Nói về công việc' },
          overview: { de: 'Über den Arbeitsalltag sprechen', vi: overviewVi },
          session_type: 'LESSON',
          theory_cards: [
            { type: 'RULE', title: { vi: 'Thì hiện tại' }, content: { vi: 'Chia động từ.' }, tags: [] },
          ],
          vocabulary: [
            {
              id: 'v1',
              german: 'die Arbeit',
              meaning: 'công việc',
              gender: 'die',
              color_code: null,
              gender_label: null,
              example_de: 'Die Arbeit ist gut.',
              example_vi: 'Công việc tốt.',
              speak_de: 'die Arbeit',
              tags: [],
            },
          ],
          phrases: [],
          examples: [],
          exercises: { theory_gate: [], practice: [] },
          reading_passage: null,
          audio_content: null,
          writing_prompt: null,
        },
      }),
    }),
  );
}
