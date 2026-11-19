import { continueNode, greetingName, nextMockDay, pendingInterview, roadmapRange, shortDayDate, todayDateLine } from '../homeToday'
import type { ExamPlanDay } from '../examPlanApi'
import type { RoadmapNode } from '../lernwegApi'

function day(over: Partial<ExamPlanDay>): ExamPlanDay {
  return { date: '2026-11-18', kind: 'TEIL', minutes: 15, status: 'UPCOMING', movable: true, ...over }
}

function node(over: Partial<RoadmapNode>): RoadmapNode {
  return {
    id: 1,
    code: 'n1',
    title: 'Perfekt',
    subtitle: 'Thì hoàn thành',
    emoji: '',
    state: 'locked',
    xpReward: 10,
    lessonsTotal: 3,
    lessonsCompleted: 0,
    category: null,
    description: null,
    cefrLevel: 'A2',
    prerequisiteCode: null,
    orderIndex: 1,
    dayNumber: null,
    weekNumber: null,
    progressStatus: 'LOCKED',
    skillCounts: null,
    ...over,
  }
}

describe('todayDateLine', () => {
  test('ghi thứ và ngày tháng kiểu Việt', () => {
    expect(todayDateLine(new Date(2026, 10, 18))).toBe('Thứ Tư, 18 tháng 11')
    expect(todayDateLine(new Date(2026, 10, 22))).toBe('Chủ nhật, 22 tháng 11')
  })
})

describe('greetingName', () => {
  test('lấy chữ cuối của họ tên', () => {
    expect(greetingName('Nguyễn Thị Lan')).toBe('Lan')
    expect(greetingName('  Minh  ')).toBe('Minh')
  })
  test('trống hoặc thiếu thì gọi "bạn"', () => {
    expect(greetingName('')).toBe('bạn')
    expect(greetingName(null)).toBe('bạn')
    expect(greetingName(undefined)).toBe('bạn')
  })
})

describe('shortDayDate', () => {
  test('thứ viết tắt và ngày/tháng hai chữ số', () => {
    expect(shortDayDate('2026-11-21')).toBe('T7, 21/11')
    expect(shortDayDate('2026-12-06')).toBe('CN, 06/12')
  })
})

describe('nextMockDay', () => {
  const days = [
    day({ date: '2026-11-16', kind: 'FULL_EXAM', status: 'MISSED' }),
    day({ date: '2026-11-18', kind: 'TEIL', status: 'TODAY' }),
    day({ date: '2026-11-21', kind: 'FULL_EXAM', status: 'UPCOMING', examId: 7, minutes: 150 }),
  ]
  test('bỏ buổi đã qua, lấy buổi thi thử kế tiếp', () => {
    expect(nextMockDay(days, '2026-11-18')?.date).toBe('2026-11-21')
  })
  test('buổi thi thử đúng hôm nay vẫn tính', () => {
    expect(nextMockDay([day({ date: '2026-11-18', kind: 'FULL_EXAM', status: 'TODAY' })], '2026-11-18')?.date).toBe('2026-11-18')
  })
  test('đã làm rồi hoặc không có thì null', () => {
    expect(nextMockDay([day({ date: '2026-11-21', kind: 'FULL_EXAM', status: 'DONE' })], '2026-11-18')).toBeNull()
    expect(nextMockDay(undefined, '2026-11-18')).toBeNull()
    expect(nextMockDay([], '2026-11-18')).toBeNull()
  })
})

describe('pendingInterview', () => {
  test('chỉ phiên phỏng vấn mới tính là buổi đang dở', () => {
    expect(pendingInterview({ id: 1, interviewPosition: ' Pflegefachkraft ', persona: 'KRUEGER', sessionMode: 'INTERVIEW' })).toEqual({
      position: 'Pflegefachkraft',
      persona: 'KRUEGER',
    })
    expect(pendingInterview({ id: 2, interviewPosition: null, sessionMode: 'COMMUNICATION' })).toBeNull()
    expect(pendingInterview(null)).toBeNull()
  })
  test('thiếu vị trí thì lấy chủ đề, thiếu cả hai thì null', () => {
    expect(pendingInterview({ id: 3, interviewPosition: '', topic: 'Koch', sessionMode: 'INTERVIEW' })?.position).toBe('Koch')
    expect(pendingInterview({ id: 4, interviewPosition: null, sessionMode: 'INTERVIEW' })).toEqual({ position: null, persona: null })
  })
})

describe('continueNode', () => {
  test('ưu tiên chặng đang học dở', () => {
    const nodes = [node({ id: 1, state: 'current', progressStatus: 'AVAILABLE' }), node({ id: 2, progressStatus: 'IN_PROGRESS' })]
    expect(continueNode(nodes)?.id).toBe(2)
  })
  test('không có chặng dở thì lấy chặng đang mở đầu tiên', () => {
    const nodes = [node({ id: 1, state: 'completed', progressStatus: 'COMPLETED' }), node({ id: 2, state: 'current', progressStatus: 'AVAILABLE' })]
    expect(continueNode(nodes)?.id).toBe(2)
  })
  test('toàn chặng khoá hoặc đã xong thì null', () => {
    expect(continueNode([node({ state: 'completed', progressStatus: 'COMPLETED' }), node({})])).toBeNull()
    expect(continueNode([])).toBeNull()
  })
})

describe('roadmapRange', () => {
  test('từ mức thấp nhất tới cao nhất của các chặng', () => {
    expect(roadmapRange([{ cefrLevel: 'B1' }, { cefrLevel: 'a2' }, { cefrLevel: 'B2' }])).toBe('A2 → B2')
  })
  test('một mức thì ghi một mức, không rõ thì null', () => {
    expect(roadmapRange([{ cefrLevel: 'B1' }, { cefrLevel: 'B1' }])).toBe('B1')
    expect(roadmapRange([{ cefrLevel: '' }, { cefrLevel: 'X9' }])).toBeNull()
    expect(roadmapRange([])).toBeNull()
  })
})
