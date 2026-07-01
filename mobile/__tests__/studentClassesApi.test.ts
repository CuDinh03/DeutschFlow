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
  fetchAssignmentDetail, submitAssignment, uploadAssignmentFile, type StudentAssignment,
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
