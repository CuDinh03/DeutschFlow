import { GLYPHS } from '../galerieGlyphs'
import {
  assignmentTypeGlyph, assignmentTypeLabel, chatDayLabel, clockLabel, dayBucket, daySeparatorAbove, formatAvgVi, groupByDay, nameInitial,
  percentLabel, sessionDayBox, shortDate,
} from '../classroomUi'

// Mọi mốc dựng theo giờ máy (new Date(y, m, d, h)) để test không phụ thuộc múi giờ của máy chạy.
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const NOW = new Date(2026, 10, 19, 10, 0) // 19/11/2026 10:00

describe('formatAvgVi', () => {
  it('một chữ số thập phân, dấu phẩy', () => {
    expect(formatAvgVi(7.8)).toBe('7,8')
    expect(formatAvgVi(8)).toBe('8,0')
    expect(formatAvgVi(7.85)).toBe('7,8')
  })
  it('null hoặc không phải số → gạch', () => {
    expect(formatAvgVi(null)).toBe('–')
    expect(formatAvgVi(undefined)).toBe('–')
    expect(formatAvgVi(Number.NaN)).toBe('–')
  })
})

describe('percentLabel', () => {
  it('làm tròn phần trăm', () => {
    expect(percentLabel(7, 12)).toBe('58%')
    expect(percentLabel(12, 12)).toBe('100%')
  })
  it('tổng 0 → gạch; vượt tổng thì kẹp 100%', () => {
    expect(percentLabel(0, 0)).toBe('–')
    expect(percentLabel(15, 12)).toBe('100%')
  })
})

describe('nameInitial', () => {
  it('chữ đầu viết hoa, bỏ khoảng trắng', () => {
    expect(nameInitial('  thu Hà')).toBe('T')
    expect(nameInitial('Đức')).toBe('Đ')
  })
  it('rỗng → ?', () => {
    expect(nameInitial('')).toBe('?')
    expect(nameInitial(null)).toBe('?')
  })
})

describe('shortDate / clockLabel', () => {
  it('định dạng ngày và giờ theo giờ máy', () => {
    expect(shortDate(at(2026, 11, 20, 23, 59))).toBe('20/11')
    expect(clockLabel(at(2026, 11, 20, 8, 5))).toBe('08:05')
  })
  it('sai định dạng', () => {
    expect(shortDate('xx')).toBeNull()
    expect(shortDate(null)).toBeNull()
    expect(clockLabel('xx')).toBe('')
  })
})

describe('sessionDayBox', () => {
  it('số ngày và thứ viết tắt', () => {
    expect(sessionDayBox(at(2026, 11, 19))).toEqual({ day: '19', weekday: 'T5', month: 'Th11' })
    expect(sessionDayBox(at(2026, 11, 22))).toEqual({ day: '22', weekday: 'CN', month: 'Th11' })
  })
  it('sai định dạng → null', () => {
    expect(sessionDayBox('xx')).toBeNull()
  })
})

describe('chatDayLabel', () => {
  it('hôm nay, hôm qua, ngày khác cùng năm, năm khác', () => {
    expect(chatDayLabel(at(2026, 11, 19, 0, 5), NOW)).toBe('Hôm nay')
    expect(chatDayLabel(at(2026, 11, 18, 23, 59), NOW)).toBe('Hôm qua')
    expect(chatDayLabel(at(2026, 11, 14), NOW)).toBe('14/11')
    expect(chatDayLabel(at(2025, 12, 31), NOW)).toBe('31/12/2025')
  })
  it('thiếu hoặc sai định dạng → null', () => {
    expect(chatDayLabel(null, NOW)).toBeNull()
    expect(chatDayLabel('xx', NOW)).toBeNull()
  })
})

