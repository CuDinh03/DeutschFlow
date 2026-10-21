// K3b (21/10/2026): phỏng vấn theo nghề — app gửi `occupationCode` khi tạo phiên, không gửi persona.
const postMock = jest.fn()
const getMock = jest.fn()
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { post: (...a: unknown[]) => postMock(...a), get: (...a: unknown[]) => getMock(...a) },
}))
jest.mock('expo-file-system/legacy', () => ({}))

import { speakingApi } from '../speakingApi'
import { fetchOccupationInterviewInfo } from '../occupations'

describe('phỏng vấn theo nghề (K3b)', () => {
  beforeEach(() => {
    postMock.mockReset()
    getMock.mockReset()
  })

  test('createSession gửi occupationCode và persona null', async () => {
    postMock.mockResolvedValue({ data: { id: 1, persona: 'KRUEGER' } })
    await speakingApi.createSession({
      topic: 'Altenpfleger/in',
      cefrLevel: 'B1',
      persona: null,
      sessionMode: 'INTERVIEW',
      experienceLevel: '1-2Y',
      occupationCode: 'altenpfleger',
    })
    const [url, body] = postMock.mock.calls[0]
    expect(url).toBe('/ai-speaking/sessions')
    expect(body).toMatchObject({
      persona: null,
      sessionMode: 'INTERVIEW',
      interviewPosition: null,
      experienceLevel: '1-2Y',
      occupationCode: 'altenpfleger',
    })
  })

  test('phiên thường vẫn gửi occupationCode null', async () => {
    postMock.mockResolvedValue({ data: { id: 2, persona: 'LUKAS' } })
    await speakingApi.createSession({ topic: 'Alltag', cefrLevel: 'A2', persona: 'LUKAS', sessionMode: 'COMMUNICATION' })
    expect(postMock.mock.calls[0][1]).toMatchObject({ persona: 'LUKAS', occupationCode: null })
  })

  test('fetchOccupationInterviewInfo đọc chi tiết nghề công khai', async () => {
    getMock.mockResolvedValue({ data: { personaCode: 'KRUEGER', interviewPosition: 'Altenpfleger/in', occupation: { code: 'altenpfleger' } } })
    const info = await fetchOccupationInterviewInfo('altenpfleger')
    expect(getMock).toHaveBeenCalledWith('/public/occupations/altenpfleger')
    expect(info.personaCode).toBe('KRUEGER')
  })
})
