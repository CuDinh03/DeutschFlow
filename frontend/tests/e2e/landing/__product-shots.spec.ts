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
 * Chạy lại và cập nhật ảnh trong `src/assets/landing/`:
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

const SESSIONS_DONE = 14

// Tổng lượt điểm danh phải bằng SĨ SỐ × SỐ BUỔI ĐÃ CHỐT, nếu không dải "Tham gia" trên ảnh tự tố
// là số bịa: 10 học viên × 14 buổi = 140 lượt, không thể có 142.
const PRESENT = STUDENTS.length * SESSIONS_DONE - 6 - 4

const FOUR_AXIS = {
  content: { taughtItems: 42, partialItems: 3, totalItems: 60, completedLessons: SESSIONS_DONE, totalLessons: 20 },
  pacing: { projectedEndDate: '2026-11-20', remainingMinutes: 1080, availableMinutes: 1350, shortfallMinutes: 0, suggestedExtraSessions: 0, milestonesAtRisk: 0 },
  participation: { presentCount: PRESENT, lateCount: 6, absentCount: 4, needsMakeupOpen: 1, completedSessions: SESSIONS_DONE, totalPastSessions: SESSIONS_DONE },
  objectives: { achieved: 18, needsPractice: 5, notAssessedCells: 12, totalObjectives: 24, studentsNeedingSupport: ['Lê Đức Anh'] },
}

const ESSAY_PROMPT = 'Schreiben Sie Ihre Meinung zum Thema „Arbeiten im Ausland“ (ca. 80 Wörter).'

/** Bài viết mẫu của từng học viên cho bài luận id 7 — để khung bài làm trên ảnh có chữ thật. */
const ESSAY_TEXT: Record<string, string> = {
  'Võ Thị Hoa':
    'Ich finde, dass Arbeiten im Ausland eine große Chance ist. Man lernt eine neue Kultur kennen und verbessert die Sprache jeden Tag. ' +
    'Am Anfang ist es nicht leicht, weil man die Familie vermisst. Aber ich glaube, dass die Erfahrung sehr wichtig für meine Zukunft ist. ' +
    'Deshalb möchte ich als Pflegekraft in Deutschland arbeiten und später vielleicht eine Weiterbildung machen.',
  'Phạm Thị Mai':
    'Meiner Meinung nach lohnt sich die Arbeit im Ausland, weil man fachlich schneller wächst als zu Hause. ' +
    'Natürlich fehlen mir meine Eltern, und der Winter ist lang. Trotzdem würde ich mich wieder so entscheiden.',
  'Nguyễn Văn Bình':
    'Meiner Meinung nach ist Arbeiten im Ausland gut für junge Leute, weil sie viel Erfahrung sammeln können…',
  'Hoàng Minh Tuấn':
    'Ich arbeite gern im Team. Im Ausland lernt man, mit Menschen aus vielen Ländern zusammenzuarbeiten.',
  'Bùi Quang Huy':
    'Arbeiten im Ausland bedeutet für mich eine bessere Zukunft für meine Familie und einen sicheren Beruf.',
  'Vũ Hải Nam':
    'Ich möchte in Deutschland arbeiten, weil die Ausbildung dort anerkannt ist und ich später zurückkommen kann.',
}

/**
 * Hàng đợi chấm bài SINH TỪ `CELLS`, không gõ tay.
 *
 * Hai ảnh giáo viên nằm cạnh nhau trên trang chủ và cùng nói về lớp K30: sổ điểm cho thấy có bao
 * nhiêu ô đang chờ giáo viên, trung tâm chấm bài cho thấy hàng đợi. Gõ tay hai bộ số thì chúng
 * lệch nhau ngay lần sửa dữ liệu đầu tiên (bản trước: sổ điểm ngụ ý 7 bài chờ, hàng đợi nói 4),
 * và khách chỉ cần nhìn hai ảnh cạnh nhau là thấy. Sinh từ một nguồn thì không lệch được nữa.
 */
