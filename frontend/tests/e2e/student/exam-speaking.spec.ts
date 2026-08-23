import { test, expect, type Page } from '@playwright/test';
import { studentCookies, STUDENT_TOKEN } from '../../helpers/tokens';

/**
 * E2E Đợt 1 — Phòng luyện thi nói (/v2/student/speaking/exam). Backend mock bằng page.route theo hợp đồng
 * `/api/speaking/exam/**` (Đợt 0, PR #377). Hai luồng:
 *   1. Drill A1 Teil 2 bằng bàn phím (drill cho phép text; mock chỉ nhận audio) → thẻ đề, lời giám khảo,
 *      lượt trả lời của partner AI, thẻ chấm nhanh 0–10.
 *   2. Mock đã chấm xong (state RESULTS) → Ergebnisbogen: tổng, khoảng, đạt/trượt, tiêu chí, disclaimer.
 * Không `waitForTimeout`: mọi chờ đều là assertion deterministic (bẫy đua biên dịch nguội `next dev`).
 */

const STUDENT_ME = { displayName: 'Test Student', role: 'STUDENT', userId: 1, email: 'student@test.com', learningTargetLevel: 'A1' };

const BLUEPRINTS = [
  {
    id: 1, provider: 'GOETHE', level: 'A1', version: 1, title: 'Goethe-Zertifikat A1 — Sprechen', prepSec: 0,
    parts: [
      { teilNo: 1, archetype: 'SELF_INTRO', title: 'Sich vorstellen', durationSec: 180, flow: 'EXAMINER_LED', hasPartner: false },
      { teilNo: 2, archetype: 'CARD_QA', title: 'Um Informationen bitten und Informationen geben', durationSec: 240, flow: 'ALTERNATING_QA', hasPartner: true },
      { teilNo: 3, archetype: 'REQUEST_RESPOND', title: 'Bitten formulieren und darauf reagieren', durationSec: 240, flow: 'ALTERNATING_QA', hasPartner: true },
    ],
    rubricScale: 'VHN', maxTotal: 25, speakingOnlyMin: 0,
  },
  {
    id: 2, provider: 'TELC', level: 'A1', version: 1, title: 'telc Deutsch A1 — Mündliche Prüfung', prepSec: 0,
    parts: [
      { teilNo: 1, archetype: 'SELF_INTRO', title: 'Sich vorstellen', durationSec: 180, flow: 'EXAMINER_LED', hasPartner: false },
      { teilNo: 2, archetype: 'CARD_QA', title: 'Um Informationen bitten und Informationen geben', durationSec: 240, flow: 'ALTERNATING_QA', hasPartner: true },
      { teilNo: 3, archetype: 'REQUEST_RESPOND', title: 'Bitten formulieren und darauf reagieren', durationSec: 240, flow: 'ALTERNATING_QA', hasPartner: true },
    ],
    rubricScale: 'VHN', maxTotal: 15, speakingOnlyMin: 0,
  },
  // B2 có blueprint (seed Đợt 0) nhưng chưa có đề (Đợt 4) → UI khóa nút + "sắp có".
  {
    id: 3, provider: 'GOETHE', level: 'B2', version: 1, title: 'Goethe-Zertifikat B2 — Modul Sprechen', prepSec: 900,
    parts: [
      { teilNo: 1, archetype: 'PRESENT', title: 'Vortrag halten', durationSec: 300, flow: 'MONOLOGUE', hasPartner: true },
      { teilNo: 2, archetype: 'DISCUSS', title: 'Diskussion führen', durationSec: 300, flow: 'DIALOGUE', hasPartner: true },
    ],
    rubricScale: 'A_E', maxTotal: 100, speakingOnlyMin: 0,
  },
  {
    // Cấp ngoài MVP: có blueprint nhưng chưa mở → phủ đường "sắp có" + nút bị khoá.
    // Trước Đợt 4 vai này do B2 đóng; B2 mở rồi thì phải có cấp khác thế chỗ, nếu không nhánh
    // OPEN_LEVELS trong catalog mất hẳn test.
    id: 9, provider: 'GOETHE', level: 'C1', version: 1, title: 'Goethe-Zertifikat C1 — Modul Sprechen', prepSec: 900,
    parts: [
      { teilNo: 1, archetype: 'PRESENT', title: 'Vortrag halten', durationSec: 240, flow: 'MONOLOGUE', hasPartner: true },
      { teilNo: 2, archetype: 'DISCUSS', title: 'Diskussion', durationSec: 300, flow: 'DIALOGUE', hasPartner: true },
    ],
    rubricScale: 'A_E', maxTotal: 100, speakingOnlyMin: 0,
  },
];

