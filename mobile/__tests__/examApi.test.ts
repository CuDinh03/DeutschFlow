import { mapExam, type RawMockExam } from '@/lib/examApi'

describe('mapExam', () => {
  it('maps snake_case backend row to ExamVariant', () => {
    const raw: RawMockExam = {
      id: 7,
      cefr_level: 'B1',
      title: 'Goethe B1 Modellsatz',
      time_limit_minutes: 90,
      total_questions: 60,
    }

    expect(mapExam(raw)).toEqual({
      id: 7,
      title: 'Goethe B1 Modellsatz',
      cefrLevel: 'B1',
      totalQuestions: 60,
      timeLimitMinutes: 90,
    })
  })

  it('defaults totalQuestions to 0 when the backend omits it', () => {
    const raw: RawMockExam = {
      id: 1,
      cefr_level: 'A1',
      title: 'A1 Test',
      time_limit_minutes: 60,
    }

    expect(mapExam(raw).totalQuestions).toBe(0)
  })
})
