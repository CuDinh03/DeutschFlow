// Khoá hợp đồng cụm Heute: /today/me + /error-skills, map href web→route mobile,
// và luật chấm drill "gõ lại câu đúng".

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { drillPass, errorSkillsApi, normalizeDrillAnswer, todayApi, todayHrefToRoute } from '@/lib/todayApi'

const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('todayApi + errorSkillsApi — path/param đúng backend', () => {
  test('me() GET /today/me', async () => {
    get.mockResolvedValue({ data: { dueRepairTasks: [] } })
    await todayApi.me()
    expect(get).toHaveBeenCalledWith('/today/me')
  })

  test('mine() mặc định days=30; repairAttempt POST đúng path (encode mã lỗi)', async () => {
    get.mockResolvedValue({ data: [] })
    post.mockResolvedValue({ data: undefined })
    await errorSkillsApi.mine()
    await errorSkillsApi.repairAttempt('WEIL_VERB_END/2')
    expect(get).toHaveBeenCalledWith('/error-skills/me', { params: { days: 30 } })
    expect(post).toHaveBeenCalledWith('/error-skills/me/WEIL_VERB_END%2F2/repair-attempt')
  })
})

describe('todayHrefToRoute — href backend là đường WEB, map an toàn', () => {
  test.each([
    ['/v2/student/weekly-speaking', '/(student)/weekly-speaking'],
    ['/v2/student/vocabulary?level=A2', '/(student)/vocabulary'],
    ['/v2/student/speaking?topic=Beim+Arzt', '/(student)/speaking'],
    [null, '/(student)/speaking'],
    ['https://la.la/route-la', '/(student)/speaking'],
  ])('%s → %s', (href, route) => {
    expect(todayHrefToRoute(href)).toBe(route)
  })
})

describe('drillPass — khoan dung dấu câu/hoa thường, NGHIÊM với umlaut/ß', () => {
  const target = 'Ich bin nach Berlin gefahren.'

  test('đúng nội dung, lệch hoa thường + dấu câu → PASS', () => {
    expect(drillPass('ich bin nach berlin gefahren', target)).toBe(true)
    expect(drillPass('  Ich bin nach Berlin gefahren!! ', target)).toBe(true)
  })

  test('sai từ (đúng lỗi đang luyện) → FAIL', () => {
    expect(drillPass('Ich habe nach Berlin gefahren', target)).toBe(false)
  })

  test('umlaut/ß không được xuê xoa — đó là thứ đang luyện', () => {
    expect(drillPass('Ich musste zum Arzt', 'Ich müsste zum Arzt')).toBe(false)
    expect(normalizeDrillAnswer('heißen')).toBe('heißen')
  })

  test('rỗng không bao giờ pass', () => {
    expect(drillPass('', target)).toBe(false)
    expect(drillPass('   ', target)).toBe(false)
  })
})
