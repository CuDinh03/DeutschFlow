import { attemptTotalScore, mapExam, type AttemptResultDto, type RawMockExam } from '@/lib/examApi'

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

describe('attemptTotalScore (F-10a soát 02/09)', () => {
  it('đọc đúng khoá snake_case `total_score` của ExamResultDto backend', () => {
    const result: AttemptResultDto = { total_score: 42, status: 'COMPLETED' }
    expect(attemptTotalScore(result)).toBe(42)
  })

  it('điểm chưa có (job đang chấm) hoặc thiếu → 0, không NaN/undefined', () => {
    expect(attemptTotalScore({ total_score: null, status: 'IN_PROGRESS' })).toBe(0)
    expect(attemptTotalScore({})).toBe(0)
    expect(attemptTotalScore(null)).toBe(0)
  })

  it('hồi quy: khoá camelCase `totalScore` KHÔNG tồn tại trong hợp đồng — không được đọc ra điểm', () => {
    // Đây chính là lỗi cũ: màn kết quả đọc `totalScore` nên luôn hiện 0.
    const wrongShape = { totalScore: 42 } as unknown as AttemptResultDto
    expect(attemptTotalScore(wrongShape)).toBe(0)
  })
})
