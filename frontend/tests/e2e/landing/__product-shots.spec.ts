import { test, type Page } from '@playwright/test'
import { STUDENT_TOKEN, TEACHER_TOKEN, studentCookies, teacherCookies } from '../../helpers/tokens'

/**
 * Ảnh chụp sản phẩm cho trang chủ (landing) — chạy TAY, không phải test hồi quy.
 *
 * Tên bắt đầu bằng "__" theo quy ước các spec chụp ảnh sẵn có (`teacher/__curriculum-import-shots`):
 * không assert gì, chỉ ghi PNG ra `test-results/landing-shots/<locale>/`.
 *
 * Mọi API đều mock bằng dữ liệu minh hoạ (tên học viên trùng thẻ "Bảng giáo viên · Lớp K30" trên
 * landing) nên ảnh KHÔNG chứa dữ liệu thật của ai. Landing dịch cả ba thứ tiếng, mà chữ trong ảnh
 * thì "nướng cứng" vào file — nên mỗi màn chụp một lần cho mỗi locale; `locale` là cookie mà
 * `src/i18n/request.ts` đọc server-side (KHÔNG phải `NEXT_LOCALE`).
 *
 * Mọi phép chờ ở đây phải bám dữ liệu ĐỘC LẬP NGÔN NGỮ (tên người, tiêu đề bài tiếng Đức, số nội
 * suy) — chờ theo nhãn tiếng Việt là spec chỉ chạy được đúng locale vi.
 *
 * Chạy lại và cập nhật ảnh trong `public/landing/`:
 *   npx playwright test tests/e2e/landing/__product-shots.spec.ts
 *   node scripts/build-landing-shots.mjs
 */

const LOCALES = ['vi', 'en', 'de'] as const
type Locale = (typeof LOCALES)[number]

const OUT = 'test-results/landing-shots'

/**
 * CHỈ chụp khổ desktop. Đã thử thêm bộ ảnh khổ điện thoại (430 px) và bỏ: dưới 768 px app đổi
 * hẳn bố cục (cây lộ trình rơi về danh sách, ma trận điểm gập lại, dải 4 trục biến mất), nên mọi
 * phép chờ ở dưới treo và mỗi màn cần khung ngắm riêng — một việc đúng nghĩa, không phải biến thể
 * của spec này. Trên landing, `GaShot` cho vuốt ngang ở khổ hẹp để chữ vẫn đọc được.
 */
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const localeCookies = (locale: Locale) => [
  { name: 'locale', value: locale, domain: 'localhost', path: '/' },
  { name: 'NEXT_LOCALE', value: locale, domain: 'localhost', path: '/' },
]

