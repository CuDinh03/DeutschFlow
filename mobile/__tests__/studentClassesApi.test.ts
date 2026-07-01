jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import {
  fetchAssignmentDetail, fetchClassSessions, submitAssignment, type StudentAssignment,
} from '@/lib/studentClassesApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock

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
  it('returns the row whose assignmentId matches', async () => {
    get.mockResolvedValue({ data: [row(1), row(2), row(3)] })

    const found = await fetchAssignmentDetail(2)

    expect(get).toHaveBeenCalledWith('/v2/students/assignments')
    expect(found?.assignmentId).toBe(2)
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

describe('fetchClassSessions (P5 schedule)', () => {
  it('hits the per-class sessions endpoint and defaults to []', async () => {
    get.mockResolvedValue({ data: undefined })
    expect(await fetchClassSessions(10)).toEqual([])
    expect(get).toHaveBeenCalledWith('/v2/students/classes/10/sessions')
  })
})