function gradingQueue() {
  const rows: Record<string, unknown>[] = []
  let id = 700
  STUDENTS.forEach((name, i) => {
    ASSIGNMENTS.forEach((a, j) => {
      const code = CELLS[i][j]
      const status =
        code === 'S' ? 'SUBMITTED' : code === 'A' ? 'AI_GRADED' : code === 'F' ? 'GRADING_FAILED' : null
      if (!status) return
      id += 1
      const speaking = a.assignmentType === 'SPEAKING_SCENARIO'
      rows.push({
        id,
        assignmentId: a.id,
        studentId: 100 + i,
        studentName: name,
        studentEmail: `hv${i + 1}@example.com`,
        topic: a.topic,
        description: a.id === 7 ? ESSAY_PROMPT : 'Beantworten Sie 5 Fragen der HR-Abteilung (Audio).',
        assignmentType: a.assignmentType,
        dueDate: a.dueDate,
        classId: CLASS_ID,
        className: CLASSES[0].name,
        status,
        submittedAt: `${a.dueDate}T20:14:00`,
        submissionContent: speaking ? null : ESSAY_TEXT[name] ?? null,
        submissionFileUrl: speaking ? `audio/${id}.webm` : null,
        // AI_GRADED = AI đã đề xuất điểm, giáo viên chưa xác nhận. Không kèm nhận xét: nhận xét
        // của máy hiện trong ô "nhận xét cho học viên" thì giáo viên dễ bấm lưu nguyên văn.
        score: status === 'AI_GRADED' ? 78 : null,
        feedback: null,
        attachmentUrl: null,
      })
    })
  })
  // Một bài của lớp khác để bộ lọc theo lớp trên ảnh có ý nghĩa.
  rows.push({
    id: 799, assignmentId: 6, studentId: 207, studentName: 'Trịnh Văn Long', studentEmail: 'hv31@example.com',
    topic: 'Wortschatz: Beim Arzt', description: '20 Wörter zum Thema Arztbesuch.',
    assignmentType: 'VOCABULARY', dueDate: '2026-09-08', classId: 31, className: CLASSES[1].name,
    status: 'SUBMITTED', submittedAt: '2026-09-08T18:20:00',
    submissionContent: 'der Termin, die Sprechstunde, das Rezept, die Überweisung, …',
    submissionFileUrl: null, score: null, feedback: null, attachmentUrl: null,
  })
  return rows
}

const QUEUE = gradingQueue()

/** Đã chấm = số ô GRADED trong ma trận; chờ chấm = số dòng hàng đợi. Cùng một nguồn với sổ điểm. */
const K30_GRADED = CELLS.flat().filter((c) => c.startsWith('G')).length
const K30_PENDING = QUEUE.filter((r) => r.classId === CLASS_ID).length
const K31_PENDING = QUEUE.length - K30_PENDING
const K31_GRADED = 14