/** Chờ font + mạng lặng rồi mới bấm máy: chụp sớm là ảnh dính font hệ thống hoặc ô shimmer. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(400)
}

const shot = (page: Page, locale: Locale, name: string) =>
  page.screenshot({ path: `${OUT}/${locale}/${name}.png`, animations: 'disabled', caret: 'hide' })

// ───────────────────────────── Dữ liệu minh hoạ · lớp K30 ─────────────────────────────

const CLASS_ID = 30
const CLASSES = [
  { id: CLASS_ID, name: 'K30 · B1 tối 2-4-6', isActive: true, studentCount: 10 },
  { id: 31, name: 'K31 · A2 sáng', isActive: true, studentCount: 8 },
]

const STUDENTS = [
  'Võ Thị Hoa',
  'Phạm Thị Mai',
  'Lê Đức Anh',
  'Nguyễn Văn Bình',
  'Trần Thu Trang',
  'Hoàng Minh Tuấn',
  'Đặng Thị Lan',
  'Bùi Quang Huy',
  'Ngô Thị Yến',
  'Vũ Hải Nam',
]

const ASSIGNMENTS = [
  { id: 1, topic: 'Vorstellungsgespräch – Runde 1', assignmentType: 'SPEAKING_SCENARIO', skill: 'SPRECHEN', dueDate: '2026-08-26' },
  { id: 2, topic: 'E-Mail an den Chef', assignmentType: 'WRITING', skill: 'SCHREIBEN', dueDate: '2026-08-28' },
  { id: 3, topic: 'Hören: Im Krankenhaus', assignmentType: 'MOCK_TEST', skill: 'HOREN', dueDate: '2026-08-31' },
  { id: 4, topic: 'Lesen: Stellenanzeigen', assignmentType: 'MOCK_TEST', skill: 'LESEN', dueDate: '2026-09-02' },
  { id: 5, topic: 'Perfekt & Präteritum', assignmentType: 'GRAMMAR', skill: null, dueDate: '2026-09-04' },
  { id: 6, topic: 'Wortschatz: Pflege', assignmentType: 'VOCABULARY', skill: null, dueDate: '2026-09-06' },
  { id: 7, topic: 'Meinung äußern (Schreiben)', assignmentType: 'ESSAY', skill: 'SCHREIBEN', dueDate: '2026-09-09' },
  { id: 8, topic: 'Vorstellungsgespräch – Runde 2', assignmentType: 'SPEAKING_SCENARIO', skill: 'SPRECHEN', dueDate: '2026-09-12' },
]

// Mỗi ô: G<điểm> đã chấm · A = AI chấm chờ xác nhận · S = đã nộp chờ chấm · P = chưa nộp · F = chấm lỗi
const CELLS: string[][] = [
  ['G91', 'G88', 'G84', 'G90', 'G86', 'G94', 'S', 'P'],
  ['G78', 'G82', 'G75', 'G80', 'G71', 'G85', 'S', 'P'],
  ['G64', 'P', 'G58', 'P', 'G62', 'P', 'P', 'P'],
  ['G85', 'G79', 'G88', 'G83', 'G90', 'G81', 'A', 'P'],
  ['G72', 'G76', 'G70', 'G74', 'G68', 'G79', 'G77', 'P'],
  ['G93', 'G90', 'G95', 'G89', 'G92', 'G96', 'A', 'S'],
  ['G80', 'G84', 'G78', 'G82', 'G75', 'G88', 'G83', 'P'],
  ['G69', 'G73', 'G66', 'G70', 'G72', 'G75', 'F', 'P'],
  ['G87', 'G85', 'G90', 'G86', 'G84', 'G91', 'G88', 'P'],
  ['G76', 'G70', 'G74', 'G78', 'G73', 'G80', 'S', 'P'],
]

function cellOf(code: string, dueDate: string) {
  const submittedAt = `${dueDate}T19:30:00`
  if (code.startsWith('G')) return { status: 'GRADED', score: Number(code.slice(1)), submittedAt }
  if (code === 'A') return { status: 'AI_GRADED', score: 80, submittedAt }
  if (code === 'S') return { status: 'SUBMITTED', score: null, submittedAt }
  if (code === 'F') return { status: 'GRADING_FAILED', score: null, submittedAt }
  return { status: 'PENDING', score: null, submittedAt: null }
}

function gradebook() {
  const students = STUDENTS.map((name, i) => {
    const cells: Record<string, ReturnType<typeof cellOf>> = {}
    const scores: number[] = []
    ASSIGNMENTS.forEach((a, j) => {
      const c = cellOf(CELLS[i][j], a.dueDate)
      cells[String(a.id)] = c
      if (c.status === 'GRADED' && c.score != null) scores.push(c.score)
    })
    const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null
    return { studentId: 100 + i, name, email: `hv${i + 1}@example.com`, avgScore, cells }
  })
  return { classId: CLASS_ID, className: CLASSES[0].name, assignments: ASSIGNMENTS, students }
}

function skillReport() {
  const rows = STUDENTS.map((name, i) => {
    const base = [88, 76, 60, 84, 73, 92, 81, 70, 87, 75][i]
    const [horen, lesen, schreiben, sprechen] = [base - 2, base + 3, base - 5, base + 1]
    const total = Math.round((horen + lesen + schreiben + sprechen) / 4)
    const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : 'C'
    return { studentId: 100 + i, name, email: `hv${i + 1}@example.com`, horen, lesen, schreiben, sprechen, total, grade }
  })
  return { classId: CLASS_ID, className: CLASSES[0].name, students: rows }
}

const FOUR_AXIS = {
  content: { taughtItems: 42, partialItems: 3, totalItems: 60, completedLessons: 14, totalLessons: 20 },
  pacing: { projectedEndDate: '2026-11-20', remainingMinutes: 1080, availableMinutes: 1350, shortfallMinutes: 0, suggestedExtraSessions: 0, milestonesAtRisk: 0 },
  participation: { presentCount: 132, lateCount: 6, absentCount: 4, needsMakeupOpen: 1, completedSessions: 14, totalPastSessions: 14 },
  objectives: { achieved: 18, needsPractice: 5, notAssessedCells: 12, totalObjectives: 24, studentsNeedingSupport: ['Lê Đức Anh'] },
}

const ESSAY_PROMPT = 'Schreiben Sie Ihre Meinung zum Thema „Arbeiten im Ausland“ (ca. 80 Wörter).'

const QUEUE = [
  {
    id: 701, assignmentId: 7, studentId: 101, studentName: 'Phạm Thị Mai', studentEmail: 'hv2@example.com',
    topic: 'Meinung äußern (Schreiben)', description: ESSAY_PROMPT,
    assignmentType: 'ESSAY', dueDate: '2026-09-09', classId: CLASS_ID, className: CLASSES[0].name, status: 'SUBMITTED',
    submittedAt: '2026-09-09T20:14:00',
    submissionContent:
      'Ich finde, dass Arbeiten im Ausland eine große Chance ist. Man lernt eine neue Kultur kennen und verbessert die Sprache jeden Tag. ' +
      'Am Anfang ist es nicht leicht, weil man die Familie vermisst. Aber ich glaube, dass die Erfahrung sehr wichtig für meine Zukunft ist. ' +
      'Deshalb möchte ich als Pflegekraft in Deutschland arbeiten und später vielleicht eine Weiterbildung machen.',
    submissionFileUrl: null, score: null, feedback: null, attachmentUrl: null,
  },
  {
    id: 702, assignmentId: 8, studentId: 105, studentName: 'Hoàng Minh Tuấn', studentEmail: 'hv6@example.com',
    topic: 'Vorstellungsgespräch – Runde 2', description: 'Beantworten Sie 5 Fragen der HR-Abteilung (Audio).',
    assignmentType: 'SPEAKING_SCENARIO', dueDate: '2026-09-12', classId: CLASS_ID, className: CLASSES[0].name, status: 'SUBMITTED',
    submittedAt: '2026-09-10T08:02:00', submissionContent: null, submissionFileUrl: 'audio/702.webm', score: null, feedback: null, attachmentUrl: null,
  },
  {
    id: 703, assignmentId: 7, studentId: 103, studentName: 'Nguyễn Văn Bình', studentEmail: 'hv4@example.com',
    topic: 'Meinung äußern (Schreiben)', description: ESSAY_PROMPT,
    assignmentType: 'ESSAY', dueDate: '2026-09-09', classId: CLASS_ID, className: CLASSES[0].name, status: 'AI_GRADED',
    submittedAt: '2026-09-08T21:40:00',
    submissionContent: 'Meiner Meinung nach ist Arbeiten im Ausland gut für junge Leute, weil sie viel Erfahrung sammeln können…',
    submissionFileUrl: null, score: 78, feedback: null, attachmentUrl: null,
  },
  {
    id: 704, assignmentId: 7, studentId: 100, studentName: 'Võ Thị Hoa', studentEmail: 'hv1@example.com',
    topic: 'Meinung äußern (Schreiben)', description: ESSAY_PROMPT,
    assignmentType: 'ESSAY', dueDate: '2026-09-09', classId: CLASS_ID, className: CLASSES[0].name, status: 'SUBMITTED',
    submittedAt: '2026-09-09T22:05:00', submissionContent: null, submissionFileUrl: null, score: null, feedback: null, attachmentUrl: null,
  },
  {
    id: 705, assignmentId: 6, studentId: 207, studentName: 'Trịnh Văn Long', studentEmail: 'hv31@example.com',
    topic: 'Wortschatz: Beim Arzt', description: '20 Wörter zum Thema Arztbesuch.',
    assignmentType: 'VOCABULARY', dueDate: '2026-09-08', classId: 31, className: CLASSES[1].name, status: 'SUBMITTED',
    submittedAt: '2026-09-08T18:20:00', submissionContent: 'der Termin, die Sprechstunde, das Rezept, die Überweisung, …',
    submissionFileUrl: null, score: null, feedback: null, attachmentUrl: null,
  },
]

const GRADING_STATS = {
  totalPending: 5,
  totalGraded: 42,
  byClass: [
    { classId: CLASS_ID, className: CLASSES[0].name, pending: 4, graded: 28 },
    { classId: 31, className: CLASSES[1].name, pending: 1, graded: 14 },
  ],
}

async function teacherSession(page: Page, locale: Locale) {
  await page.context().addCookies([...localeCookies(locale), ...teacherCookies()])
  await page.addInitScript((t) => localStorage.setItem('accessToken', t), TEACHER_TOKEN)

  await page.route('**/api/**', (r) => r.fulfill(json([])))
  await page.route(/.+\/api\/auth\/me$/, (r) => r.fulfill(json({ displayName: 'Nguyễn Thu Hà', role: 'TEACHER', userId: 2 })))
  await page.route('**/api/v2/teacher/classes', (r) => r.fulfill(json(CLASSES)))
  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/four-axis-report`, (r) => r.fulfill(json(FOUR_AXIS)))
  await page.route(`**/api/v2/teacher/reports/classes/${CLASS_ID}/gradebook`, (r) => r.fulfill(json(gradebook())))
  await page.route(`**/api/v2/teacher/reports/classes/${CLASS_ID}/skill-report`, (r) => r.fulfill(json(skillReport())))
  await page.route(`**/api/v2/teacher/classes/${CLASS_ID}/competency`, (r) => r.fulfill(json({ enrolledCount: 10, items: [] })))
  await page.route('**/api/v2/teacher/grading/queue*', (r) => r.fulfill(json(QUEUE)))
  await page.route('**/api/v2/teacher/grading/stats', (r) => r.fulfill(json(GRADING_STATS)))
}

// ───────────────────────────── Dữ liệu minh hoạ · học viên ─────────────────────────────

const ROADMAP_TITLES = [
  'Sich vorstellen', 'Mein Beruf', 'Im Team', 'Der Arbeitstag', 'Termine machen',
  'Beim Arzt', 'Im Krankenhaus', 'Medikamente', 'Die Untersuchung', 'Notfall!',
  'Patientengespräch', 'Angehörige beraten', 'Pflegeplanung', 'Hygiene', 'Übergabe',
  'Bewerbung schreiben', 'Lebenslauf', 'Vorstellungsgespräch I', 'Vorstellungsgespräch II', 'Gehalt & Vertrag',
  'Wohnung suchen', 'Behördengang', 'Bankkonto', 'Versicherung', 'Freizeit',
  'Prüfung: Lesen', 'Prüfung: Hören', 'Prüfung: Schreiben', 'Prüfung: Sprechen', 'Abschluss',
]

/** 30 ngày × 6 tuần: 12 ngày đã xong, ngày 13 đang học, ngày 14 đã mở, còn lại khoá. */
function b1Roadmap() {
  return ROADMAP_TITLES.map((title, i) => {
    const day = i + 1
    const progressStatus = day <= 12 ? 'COMPLETED' : day === 13 ? 'IN_PROGRESS' : day === 14 ? 'AVAILABLE' : 'LOCKED'
    const state = progressStatus === 'COMPLETED' ? 'completed' : progressStatus === 'LOCKED' ? 'locked' : 'current'
    return {
      id: 100 + day,
      code: `D${String(day).padStart(2, '0')}`,
      title,
      subtitle: title,
      emoji: '📘',
      state,
      xpReward: 120,
      lessonsTotal: 4,
      lessonsCompleted: progressStatus === 'COMPLETED' ? 4 : progressStatus === 'IN_PROGRESS' ? 2 : 0,
      cefrLevel: 'B1',
      description: title,
      dayNumber: day,
      weekNumber: Math.ceil(day / 5),
      progressStatus,
      skillCounts: { HOEREN: 3, SPRECHEN: 3, LESEN: 2, SCHREIBEN: 2 },
      prerequisiteCode: day > 1 ? `D${String(day - 1).padStart(2, '0')}` : null,
    }
  })
}

const STUDENT_ME = {
  displayName: 'Trần Thu Trang',
  role: 'STUDENT',
  userId: 1,
  email: 'hv5@example.com',
  learningTargetLevel: 'B1',
}

async function studentSession(page: Page, locale: Locale) {
  await page.context().addCookies([...localeCookies(locale), ...studentCookies()])
  await page.addInitScript((t) => localStorage.setItem('accessToken', t), STUDENT_TOKEN)
  await page.route('**/api/**', (r) => r.fulfill(json({})))
  await page.route(/.+\/api\/auth\/me$/, (r) => r.fulfill(json(STUDENT_ME)))
  await page.route('**/api/auth/me/plan', (r) => r.fulfill(json({ planCode: 'PRO', tier: 'PRO' })))
}

const EXAM = {
  id: 1,
  cefr_level: 'B1',
  exam_format: 'GOETHE',
  title: 'Goethe-Zertifikat B1 — Modellsatz 1',
  total_points: 100,
  pass_points: 60,
  time_limit_minutes: 65,
}

const SECTIONS = {
  sections: [
    {
      name: 'LESEN',
      label_vi: 'Đọc hiểu',
      time_minutes: 65,
      max_points: 30,
      teile: [
        {
          teil: 1,
          // Câu dẫn để tiếng ĐỨC ở cả ba locale, theo đúng quy ước của trang chủ: nội dung học
          // bằng tiếng Đức giữ nguyên mọi ngôn ngữ (xem chú thích đầu GaLanding.tsx). Trước đây
          // để tiếng Việt thì ảnh trên trang chủ tiếng Đức có một dòng khách không đọc được, giữa
          // một đề thi vốn toàn tiếng Đức.
          instruction_vi: 'Lesen Sie den Blogbeitrag von Lena. Sind die Aussagen richtig oder falsch?',
          items: [
            { id: 'q1', question: 'Lena hat ihre Ausbildung als Pflegekraft in Hamburg gemacht.', type: 'RICHTIG_FALSCH' },
            { id: 'q2', question: 'Sie arbeitet seit zwei Jahren im Nachtdienst.', type: 'RICHTIG_FALSCH' },
            { id: 'q3', question: 'Ihre Kolleginnen kommen aus fünf verschiedenen Ländern.', type: 'RICHTIG_FALSCH' },
            {
              id: 'q4',
              question: 'Welche Aussage passt am besten zum Text?',
              type: 'MULTIPLE_CHOICE',
              options: {
                A: 'Lena möchte bald den Beruf wechseln.',
                B: 'Lena fühlt sich in ihrem Team wohl.',
                C: 'Lena findet die Arbeit zu anstrengend.',
              },
            },
          ],
        },
      ],
    },
    { name: 'HOEREN', label_vi: 'Nghe hiểu', time_minutes: 40, max_points: 30, teile: [{ teil: 1, instruction_vi: 'Nghe và chọn', items: [] }] },
    { name: 'SCHREIBEN', label_vi: 'Viết', time_minutes: 60, max_points: 20, teile: [{ teil: 1, instruction_vi: 'Viết e-mail', items: [] }] },
  ],
}

// ───────────────────────────── Các màn chụp ─────────────────────────────

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test('giáo viên · báo cáo lớp', async ({ page }) => {
      await teacherSession(page, locale)
      await page.goto(`/v2/teacher/tc-reports?classId=${CLASS_ID}`)
      await page.getByText('42/60').first().waitFor() // ô "nội dung đã dạy" — số nội suy, mọi locale
      await page.getByText('Võ Thị Hoa').first().waitFor()
      await settle(page)
      await shot(page, locale, 'teacher-class-report')
    })

    test('giáo viên · hàng đợi chấm bài', async ({ page }) => {
      await teacherSession(page, locale)
      await page.goto('/v2/teacher/grading')
      await page.getByText(ESSAY_PROMPT).first().waitFor()
      await settle(page)
      await shot(page, locale, 'teacher-grading')
    })

    test('học viên · cây lộ trình', async ({ page }) => {
      await studentSession(page, locale)
      await page.route('**/api/roadmap/me', (r) => r.fulfill(json(b1Roadmap())))
      await page.goto('/v2/student/roadmap')
      await page.getByText('Pflegeplanung').first().waitFor()
      await settle(page)
      await shot(page, locale, 'student-roadmap-tree')
    })

    test('học viên · thi thử Goethe B1', async ({ page }) => {
      await studentSession(page, locale)
      await page.route(/.+\/api\/mock-exams\?/, (r) => r.fulfill(json([EXAM])))
      await page.route(/.+\/api\/mock-exams\/recommend\?/, (r) => r.fulfill(json({ recommendedExamId: 1 })))
      await page.route('**/api/mock-exams/attempts/me', (r) => r.fulfill(json([])))
      await page.route('**/api/mock-exams/attempts/77/draft', (r) => r.fulfill(json({ version: 1, remaining_seconds: 60 * 58 + 12 })))
      await page.route('**/api/mock-exams/1/start', (r) =>
        r.fulfill(json({ id: 77, sections_json: JSON.stringify(SECTIONS), time_limit_minutes: 65, remaining_seconds: 60 * 58 + 12 })),
      )
      await page.goto('/v2/student/mock-exam/run?examId=1')
      await page.locator('input[name="q1"]').first().waitFor({ timeout: 30_000 })
      // Chọn sẵn hai câu: ảnh cần trạng thái "đang làm bài", không phải một biểu mẫu trắng.
      await page.locator('input[name="q1"]').first().check({ force: true })
      await page.locator('input[name="q2"]').nth(1).check({ force: true })
      await settle(page)
      await shot(page, locale, 'student-mock-exam')
    })
  })
}
