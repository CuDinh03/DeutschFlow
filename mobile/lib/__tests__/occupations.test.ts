import {
  foldText,
  industryForOccupation,
  occupationName,
  searchOccupations,
  targetMonths,
  type OccupationSummary,
} from '../occupations'

// Đợt 2e A+B+E: onboarding mobile hỏi nghề trong danh mục công khai + ngày mốc — cùng quy tắc với web.

const LIST: OccupationSummary[] = [
  { code: 'koch', nameDe: 'Koch/Köchin', nameEn: 'Cook', nameVi: 'Đầu bếp', workplace: 'gastro', aliases: ['koch'], questionSet: 'CURATED' },
  { code: 'altenpfleger', nameDe: 'Altenpfleger/in', nameEn: 'Geriatric nurse', nameVi: 'Điều dưỡng chăm sóc người cao tuổi', workplace: 'pflege', aliases: ['pflegeheim'], questionSet: 'GENERAL' },
  { code: 'backend_entwickler', nameDe: 'Backend-Entwickler/in', nameEn: 'Backend developer', nameVi: 'Lập trình viên backend', workplace: 'buero', aliases: [], questionSet: 'CURATED' },
]

describe('occupations', () => {
  test('foldText bỏ dấu tiếng Việt, umlaut và đ', () => {
    expect(foldText('Điều dưỡng')).toBe('dieu duong')
    expect(foldText('Köchin')).toBe('kochin')
  })

  test('searchOccupations tìm theo tên Việt không dấu, tên gọi khác, giữ thứ tự danh mục, giới hạn số kết quả', () => {
    expect(searchOccupations(LIST, 'dieu duong', 5).map((o) => o.code)).toEqual(['altenpfleger'])
    expect(searchOccupations(LIST, 'Pflegeheim', 5).map((o) => o.code)).toEqual(['altenpfleger'])
    expect(searchOccupations(LIST, 'o', 2)).toHaveLength(2)
    expect(searchOccupations(LIST, '   ', 5)).toEqual([])
  })

  test('industryForOccupation quy nhóm về từ khoá mentor; nghề IT trong nhóm văn phòng thành IT', () => {
    expect(industryForOccupation(LIST[1])).toBe('Pflege')
    expect(industryForOccupation(LIST[0])).toBe('Gastronomie')
    expect(industryForOccupation(LIST[2])).toBe('IT')
    expect(industryForOccupation({ workplace: 'weltraum', nameDe: 'Astronaut/in' })).toBeNull()
  })

  test('occupationName theo ngôn ngữ giao diện', () => {
    expect(occupationName(LIST[0], 'vi')).toBe('Đầu bếp')
    expect(occupationName(LIST[0], 'en')).toBe('Cook')
    expect(occupationName(LIST[0], 'de')).toBe('Koch/Köchin')
  })

  test('targetMonths bắt đầu từ tháng hiện tại, ngày 01, qua năm đúng', () => {
    const months = targetMonths(new Date(2026, 10, 21), 3) // 21/11/2026
    expect(months.map((m) => m.value)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
    expect(months[2]).toMatchObject({ year: 2027, month: 1 })
  })
})
