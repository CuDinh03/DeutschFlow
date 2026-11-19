import {
  curatedOccupations,
  dayLabel,
  defaultOccupationCode,
  formatScore10,
  occupationChips,
  recentInterviews,
  reportScore,
  typicalQuestion,
} from '@/lib/interviewHub'
import type { OccupationSummary } from '@/lib/occupations'
import type { AiSpeakingSession } from '@/lib/speakingApi'

function occ(code: string, questionSet: 'CURATED' | 'GENERAL'): OccupationSummary {
  return { code, nameDe: code, nameEn: code, nameVi: code, workplace: 'X', aliases: [], questionSet }
}

const LIST = [occ('PFLEGE', 'CURATED'), occ('LAGER', 'GENERAL'), occ('KOCH', 'CURATED')]

function session(over: Partial<AiSpeakingSession>): AiSpeakingSession {
  return {
    id: 1, topic: null, cefrLevel: 'B1', persona: 'KRUEGER', responseSchema: null, sessionMode: 'INTERVIEW',
    status: 'ENDED', startedAt: '2026-11-18T08:00:00', lastActivityAt: null, endedAt: '2026-11-18T08:20:00',
    messageCount: 10, initialAiMessage: null, interviewPosition: 'Pflegefachfrau', experienceLevel: '1-2Y',
    interviewReportJson: null, ...over,
  }
}

describe('chip nghề — chỉ nghề đã có người phỏng vấn', () => {
  test('lọc CURATED, giữ thứ tự danh mục', () => {
    expect(curatedOccupations(LIST).map((o) => o.code)).toEqual(['PFLEGE', 'KOCH'])
  })

  test('nghề trong hồ sơ mở sẵn; không có trong danh mục thì lấy nghề viết tay đầu tiên', () => {
    expect(defaultOccupationCode(LIST, 'KOCH')).toBe('KOCH')
    expect(defaultOccupationCode(LIST, 'KHONG_CO')).toBe('PFLEGE')
    expect(defaultOccupationCode(LIST, null)).toBe('PFLEGE')
    expect(defaultOccupationCode([], null)).toBeNull()
  })

  test('nghề chọn từ ô tìm (GENERAL) đứng đầu dải chip, không nhân đôi nghề CURATED', () => {
    expect(occupationChips(LIST, 'LAGER').map((o) => o.code)).toEqual(['LAGER', 'PFLEGE', 'KOCH'])
    expect(occupationChips(LIST, 'KOCH').map((o) => o.code)).toEqual(['PFLEGE', 'KOCH'])
  })
})

describe('câu hỏi tiêu biểu', () => {
  test('ưu tiên câu riêng của nghề', () => {
    expect(
      typicalQuestion({
        occupationQuestions: [{ questionDe: ' Wie dokumentieren Sie? ', questionVi: 'Ghi chép thế nào?', status: 'APPROVED' }],
        sampleQuestions: [{ phase: 'HARD_SKILLS', questionDe: 'Bank', questionVi: null }],
      }),
    ).toEqual({ de: 'Wie dokumentieren Sie?', vi: 'Ghi chép thế nào?' })
  })

  test('không có câu riêng: lấy câu chuyên môn, bỏ câu chào hỏi', () => {
    expect(
      typicalQuestion({
        sampleQuestions: [
          { phase: 'INTRO', questionDe: 'Stellen Sie sich vor.', questionVi: null },
          { phase: 'STAR_SOFT', questionDe: 'Ein Konflikt?', questionVi: null },
          { phase: 'HARD_SKILLS', questionDe: 'Medikamente?', questionVi: null },
        ],
      })?.de,
    ).toBe('Medikamente?')
  })

  test('không có gì thì null', () => {
    expect(typicalQuestion({ sampleQuestions: [] })).toBeNull()
    expect(typicalQuestion(null)).toBeNull()
  })
})

describe('điểm và ngày', () => {
  test('điểm /10 từ JSON phiếu; JSON hỏng thì null', () => {
    expect(reportScore('{"overallScore":7.5}')).toBe(7.5)
    expect(reportScore('{"overallScore":null}')).toBeNull()
    expect(reportScore('không phải json')).toBeNull()
    expect(reportScore(null)).toBeNull()
  })

  test('định dạng thang /10 kiểu Việt', () => {
    expect(formatScore10(7.5)).toBe('7,5')
    expect(formatScore10(7)).toBe('7')
    expect(formatScore10(6.84)).toBe('6,8')
  })

  test('Hôm nay, Hôm qua, rồi dd/MM', () => {
    const now = new Date(2026, 10, 19, 10, 0)
    expect(dayLabel(new Date(2026, 10, 19, 7, 0).toISOString(), now)).toBe('Hôm nay')
    expect(dayLabel(new Date(2026, 10, 18, 23, 0).toISOString(), now)).toBe('Hôm qua')
    expect(dayLabel(new Date(2026, 10, 15, 9, 0).toISOString(), now)).toBe('15/11')
    expect(dayLabel('xấu', now)).toBeNull()
  })
})

describe('buổi phỏng vấn gần đây', () => {
  test('chỉ phiên phỏng vấn đã kết thúc, tối đa 3, kèm điểm', () => {
    const now = new Date(2026, 10, 19, 10, 0)
    const rows = recentInterviews(
      [
        session({ id: 9, endedAt: null, interviewReportJson: null }),
        session({ id: 8, sessionMode: 'COMMUNICATION' }),
        session({ id: 7, interviewReportJson: '{"overallScore":7.5}' }),
        session({ id: 6, interviewPosition: null, topic: 'Koch' }),
        session({ id: 5 }),
        session({ id: 4 }),
      ],
      now,
    )
    expect(rows.map((r) => r.id)).toEqual([7, 6, 5])
    expect(rows[0]).toMatchObject({ title: 'Pflegefachfrau', score: 7.5, persona: 'KRUEGER' })
    expect(rows[1].title).toBe('Koch')
  })
})
