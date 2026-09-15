jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  uploadAsync: jest.fn(),
}))

import api from '@/lib/api'
import * as FileSystem from 'expo-file-system/legacy'
import {
  assignmentRowKey, assignmentStatusView,
  fetchAssignmentDetail, fetchClassSessions, fetchMyAttendance, fetchMySkillReport,
  isAwaitingTeacher, isFinalGrade, isSubmittedStatus,
  submitAssignment, uploadAssignmentFile, type StudentAssignment,
} from '@/lib/studentClassesApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock
const uploadAsync = FileSystem.uploadAsync as unknown as jest.Mock

const row = (assignmentId: number): StudentAssignment => ({
  id: assignmentId * 10,
  assignmentId,
  studentId: 1,
  status: 'PENDING',
  teacherScore: null,
  teacherFeedback: null,
  submittedAt: null,
  createdAt: '2026-06-13T00:00:00Z',
  topic: `Bài ${assignmentId}`,
  description: '',
  assignmentType: 'ESSAY',
  dueDate: null,
})

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('fetchAssignmentDetail', () => {
  // V-07: có classId thì phải hỏi ĐÚNG lớp. Trước bản vá hàm này luôn tải toàn bộ bài của mọi lớp
  // học viên từng học rồi lọc — danh sách dài là trượt đúng bài cần mở.
  it('gọi endpoint theo LỚP khi có classId', async () => {
    get.mockResolvedValue({ data: [row(1), row(2)] })

    const found = await fetchAssignmentDetail(2, 10)

    expect(get).toHaveBeenCalledWith('/v2/students/classes/10/assignments')
    expect(get).not.toHaveBeenCalledWith('/v2/students/assignments')
    expect(found?.assignmentId).toBe(2)
  })

  it('rơi về danh sách tổng khi KHÔNG có classId (deep-link cũ)', async () => {
    get.mockResolvedValue({ data: [row(1), row(2), row(3)] })

    const found = await fetchAssignmentDetail(2)

    expect(get).toHaveBeenCalledWith('/v2/students/assignments')
    expect(found?.assignmentId).toBe(2)
  })

  it('classId không hợp lệ (NaN) cũng rơi về danh sách tổng, không ghép URL hỏng', async () => {
    get.mockResolvedValue({ data: [row(1)] })

    await fetchAssignmentDetail(1, Number('x'))

    expect(get).toHaveBeenCalledWith('/v2/students/assignments')
  })

  it('returns null when no row matches the id', async () => {
    get.mockResolvedValue({ data: [row(1)] })
    expect(await fetchAssignmentDetail(99)).toBeNull()
  })

  it('returns null when the list is empty or undefined', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await fetchAssignmentDetail(1)).toBeNull()
  })
})

describe('submitAssignment', () => {
  it('posts the payload to the per-assignment submit endpoint and returns the updated row', async () => {
    const updated = { ...row(5), status: 'SUBMITTED' }
    post.mockResolvedValue({ data: updated })

    const result = await submitAssignment(5, { submissionContent: 'Mein Aufsatz' })

    expect(post).toHaveBeenCalledWith('/v2/students/assignments/5/submit', {
      submissionContent: 'Mein Aufsatz',
    })
    expect(result.status).toBe('SUBMITTED')
  })
})

describe('uploadAssignmentFile', () => {
  beforeEach(() => uploadAsync.mockReset())

  it('gets a presigned url, PUTs the file, and returns the object url (query stripped)', async () => {
    get.mockResolvedValue({
      data: { url: 'https://s3.example.com/assignments/1/x.jpg?sig=abc', objectKey: 'assignments/1/x.jpg' },
    })
    uploadAsync.mockResolvedValue({ status: 200 })

    const url = await uploadAssignmentFile(7, {
      uri: 'file:///tmp/x.jpg', name: 'x.jpg', contentType: 'image/jpeg',
    })

    expect(get).toHaveBeenCalledWith('/v2/students/assignments/presigned-url', {
      params: { assignmentId: 7, filename: 'x.jpg', contentType: 'image/jpeg' },
    })
    expect(uploadAsync).toHaveBeenCalledWith(
      'https://s3.example.com/assignments/1/x.jpg?sig=abc',
      'file:///tmp/x.jpg',
      expect.objectContaining({ httpMethod: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }),
    )
    expect(url).toBe('https://s3.example.com/assignments/1/x.jpg')
  })

  it('throws when S3 rejects the upload (non-2xx)', async () => {
    get.mockResolvedValue({ data: { url: 'https://s3/x?sig', objectKey: 'k' } })
    uploadAsync.mockResolvedValue({ status: 403 })

    await expect(
      uploadAssignmentFile(1, { uri: 'f', name: 'n', contentType: 'image/jpeg' }),
    ).rejects.toThrow(/S3 403/)
  })
})

