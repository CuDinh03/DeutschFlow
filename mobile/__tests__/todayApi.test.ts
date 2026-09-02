// Khoá hợp đồng cụm Heute: /today/me + /error-skills, map href web→route mobile,
// và luật chấm drill "gõ lại câu đúng".

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { drillPass, dueRepairChipLabels, errorSkillsApi, normalizeDrillAnswer, todayApi, todayHrefToRoute } from '@/lib/todayApi'

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

describe('dueRepairChipLabels — chip lỗi trên Trang chủ không bao giờ lộ mã thô', () => {
  const threeSameOneOther = [
    { errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE' },
    { errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE' },
    { errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE' },
    { errorCode: 'CASE.PREP_DAT_MIT' },
  ]

  test('ưu tiên ruleViShort backend; task trùng mã gộp còn MỘT chip', () => {
    const labels = dueRepairChipLabels(threeSameOneOther, [
      { errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE', ruleViShort: 'Động từ đứng vị trí 2' },
    ])
    expect(labels).toEqual(['Động từ đứng vị trí 2', 'mit + Dativ'])
  })

  test('không có skill (query lỗi/chưa về) → nhãn tiếng Việt từ errorTaxonomy, không phải mã thô', () => {
    expect(dueRepairChipLabels(threeSameOneOther.slice(0, 1), [])).toEqual(['Động từ vị trí số 2 (V2)'])
  })

  test('ruleViShort null/rỗng cũng rơi về taxonomy; mã lạ chưa map mới hiện nguyên mã', () => {
    const labels = dueRepairChipLabels(
      [{ errorCode: 'CASE.PREP_DAT_MIT' }, { errorCode: 'CASE.PREP_AKK_FUER' }, { errorCode: 'X.CHUA_CO_TRONG_BANG' }],
      [
        { errorCode: 'CASE.PREP_DAT_MIT', ruleViShort: null },
        { errorCode: 'CASE.PREP_AKK_FUER', ruleViShort: '  ' },
      ],
    )
    expect(labels).toEqual(['mit + Dativ', 'für + Akkusativ', 'X.CHUA_CO_TRONG_BANG'])
  })

  test('tối đa 3 chip SAU khi khử trùng lặp', () => {
    const labels = dueRepairChipLabels(
      [
        { errorCode: 'WORD_ORDER.V2_MAIN_CLAUSE' },
        { errorCode: 'CASE.PREP_DAT_MIT' },
        { errorCode: 'CASE.PREP_AKK_FUER' },
        { errorCode: 'ARTICLE.INDEFINITE_EIN_EINE' },
      ],
      [],
    )
    expect(labels).toEqual(['Động từ vị trí số 2 (V2)', 'mit + Dativ', 'für + Akkusativ'])
  })
})
