import { topicGroupOf, topicLabelOf } from '@/components/skill-tree/topicGroup'
import { mapSkillNode, type RawSkillNode } from '@/lib/skillTreeApi'

describe('topicGroupOf — phase/industry → group (spec M4 default)', () => {
  const base = { industry: null, phase: null, sessionType: null }

  test('industry wins and maps to the vocational group', () => {
    expect(topicGroupOf({ ...base, industry: 'Medizin' })).toBe('medical')
    expect(topicGroupOf({ ...base, industry: 'PFLEGE' })).toBe('medical')
    expect(topicGroupOf({ ...base, industry: 'IT' })).toBe('work')
    expect(topicGroupOf({ ...base, industry: 'TOURISMUS' })).toBe('travel')
  })

  test('an unknown industry is still vocational (work)', () => {
    expect(topicGroupOf({ ...base, industry: 'Bergbau' })).toBe('work')
  })

  test('phase maps core foundation nodes to daily', () => {
    expect(topicGroupOf({ ...base, phase: 'PHONETIK' })).toBe('daily')
    expect(topicGroupOf({ ...base, phase: 'GRUNDLAGEN' })).toBe('daily')
    expect(topicGroupOf({ ...base, phase: 'FOUNDATION' })).toBe('daily')
  })

  test('exam-like session type overrides to the exam group', () => {
    expect(topicGroupOf({ ...base, phase: 'GRUNDLAGEN', sessionType: 'MOCK_EXAM' })).toBe('exam')
  })

  test('falls back to daily when nothing is known', () => {
    expect(topicGroupOf(base)).toBe('daily')
  })
})

describe('topicLabelOf — module title → core topic → tag → day', () => {
  const base = { moduleTitle: null, coreTopics: [] as string[], tags: [] as string[], dayNumber: 7 }

  test('prefers the module title', () => {
    expect(topicLabelOf({ ...base, moduleTitle: 'Chăm sóc người già' })).toBe('Chăm sóc người già')
  })
  test('then the first core topic, title-cased', () => {
    expect(topicLabelOf({ ...base, coreTopics: ['ALPHABET'] })).toBe('Alphabet')
  })
  test('then the first tag (# stripped)', () => {
    expect(topicLabelOf({ ...base, tags: ['#Begrüßung'] })).toBe('Begrüßung')
  })
  test('then a day label', () => {
    expect(topicLabelOf(base)).toBe('Ngày 7')
  })
})

describe('mapSkillNode — widened DTO parses the full wire shape (Pha 3)', () => {
  const base: RawSkillNode = { id: 1, title_vi: 'Bảng chữ cái', cefr_level: 'A1', day_number: 1 }

  test('parses JSON-text array columns null-safely', () => {
    const n = mapSkillNode({
      ...base,
      core_topics: '["ALPHABET","UMLAUTE"]',
      grammar_points: '["ARTIKEL"]',
      prerequisites_json: '["A1-001"]',
      phase: 'GRUNDLAGEN',
      industry: 'PFLEGE',
      module_title_vi: 'Khởi đầu',
      session_type: 'LESSON',
      sort_order: 3,
      dependencies_met: true,
    })
    expect(n.coreTopics).toEqual(['ALPHABET', 'UMLAUTE'])
    expect(n.grammarPoints).toEqual(['ARTIKEL'])
    expect(n.prerequisites).toEqual(['A1-001'])
    expect(n.phase).toBe('GRUNDLAGEN')
    expect(n.industry).toBe('PFLEGE')
    expect(n.moduleTitle).toBe('Khởi đầu')
    expect(n.sortOrder).toBe(3)
    expect(n.dependenciesMet).toBe(true)
  })

  test('extracts node_code from object-shaped prerequisites (H3)', () => {
    const n = mapSkillNode({ ...base, prerequisites_json: '[{"node_code":"A1-002"},{"code":"A1-003"}]' })
    expect(n.prerequisites).toEqual(['A1-002', 'A1-003'])
  })

  test('malformed JSON text yields empty arrays, never throws', () => {
    const n = mapSkillNode({ ...base, core_topics: 'not json', prerequisites_json: '{' })
    expect(n.coreTopics).toEqual([])
    expect(n.prerequisites).toEqual([])
  })

  test('absent optional fields default cleanly', () => {
    const n = mapSkillNode(base)
    expect(n.phase).toBeNull()
    expect(n.industry).toBeNull()
    expect(n.dependenciesMet).toBe(false)
    expect(n.coreTopics).toEqual([])
  })
})