describe('P4 evaluation reads', () => {
  it('fetchMyAttendance hits the per-class my-attendance endpoint and defaults to []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await fetchMyAttendance(10)).toEqual([])
    expect(get).toHaveBeenCalledWith('/v2/students/classes/10/my-attendance')
  })

  it('fetchMySkillReport hits the per-class my-skill-report endpoint', async () => {
    get.mockResolvedValue({
      data: {
        horen: 8, lesen: null, schreiben: null, sprechen: null, total: 8, grade: 'Giỏi',
        teacherComment: null, evaluatedAt: null,
      },
    })
    const r = await fetchMySkillReport(10)
    expect(get).toHaveBeenCalledWith('/v2/students/classes/10/my-skill-report')
    expect(r.grade).toBe('Giỏi')
    expect(r.horen).toBe(8)
  })

  it("fetchMySkillReport carries the teacher's written comment through to the student", async () => {
    get.mockResolvedValue({
      data: {
        horen: 7, lesen: 8, schreiben: null, sprechen: null, total: 7.5, grade: 'Khá',
        teacherComment: 'Cần luyện thêm Perfekt.', evaluatedAt: '2026-08-20T09:30:00',
      },
    })
    const r = await fetchMySkillReport(10)
    expect(r.teacherComment).toBe('Cần luyện thêm Perfekt.')
    expect(r.evaluatedAt).toBe('2026-08-20T09:30:00')
  })
})

describe('fetchClassSessions (P5 schedule)', () => {
  it('hits the per-class sessions endpoint and defaults to []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await fetchClassSessions(10)).toEqual([])
    expect(get).toHaveBeenCalledWith('/v2/students/classes/10/sessions')
  })
})

// Gương AssignmentStatus.java backend — hợp đồng hiển thị cho học viên
// (soát 02/09, F-14): AI_GRADED/GRADING_FAILED là bài ĐÃ NỘP đang chờ giáo
// viên; trước bản vá chúng rơi nhánh else và hiện pill đỏ "Chưa nộp".
describe('phân loại trạng thái bài giao', () => {
  test.each([
    // [status, awaitingTeacher, finalGrade, submitted]
    ['PENDING', false, false, false],
    ['SUBMITTED', true, false, true],
    ['AI_GRADED', true, false, true],
    ['GRADING_FAILED', true, false, true],
    ['GRADED', false, true, true],
    ['EVALUATED', false, true, true],
  ])('%s → awaiting=%s, final=%s, submitted=%s', (status, awaiting, final_, submitted) => {
    expect(isAwaitingTeacher(status)).toBe(awaiting)
    expect(isFinalGrade(status)).toBe(final_)
    expect(isSubmittedStatus(status)).toBe(submitted)
  })

  test('AI_GRADED không bao giờ được tính là điểm đã chốt — backend cố ý giấu điểm AI', () => {
    expect(isFinalGrade('AI_GRADED')).toBe(false)
  })
})

// V-12c: cùng một bài, hai màn (danh sách bài của lớp + chi tiết bài) phải nói cùng một câu.
// GRADING_FAILED trước đây bị gộp vào "Đã nộp" nên học viên không hề biết bài mình CHƯA được chấm,
// trong khi web nói thẳng "Chấm lỗi · chờ chấm lại".
describe('assignmentStatusView — GRADING_FAILED tách khỏi "đã nộp"', () => {
  test.each([
    ['PENDING', 'notSubmitted'],
    ['SUBMITTED', 'awaitingTeacher'],
    ['AI_GRADED', 'awaitingTeacher'],
    ['GRADING_FAILED', 'gradingFailed'],
    ['GRADED', 'graded'],
    ['EVALUATED', 'graded'],
  ])('%s → %s', (status, view) => {
    expect(assignmentStatusView(status)).toBe(view)
  })

  test('GRADING_FAILED vẫn nằm trong nhóm được nộp bản khác — chỉ câu chữ đổi', () => {
    expect(isAwaitingTeacher('GRADING_FAILED')).toBe(true)
  })
})

// V-12c: backend trả id = null cho MỌI bài học viên chưa bắt đầu (notStartedDto), nên key React
// theo `id` trùng nhau cả cụm và React trộn nhầm thẻ khi danh sách đổi.
describe('assignmentRowKey', () => {
  it('cho key khác nhau với các bài chưa bắt đầu (id đều null)', () => {
    const notStarted = [1, 2, 3].map((assignmentId) => ({
      ...row(assignmentId),
      id: null as unknown as number,
    }))

    const keys = notStarted.map(assignmentRowKey)

    expect(new Set(keys).size).toBe(3)
    expect(keys).toEqual([1, 2, 3])
  })
})