const NOW = new Date();
const deadline = (sec: number) => new Date(NOW.getTime() + sec * 1000).toISOString();

function drillSession(step: number, partial?: Record<string, unknown>) {
  return {
    id: 501, provider: 'GOETHE', level: 'A1', mode: 'DRILL', state: 'IN_PART', currentPart: 2, currentStep: step, totalParts: 1,
    serverNow: NOW.toISOString(), prepDeadlineAt: null, partDeadlineAt: deadline(240),
    directive: {
      teilNo: 2, title: 'Um Informationen bitten und Informationen geben', archetype: 'CARD_QA', stepIndex: step, stepCount: 4,
      candidateAction: step % 2 === 0 ? 'ASK' : 'ANSWER',
      hintVi: step % 2 === 0 ? 'Đặt MỘT câu hỏi về từ trên thẻ cho bạn thi.' : 'Trả lời câu hỏi bạn thi vừa đặt.',
      stimulus: step % 2 === 0 ? { type: 'THEME_CARD', thema: 'Essen und Trinken', wort: 'Brot' } : { type: 'THEME_CARD', thema: 'Wohnen', wort: 'Küche' },
      prueferText: 'Teil 2: Um Informationen bitten und Informationen geben. Ihre erste Karte: Thema Essen und Trinken, Wort Brot.',
      prueferVoice: 'PRUEFER', lastAiRole: null, lastAiText: null,
    },
    lastTurnEval: null, notesText: null, gradingJobId: null, resultAvailable: false, ...partial,
  };
}

const RESULT = {
  sessionId: 777, provider: 'GOETHE', level: 'A1', rubricVersion: 1, total: 20, totalLow: 18, totalHigh: 22, max: 25, passed: null,
  createdAt: NOW.toISOString(),
  scoreSheet: {
    rubricRef: { provider: 'GOETHE', level: 'A1', version: 1 },
    parts: [
      { teilNo: 1, points: 2.5, max: 3, zeroed: false, criteria: [
        { code: 'VORSTELLUNG', label: 'Sich vorstellen', band: 'VOLL', points: 1, max: 1, scored: true, confidence: 'high', evidence: ['Ich heiße Minh, ich komme aus Vietnam.'] },
        { code: 'BUCHSTABIEREN', label: 'Buchstabieren', band: 'HALB', points: 0.5, max: 1, scored: true, confidence: 'high', evidence: ['S-T-R-A-S-E'] },
        { code: 'ZAHL', label: 'Nummer nennen', band: 'VOLL', points: 1, max: 1, scored: true, confidence: 'high', evidence: [] },
      ] },
      { teilNo: 2, points: 6, max: 6, zeroed: false, criteria: [
        { code: 'FRAGE_1', label: 'Frage 1', band: 'VOLL', points: 1.5, max: 1.5, scored: true, confidence: 'high', evidence: ['Isst du gern Brot?'] },
        { code: 'ANTWORT_1', label: 'Antwort 1', band: 'VOLL', points: 1.5, max: 1.5, scored: true, confidence: 'high', evidence: [] },
        { code: 'FRAGE_2', label: 'Frage 2', band: 'VOLL', points: 1.5, max: 1.5, scored: true, confidence: 'high', evidence: [] },
        { code: 'ANTWORT_2', label: 'Antwort 2', band: 'VOLL', points: 1.5, max: 1.5, scored: true, confidence: 'high', evidence: [] },
      ] },
      { teilNo: 3, points: 3.5, max: 6, zeroed: false, criteria: [
        { code: 'BITTE_1', label: 'Bitte 1', band: 'HALB', points: 0.75, max: 1.5, scored: true, confidence: 'medium', evidence: [] },
        { code: 'REAKTION_1', label: 'Reaktion 1', band: 'VOLL', points: 1.5, max: 1.5, scored: true, confidence: 'high', evidence: [] },
        { code: 'BITTE_2', label: 'Bitte 2', band: 'NULL', points: 0, max: 1.5, scored: true, confidence: 'medium', evidence: [] },
        { code: 'REAKTION_2', label: 'Reaktion 2', band: 'HALB', points: 0.75, max: 1.5, scored: true, confidence: 'medium', evidence: [] },
      ] },
    ],
    global: [],
    total: 20, totalLow: 18, totalHigh: 22, maxPoints: 25, officialMax: 25, passed: null,
    passRule: 'Hệ này không có ngưỡng nói riêng — điểm nói cộng vào tổng kỳ thi (xem ghi chú rubric).',
    errors: [{ code: 'ARTICLE.GENDER_WRONG_DER_DIE_DAS', original: 'der Küche', correction: 'die Küche', severity: 'MAJOR', teilNo: 2 }],
    notes: [], passes: 2,
  },
};