const GRADING_STATS = {
  totalPending: QUEUE.length,
  totalGraded: K30_GRADED + K31_GRADED,
  byClass: [
    { classId: CLASS_ID, className: CLASSES[0].name, pending: K30_PENDING, graded: K30_GRADED },
    { classId: 31, className: CLASSES[1].name, pending: K31_PENDING, graded: K31_GRADED },
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

/**
 * Chặng lộ trình: [tiêu đề tiếng Đức, tiêu đề tiếng Việt, mô tả tiếng Việt].
 *
 * Ba trường này KHÔNG được nhồi cùng một chuỗi. Backend dựng RoadmapNodeDto (RoadmapService.java)
 * theo đúng thứ tự `title = title_de`, `subtitle = title_vi`, `description = description_vi`, và
 * `nodeDisplayTitle` (src/lib/roadmap-tree/types.ts) chọn `subtitle` khi locale là vi, `title` khi
 * là en/de. Bản trước gán cả `subtitle` lẫn `description` bằng tiêu đề tiếng Đức, hậu quả trên
 * ảnh: bản vi hiện tên chặng bằng tiếng Đức (sản phẩm thật hiện tiếng Việt), và cả ba bản in đúng
 * một chuỗi hai lần — tiêu đề rồi ngay dưới là "mô tả" y hệt.
 */
const ROADMAP_STAGES: [string, string, string][] = [
  ['Sich vorstellen', 'Giới thiệu bản thân', 'Chào hỏi, nói tên tuổi, nghề nghiệp và quê quán.'],
  ['Mein Beruf', 'Nghề của tôi', 'Kể về công việc hiện tại và lý do chọn nghề điều dưỡng.'],
  ['Im Team', 'Làm việc nhóm', 'Xưng hô với đồng nghiệp, hỏi và nhờ giúp trong ca trực.'],
  ['Der Arbeitstag', 'Một ngày làm việc', 'Kể trình tự công việc trong ca bằng thì hiện tại.'],
  ['Termine machen', 'Hẹn lịch', 'Đặt và đổi lịch hẹn qua điện thoại.'],
  ['Beim Arzt', 'Đi khám', 'Mô tả triệu chứng và hiểu chỉ dẫn của bác sĩ.'],
  ['Im Krankenhaus', 'Trong bệnh viện', 'Tên các khoa, đường đi và nội quy thăm bệnh.'],
  ['Medikamente', 'Thuốc men', 'Đọc đơn thuốc, liều dùng và dặn dò người bệnh.'],
  ['Die Untersuchung', 'Thăm khám', 'Hướng dẫn người bệnh trong lúc đo và kiểm tra.'],
  ['Notfall!', 'Tình huống khẩn', 'Gọi cấp cứu và báo tình trạng ngắn gọn, rõ ràng.'],
  ['Patientengespräch', 'Trò chuyện với người bệnh', 'Hỏi thăm, trấn an và giải thích bước tiếp theo.'],
  ['Angehörige beraten', 'Trao đổi với người nhà', 'Giải thích tình hình và trả lời câu hỏi của gia đình.'],
  ['Pflegeplanung', 'Lập kế hoạch chăm sóc', 'Ghi mục tiêu chăm sóc, chia việc theo ca và bàn giao.'],
  ['Hygiene', 'Vệ sinh và an toàn', 'Quy trình khử khuẩn và bảo hộ khi làm việc.'],
  ['Übergabe', 'Bàn giao ca', 'Tóm tắt diễn biến người bệnh cho ca sau.'],
  ['Bewerbung schreiben', 'Viết đơn xin việc', 'Bố cục thư xin việc và cách nêu điểm mạnh.'],
  ['Lebenslauf', 'Sơ yếu lý lịch', 'Trình bày quá trình học và làm theo chuẩn Đức.'],
  ['Vorstellungsgespräch I', 'Phỏng vấn vòng 1', 'Trả lời câu hỏi về bản thân và động cơ ứng tuyển.'],
  ['Vorstellungsgespräch II', 'Phỏng vấn vòng 2', 'Câu hỏi tình huống và câu hỏi ngược cho nhà tuyển dụng.'],
  ['Gehalt & Vertrag', 'Lương và hợp đồng', 'Từ vựng hợp đồng, thời gian thử việc và phụ cấp.'],
  ['Wohnung suchen', 'Tìm nhà', 'Đọc tin cho thuê, hẹn xem nhà và hỏi chi phí.'],
  ['Behördengang', 'Đi làm giấy tờ', 'Đăng ký cư trú, xin hẹn và điền biểu mẫu.'],
  ['Bankkonto', 'Mở tài khoản', 'Thủ tục ngân hàng và các loại phí thường gặp.'],
  ['Versicherung', 'Bảo hiểm', 'Bảo hiểm y tế bắt buộc và cách dùng thẻ.'],
  ['Freizeit', 'Thời gian rảnh', 'Rủ bạn đi chơi, nói về sở thích và kế hoạch cuối tuần.'],
  ['Prüfung: Lesen', 'Ôn thi: Đọc', 'Chiến thuật làm 5 phần đọc trong thời gian thi.'],
  ['Prüfung: Hören', 'Ôn thi: Nghe', 'Nghe thông báo, hội thoại và phỏng vấn ở tốc độ thi.'],
  ['Prüfung: Schreiben', 'Ôn thi: Viết', 'Viết email và bài nêu ý kiến đúng bố cục chấm.'],
  ['Prüfung: Sprechen', 'Ôn thi: Nói', 'Luyện phần nói cặp đôi và phần trình bày.'],
  ['Abschluss', 'Tổng kết', 'Rà lại toàn khoá và thi thử một lượt trọn vẹn.'],
]

/**
 * 30 ngày × 6 tuần: 12 ngày đã xong, ngày 13 đang học, ngày 14 đã mở, còn lại khoá.
 *
 * `description` chỉ điền ở locale vi. Backend chỉ có `description_vi` — KHÔNG có bản Đức hay Anh —
 * nên bịa một câu tiếng Đức vào đây là nói sai về sản phẩm. Còn để nguyên câu tiếng Việt thì trang
 * chủ tiếng Đức trưng một dòng khách không đọc được. Trường này vốn nullable và panel chỉ in khi
 * có (`node.description && !locked` trong TreeNodePanel), nên bỏ trống là một trạng thái CÓ THẬT
 * của sản phẩm, không phải dàn dựng.
 */
function b1Roadmap(locale: Locale) {
  return ROADMAP_STAGES.map(([titleDe, titleVi, descriptionVi], i) => {
    const day = i + 1
    const progressStatus = day <= 12 ? 'COMPLETED' : day === 13 ? 'IN_PROGRESS' : day === 14 ? 'AVAILABLE' : 'LOCKED'
    const state = progressStatus === 'COMPLETED' ? 'completed' : progressStatus === 'LOCKED' ? 'locked' : 'current'
    return {
      id: 100 + day,
      code: `D${String(day).padStart(2, '0')}`,
      title: titleDe,
      subtitle: titleVi,
      emoji: '📘',
      state,
      xpReward: 120,
      lessonsTotal: 4,
      lessonsCompleted: progressStatus === 'COMPLETED' ? 4 : progressStatus === 'IN_PROGRESS' ? 2 : 0,
      cefrLevel: 'B1',
      description: locale === 'vi' ? descriptionVi : null,
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
      await page.route('**/api/roadmap/me', (r) => r.fulfill(json(b1Roadmap(locale))))
      await page.goto('/v2/student/roadmap')
      // "+120 XP" trong bảng node: chuỗi "XP" hardcode trong TreeNodePanel nên giống nhau ở cả ba
      // locale. KHÔNG chờ theo tên chặng: từ khi mock trả đúng hợp đồng, bản vi hiện tiêu đề tiếng
      // Việt còn en/de hiện tiếng Đức, nên chờ theo tên là spec chỉ chạy được ở một locale.
      await page.getByText('+120 XP').first().waitFor()
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
