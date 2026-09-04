import type { Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from './tokens';

/**
 * Mock đủ để runner luyện kỹ năng (`/v2/student/practice/{nodeId}/{skill}`) mount và chạy được.
 *
 * `useStudentPracticeSession` gọi bốn endpoint trước khi `me` có giá trị, và runner CHỜ `me` mới
 * fetch đề — thiếu một cái là trang đứng ở `LoadingState` mãi mãi, trông hệt như một lỗi khác.
 */
export const NODE_ID = 4321;
export const SESSION_ID = 999;

export const EXERCISES = [
  {
    type: 'MULTIPLE_CHOICE',
    instruction_vi: 'Chọn đáp án đúng',
    question_de: 'Wie heißt du?',
    options: ['Ich heiße Anna.', 'Ich bin müde.', 'Es regnet.'],
    correct_index: 0,
    explanation_vi: 'Câu hỏi về tên.',
  },
  {
    type: 'MULTIPLE_CHOICE',
    instruction_vi: 'Chọn đáp án đúng',
    question_de: 'Woher kommst du?',
    options: ['Aus Vietnam.', 'Um acht Uhr.', 'Sehr gut.'],
    correct_index: 0,
    explanation_vi: 'Câu hỏi về xuất xứ.',
  },
  {
    type: 'MULTIPLE_CHOICE',
    instruction_vi: 'Chọn đáp án đúng',
    question_de: 'Was machst du?',
    options: ['Ich arbeite.', 'Danke schön.', 'Bis bald.'],
    correct_index: 0,
    explanation_vi: 'Câu hỏi về công việc.',
  },
];

const SESSION_DETAIL = {
  sessionId: SESSION_ID,
  skillType: 'LESEN',
  generation: 1,
  status: 'ACTIVE',
  scorePercent: 0,
  exercises: EXERCISES,
  sourceNodeTitle: 'Sich vorstellen',
  sourceNodeTitleVi: 'Giới thiệu bản thân',
};

export async function mockPracticeRunner(page: Page): Promise<void> {
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
  await page.route('**/api/student/dashboard', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"streakDays":3}' }),
  );

  await page.route(`**/api/skill-tree/${NODE_ID}/practice/*/start`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: SESSION_ID }),
    }),
  );
  await page.route(`**/api/skill-tree/practice/${SESSION_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION_DETAIL) }),
  );
}

/** Chọn phương án đầu tiên của câu thứ `index` (0-based). */
export async function answerExercise(page: Page, index: number): Promise<void> {
  const card = page.getByRole('button', { name: new RegExp(`^A\\s*${EXERCISES[index].options[0]}`) });
  await card.click();
}