async function baseMocks(page: Page) {
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'vi', domain: 'localhost', path: '/' }, ...studentCookies()]);
  await page.addInitScript((token) => localStorage.setItem('accessToken', token), STUDENT_TOKEN);
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(/.+\/api\/auth\/me$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDENT_ME) }));
  await page.route('**/api/auth/me/plan', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planCode: 'PRO', tier: 'PRO' }) }));
  await page.route('**/api/speaking/exam/blueprints*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BLUEPRINTS) }));
  await page.route('**/api/speaking/exam/results', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // TTS: trả rỗng để không phát âm trong headless (component fallback im lặng).
  await page.route('**/api/ai-speaking/tts', (route) => route.fulfill({ status: 204, body: '' }));
}

test.describe('Phòng luyện thi nói (/v2)', () => {
  test('catalog → drill A1 Teil 2 bằng bàn phím → partner AI trả lời + chấm nhanh', async ({ page }) => {
    await baseMocks(page);
    let created: Record<string, unknown> = {};
    let step = 0;
    await page.route('**/api/speaking/exam/sessions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      created = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(drillSession(0)) });
    });
    await page.route('**/api/speaking/exam/sessions/501', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(drillSession(step)) }),
    );
    await page.route('**/api/speaking/exam/sessions/501/turns', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      step = 1;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          transcript: body.transcript, aiRole: 'PARTNER', aiText: 'Ja, ich esse gern Brot. Und du — was kochst du in der Küche?', aiVoice: 'PARTNER',
          turnEval: { score: 8, feedbackVi: 'Câu hỏi đúng chủ đề và dễ hiểu.', corrections: [{ code: 'WORD_ORDER.V2_MAIN_CLAUSE', original: 'Du isst gern Brot?', correction: 'Isst du gern Brot?' }], redemittel: ['Magst du …?'] },
          session: drillSession(1),
        }),
      });
    });

    await page.goto('/v2/student/speaking/exam');
    await expect(page.getByRole('heading', { name: 'Phòng luyện thi nói' })).toBeVisible();
    await expect(page.getByTestId('start-mock')).toBeEnabled();
    // Cấp chưa mở hiển thị "sắp có" và khóa nút. B2 đã mở ở Đợt 4 → dùng C1 (ngoài MVP).
    await page.getByTestId('level-C1').click();
    await expect(page.getByTestId('start-mock')).toBeDisabled();
    await expect(page.getByTestId('start-drill-1')).toBeDisabled();
    await expect(page.getByText('Cấp C1 sẽ mở ở đợt tiếp theo.')).toBeVisible();
    await page.getByTestId('level-A1').click();
    await expect(page.getByTestId('start-mock')).toBeEnabled();

    await page.getByTestId('start-drill-2').click();
    await expect(page).toHaveURL(/\/v2\/student\/speaking\/exam\/session\/501/, { timeout: 30_000 });
    expect(created).toMatchObject({ provider: 'GOETHE', level: 'A1', mode: 'DRILL', teil: 2 });

    // Phòng thi: thẻ đề + lời giám khảo + gợi ý hành động.
    await expect(page.getByTestId('stimulus-theme-card')).toContainText('Brot');
    await expect(page.getByTestId('exam-transcript')).toContainText('Teil 2');
    await expect(page.getByTestId('directive-hint')).toContainText('Đặt MỘT câu hỏi');
    await expect(page.getByTestId('mic-bar').getByRole('status')).toContainText('ĐẶT CÂU HỎI');
    await expect(page.getByTestId('exam-timer')).toBeVisible();

    // Drill cho phép gõ thay mic.
    await page.getByTestId('mic-text-mode').click();
    await page.getByTestId('mic-text-input').fill('Du isst gern Brot?');
    await page.getByTestId('mic-text-send').click();

    await expect(page.getByTestId('exam-transcript')).toContainText('Du isst gern Brot?');
    await expect(page.getByTestId('exam-transcript')).toContainText('was kochst du in der Küche');
    await expect(page.getByTestId('drill-eval')).toContainText('8/10');
    await expect(page.getByTestId('drill-eval')).toContainText('Isst du gern Brot?');
    // Sang bước ANSWER: thẻ của bạn thi + gợi ý đổi.
    await expect(page.getByTestId('stimulus-theme-card')).toContainText('Küche');
    await expect(page.getByTestId('directive-hint')).toContainText('Trả lời câu hỏi');
    await expect(page.getByTestId('mic-bar').getByRole('status')).toContainText('TRẢ LỜI');
    await expect(page.getByTestId('turn-latency')).toBeVisible();
  });

  test('mock đã chấm → Ergebnisbogen đúng phiếu A1 (voll/halb/null) + disclaimer', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/sessions/777', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 777, provider: 'GOETHE', level: 'A1', mode: 'MOCK', state: 'RESULTS', currentPart: 3, currentStep: 4, totalParts: 3,
          serverNow: NOW.toISOString(), prepDeadlineAt: null, partDeadlineAt: null, directive: null, lastTurnEval: null,
          notesText: null, gradingJobId: 9001, resultAvailable: true,
        }),
      }),
    );
    await page.route('**/api/speaking/exam/sessions/777/result', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESULT) }),
    );

    await page.goto('/v2/student/speaking/exam/session/777');
    await expect(page.getByTestId('ergebnisbogen')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('result-total')).toContainText('20');
    await expect(page.getByTestId('result-total')).toContainText('/ 25');
    await expect(page.getByTestId('ergebnisbogen')).toContainText('18–22');
    await expect(page.getByTestId('result-part-1')).toContainText('Buchstabieren');
    await expect(page.getByTestId('result-part-1')).toContainText('HALB');
    await expect(page.getByTestId('result-part-3')).toContainText('NULL');
    await expect(page.getByTestId('ergebnisbogen')).toContainText('die Küche');
    await expect(page.getByTestId('result-disclaimer')).toContainText('không phải chứng nhận');
    // Stepper: mọi Teil đã xong.
    await expect(page.getByTestId('teil-stepper')).toBeVisible();
  });

  test('mock đang chấm → poll tới RESULTS', async ({ page }) => {
    await baseMocks(page);
    let polls = 0;
    // React StrictMode (dev) nạp phiên 2 lần ngay lúc mở → 2 GET đầu luôn GRADING; poll 3s/lần → lần 3 vẫn
    // GRADING (để assertion bắt được), lần 4 mới RESULTS. Không phụ thuộc đồng hồ, chỉ phụ thuộc số lần gọi.
    await page.route('**/api/speaking/exam/sessions/778', (route) => {
      polls += 1;
      const state = polls >= 4 ? 'RESULTS' : 'GRADING';
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 778, provider: 'TELC', level: 'A1', mode: 'MOCK', state, currentPart: 3, currentStep: 4, totalParts: 3,
          serverNow: NOW.toISOString(), prepDeadlineAt: null, partDeadlineAt: null, directive: null, lastTurnEval: null,
          notesText: null, gradingJobId: 9002, resultAvailable: state === 'RESULTS',
        }),
      });
    });
    await page.route('**/api/speaking/exam/sessions/778/result', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...RESULT, sessionId: 778, provider: 'TELC', scoreSheet: { ...RESULT.scoreSheet, rubricRef: { provider: 'TELC', level: 'A1', version: 1 } } }) }),
    );
    await page.goto('/v2/student/speaking/exam/session/778');
    await expect(page.getByTestId('exam-grading')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ergebnisbogen')).toBeVisible({ timeout: 30_000 });
  });

  test('A2 Teil 3 lịch tuần: chỉ hiện lịch của mình, không bao giờ vẽ khóa partner*', async ({ page }) => {
    await baseMocks(page);
    const calendarSession = {
      id: 602, provider: 'GOETHE', level: 'A2', mode: 'DRILL', state: 'IN_PART', currentPart: 3, currentStep: 0, totalParts: 1,
      serverNow: NOW.toISOString(), prepDeadlineAt: null, partDeadlineAt: deadline(300),
      directive: {
        teilNo: 3, title: 'Gemeinsam etwas planen', archetype: 'PLAN_NEGOTIATE', stepIndex: 0, stepCount: 8, candidateAction: 'SPEAK',
        hintVi: 'Mở đầu: đề xuất một ngày/giờ còn trống trong lịch CỦA BẠN (bạn thi có lịch khác).',
        // Server đã lược partnerCalendar; giả lập một backend lỗi vẫn gửi — client vẫn KHÔNG được vẽ.
        stimulus: { type: 'CALENDAR_PAIR', situation: 'Sie möchten zusammen ins Kino gehen.', goal: 'Finden Sie einen Termin.',
          candidateCalendar: { Montag: ['frei'], Dienstag: ['8–16 Arbeit'], Samstag: ['Besuch von Eltern'] },
          partnerCalendar: { Montag: ['GEHEIM-ARBEIT'] } },
        prueferText: 'Teil 3: Gemeinsam etwas planen. Sie sehen Ihren Terminkalender; Ihr Partner hat einen anderen Kalender.',
        prueferVoice: 'PRUEFER', lastAiRole: null, lastAiText: null,
      },
      lastTurnEval: null, notesText: null, gradingJobId: null, resultAvailable: false,
    };
    await page.route('**/api/speaking/exam/sessions/602', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(calendarSession) }),
    );
    await page.goto('/v2/student/speaking/exam/session/602');
    const card = page.getByTestId('stimulus-calendar-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Kino');
    await expect(card).toContainText('Montag');
    await expect(card).toContainText('8–16 Arbeit');
    await expect(page.locator('main')).not.toContainText('GEHEIM-ARBEIT');
    await expect(page.getByTestId('directive-hint')).toContainText('lịch CỦA BẠN');
  });

  test('A2: thẻ Stichwort (Fragen zur Person) và thẻ gợi ý (Von sich erzählen) render đúng', async ({ page }) => {
    await baseMocks(page);
    const mk = (stim: Record<string, unknown>, action: string, archetype: string) => ({
      id: 603, provider: 'GOETHE', level: 'A2', mode: 'DRILL', state: 'IN_PART', currentPart: 1, currentStep: 0, totalParts: 1,
      serverNow: NOW.toISOString(), prepDeadlineAt: null, partDeadlineAt: deadline(180),
      directive: { teilNo: 1, title: 'Fragen zur Person', archetype, stepIndex: 0, stepCount: 8, candidateAction: action, hintVi: 'x',
        stimulus: stim, prueferText: 'Teil 1: Fragen zur Person.', prueferVoice: 'PRUEFER', lastAiRole: null, lastAiText: null },
      lastTurnEval: null, notesText: null, gradingJobId: null, resultAvailable: false,
    });
    let current = mk({ type: 'PERSON_CARD', keyword: 'Geburtstag?' }, 'ASK', 'CARD_QA');
    await page.route('**/api/speaking/exam/sessions/603', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }),
    );
    await page.goto('/v2/student/speaking/exam/session/603');
    await expect(page.getByTestId('stimulus-person-card')).toContainText('Geburtstag?');
    await expect(page.getByTestId('stimulus-person-card')).toContainText('Thẻ của bạn');

    current = mk({ type: 'PROMPT_CARD', prompt: 'Was machen Sie mit Ihrem Geld?', hints: ['Sparen?', 'Reisen?'] }, 'SPEAK', 'ABOUT_ME');
    await page.reload();
    await expect(page.getByTestId('stimulus-prompt-card')).toContainText('Was machen Sie mit Ihrem Geld?');
    await expect(page.getByTestId('stimulus-prompt-card')).toContainText('Sparen?');
  });

  test('B1 mock: màn chuẩn bị có tài liệu 3 Teil, phải chọn 1/2 chủ đề mới được vào thi, không lộ bài của partner', async ({ page }) => {
    await baseMocks(page);
    const folien = ['Thema vorstellen', 'Eigene Erfahrung', 'Heimatland', 'Vor- und Nachteile', 'Schluss'];
    let chosen: number | null = null;
    const prepSession = () => ({
      id: 701, provider: 'GOETHE', level: 'B1', mode: 'MOCK', state: 'PREP', currentPart: 0, currentStep: 0, totalParts: 3,
      serverNow: NOW.toISOString(), prepDeadlineAt: deadline(300), prepSec: 300, partDeadlineAt: null, directive: null, lastTurnEval: null,
      notesText: null, gradingJobId: null, resultAvailable: false,
      prepMaterials: [
        { teilNo: 1, title: 'Gemeinsam etwas planen', archetype: 'PLAN_NEGOTIATE', choiceRequired: false, chosenIndex: null,
          stimuli: [{ type: 'PLANNING_CARD', situation: 'Eine Kollegin liegt im Krankenhaus.', prompts: ['Wann besuchen?', 'Was mitbringen?'] }] },
        { teilNo: 2, title: 'Ein Thema präsentieren', archetype: 'PRESENT', choiceRequired: true, chosenIndex: chosen,
          stimuli: [{ type: 'FOLIEN_DECK', topic: 'Essen gehen oder selbst kochen?', folien }, { type: 'FOLIEN_DECK', topic: 'Sport im Verein oder allein?', folien }] },
        { teilNo: 3, title: 'Über ein Thema sprechen', archetype: 'FEEDBACK_FOLLOWUP', choiceRequired: false, chosenIndex: null,
          stimuli: [{ type: 'PARTNER_PRESENTATION', topic: 'Mit dem Fahrrad zur Arbeit?', instruction: 'Hören Sie zu und geben Sie eine Rückmeldung.' }] },
      ],
    });
    await page.route('**/api/speaking/exam/sessions/701', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prepSession()) }),
    );
    await page.route('**/api/speaking/exam/sessions/701/choice', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      chosen = body.index;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prepSession()) });
    });
    await page.goto('/v2/student/speaking/exam/session/701');
    await expect(page.getByTestId('exam-prep')).toBeVisible();
    await expect(page.getByTestId('prep-materials')).toContainText('Krankenhaus');
    await expect(page.getByTestId('stimulus-folien-card').first()).toContainText('Thema vorstellen');
    await expect(page.getByTestId('stimulus-partner-presentation-card')).toContainText('Fahrrad');
    await expect(page.getByTestId('exam-timer')).toBeVisible();
    // Chưa chọn chủ đề → không vào thi được.
    await expect(page.getByTestId('prep-enter')).toBeDisabled();
    await page.getByTestId('choose-2-1').click();
    await expect(page.getByTestId('choose-2-1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('prep-enter')).toBeEnabled();
    expect(chosen).toBe(1);
  });

  test('telc B1 Teil 2: Vorlage A có biểu đồ SVG, không lộ Vorlage B', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/sessions/702', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 702, provider: 'TELC', level: 'B1', mode: 'DRILL', state: 'IN_PART', currentPart: 2, currentStep: 0, totalParts: 1,
          serverNow: NOW.toISOString(), prepDeadlineAt: null, prepSec: null, prepMaterials: null, partDeadlineAt: deadline(330),
          directive: { teilNo: 2, title: 'Gespräch über ein Thema', archetype: 'TOPIC_EXCHANGE', stepIndex: 0, stepCount: 8, candidateAction: 'SPEAK',
            hintVi: 'Thuật lại Vorlage của bạn.', prueferText: 'Teil 2.', prueferVoice: 'PRUEFER', lastAiRole: null, lastAiText: null,
            stimulus: { type: 'TOPIC_GRAPHIC_PAIR', thema: 'Ferien und Reisen', candidateText: 'Fiktive Umfrage: Wohin fahren Deutsche?', instruction: 'Berichten Sie.',
              candidateChart: { title: 'Urlaubsziele (fiktiv, in %)', unit: '%', series: [{ label: 'Deutschland', value: 34 }, { label: 'Italien', value: 18 }] },
              partnerText: 'GEHEIM-VORLAGE-B' } },
          lastTurnEval: null, notesText: null, gradingJobId: null, resultAvailable: false,
        }),
      }),
    );
    await page.goto('/v2/student/speaking/exam/session/702');
    const card = page.getByTestId('stimulus-graphic-card');
    await expect(card).toContainText('Ferien und Reisen');
    await expect(card.locator('svg rect')).toHaveCount(2);
    await expect(card).toContainText('34%');
    await expect(page.locator('main')).not.toContainText('GEHEIM-VORLAGE-B');
  });

  test('B2 mock: Vortrag chọn 1/2 hiện đủ 3 gạch nội dung, thẻ Diskussion không lộ lập trường partner', async ({ page }) => {
    await baseMocks(page);
    const aspects = [
      'Beschreiben Sie mehrere Möglichkeiten oder Aspekte.',
      'Bewerten Sie Vor- und Nachteile.',
      'Beschreiben Sie eine Möglichkeit genauer und begründen Sie Ihre Wahl.',
    ];
    let chosen: number | null = null;
    const prepSession = () => ({
      id: 703, provider: 'GOETHE', level: 'B2', mode: 'MOCK', state: 'PREP', currentPart: 0, currentStep: 0, totalParts: 2,
      serverNow: NOW.toISOString(), prepDeadlineAt: deadline(300), prepSec: 300, partDeadlineAt: null, directive: null, lastTurnEval: null,
      notesText: null, gradingJobId: null, resultAvailable: false,
      prepMaterials: [
        { teilNo: 1, title: 'Vortrag halten', archetype: 'PRESENT', choiceRequired: true, chosenIndex: chosen,
          stimuli: [
            { type: 'TOPIC_CHOICE', context: 'Sie besuchen ein Seminar und halten dort einen kurzen Vortrag.',
              topic: 'Wie sollten Städte den Autoverkehr in den Innenstädten regeln?', aspects, structureHint: 'Einleitung – Hauptteil – Schluss' },
            { type: 'TOPIC_CHOICE', context: 'Sie besuchen ein Seminar und halten dort einen kurzen Vortrag.',
              topic: 'Sollten Unternehmen ihren Mitarbeitenden Homeoffice garantieren?', aspects, structureHint: 'Einleitung – Hauptteil – Schluss' },
          ] },
        // Server đã lược partnerStance; nếu nó lọt ra đây là rò đề riêng của partner.
        { teilNo: 2, title: 'Diskussion führen', archetype: 'DISCUSS', choiceRequired: false, chosenIndex: null,
          stimuli: [{ type: 'DEBATE_CARD', context: 'Sie sind in einem Debattierclub.',
            question: 'Sollten Arbeitgeber die Vier-Tage-Woche einführen?',
            instruction: 'Tauschen Sie Ihren Standpunkt aus und fassen Sie am Ende zusammen.' }] },
      ],
    });
    await page.route('**/api/speaking/exam/sessions/703', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prepSession()) }),
    );
    await page.route('**/api/speaking/exam/sessions/703/choice', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      chosen = body.index;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prepSession()) });
    });
    await page.goto('/v2/student/speaking/exam/session/703');
    await expect(page.getByTestId('exam-prep')).toBeVisible();

    const vortrag = page.getByTestId('stimulus-topic-choice-card').first();
    await expect(vortrag).toContainText('Autoverkehr');
    await expect(vortrag).toContainText('Vor- und Nachteile');
    await expect(vortrag).toContainText('Einleitung – Hauptteil – Schluss');

    const debate = page.getByTestId('stimulus-debate-card');
    await expect(debate).toContainText('Vier-Tage-Woche');
    await expect(debate).toContainText('Debattierclub');
    await expect(page.getByTestId('prep-materials')).not.toContainText('partnerStance');
    await expect(page.getByTestId('prep-materials')).not.toContainText('dagegen');

    await expect(page.getByTestId('prep-enter')).toBeDisabled();
    await page.getByTestId('choose-1-1').click();
    await expect(page.getByTestId('prep-enter')).toBeEnabled();
    expect(chosen).toBe(1);
  });

  test('telc B2 Teil 2: thẻ Diskussion hiện đoạn text nguồn kèm câu hỏi', async ({ page }) => {
    await baseMocks(page);
    await page.route('**/api/speaking/exam/sessions/704', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 704, provider: 'TELC', level: 'B2', mode: 'DRILL', state: 'IN_PART', currentPart: 2, currentStep: 0, totalParts: 1,
          serverNow: NOW.toISOString(), prepDeadlineAt: null, prepSec: null, prepMaterials: null, partDeadlineAt: deadline(150),
          directive: { teilNo: 2, title: 'Diskussion', archetype: 'DISCUSS', stepIndex: 0, stepCount: 6, candidateAction: 'SPEAK',
            hintVi: 'Nêu rõ quan điểm của bạn.', prueferText: 'Teil 2.', prueferVoice: 'PRUEFER', lastAiRole: null, lastAiText: null,
            stimulus: { type: 'DEBATE_TEXT',
              text: 'Immer mehr Betriebe erlauben Hunde am Arbeitsplatz. Befürworter sprechen von einem besseren Betriebsklima.',
              question: 'Sollten Hunde am Arbeitsplatz erlaubt sein?',
              instruction: 'Diskutieren Sie über den Text.' } },
          lastTurnEval: null, notesText: null, gradingJobId: null, resultAvailable: false,
        }),
      }),
    );
    await page.goto('/v2/student/speaking/exam/session/704');
    const debate = page.getByTestId('stimulus-debate-card');
    await expect(debate).toContainText('Hunde am Arbeitsplatz');
    await expect(debate).toContainText('Betriebsklima');
    await expect(debate).not.toContainText('partnerStance');
  });
});