describe('daySeparatorAbove (danh sách đảo ngược, mới → cũ)', () => {
  const list = [
    { createdAt: at(2026, 11, 19, 9, 40) }, // 0 mới nhất
    { createdAt: at(2026, 11, 19, 8, 0) }, // 1 cũ nhất của hôm nay
    { createdAt: at(2026, 11, 18, 21, 4) }, // 2 cũ nhất (hôm qua)
  ]
  it('vạch nằm trên tin cũ nhất của mỗi ngày', () => {
    expect(daySeparatorAbove(list, 0, NOW)).toBeNull()
    expect(daySeparatorAbove(list, 1, NOW)).toBe('Hôm nay')
    expect(daySeparatorAbove(list, 2, NOW)).toBe('Hôm qua')
  })
  it('chỉ số ngoài danh sách → null', () => {
    expect(daySeparatorAbove(list, 5, NOW)).toBeNull()
    expect(daySeparatorAbove([], 0, NOW)).toBeNull()
  })
})

describe('dayBucket', () => {
  it('ba nhóm', () => {
    expect(dayBucket(at(2026, 11, 19), NOW)).toBe('Hôm nay')
    expect(dayBucket(at(2026, 11, 18), NOW)).toBe('Hôm qua')
    expect(dayBucket(at(2026, 11, 10), NOW)).toBe('Trước đó')
    expect(dayBucket('xx', NOW)).toBe('Trước đó')
  })
})

describe('groupByDay', () => {
  it('chèn tiêu đề và đánh dấu đầu/cuối mỗi nhóm', () => {
    const items = [
      { id: 1, createdAt: at(2026, 11, 19, 9) },
      { id: 2, createdAt: at(2026, 11, 19, 8) },
      { id: 3, createdAt: at(2026, 11, 18, 20) },
    ]
    const out = groupByDay(items, (n) => `n-${n.id}`, NOW)
    expect(out.map((e) => (e.kind === 'header' ? e.label : `${e.key}:${e.first ? 'F' : ''}${e.last ? 'L' : ''}`))).toEqual([
      'Hôm nay', 'n-1:F', 'n-2:L', 'Hôm qua', 'n-3:FL',
    ])
  })
  it('khoá tiêu đề không trùng khi nhóm lặp lại (danh sách không sắp chuẩn)', () => {
    const items = [
      { id: 1, createdAt: at(2026, 11, 19) },
      { id: 2, createdAt: at(2026, 11, 10) },
      { id: 3, createdAt: at(2026, 11, 19) },
    ]
    const keys = groupByDay(items, (n) => `n-${n.id}`, NOW).map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('danh sách rỗng', () => {
    expect(groupByDay([], () => 'x', NOW)).toEqual([])
  })
})

describe('assignmentTypeLabel / assignmentTypeGlyph', () => {
  it('ba loại đã biết', () => {
    expect(assignmentTypeLabel('ESSAY')).toBe('Viết luận')
    expect(assignmentTypeLabel('MOCK_TEST')).toBe('Thi thử')
    expect(assignmentTypeLabel('SPEAKING_SCENARIO')).toBe('Luyện Nói AI')
    expect(assignmentTypeGlyph('ESSAY')).toBe('viet')
    expect(assignmentTypeGlyph('SPEAKING_SCENARIO')).toBe('noi')
    expect(assignmentTypeGlyph('MOCK_TEST')).toBe('thithu')
  })
  it('loại lạ hoặc thiếu → mặc định', () => {
    expect(assignmentTypeLabel('GENERAL')).toBe('Bài tập chung')
    expect(assignmentTypeLabel(null)).toBe('Bài tập chung')
    expect(assignmentTypeGlyph(undefined)).toBe('baigiao')
  })
  it('mọi glyph trả về đều có trong bộ Galerie', () => {
    for (const t of ['ESSAY', 'MOCK_TEST', 'SPEAKING_SCENARIO', 'X']) {
      expect(GLYPHS[assignmentTypeGlyph(t)]).toBeDefined()
    }
  })
})
