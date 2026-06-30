import { deriveStages } from '@/components/skill-tree/stages'
import type { SkillNode } from '@/lib/skillTreeApi'

function node(cefr: string, status: SkillNode['status']): SkillNode {
  return {
    id: Math.random(),
    title: 't',
    cefrLevel: cefr,
    status,
    dayNumber: 1,
    sortOrder: 1,
    tags: [],
    phase: null,
    industry: null,
    moduleTitle: null,
    sessionType: null,
    emoji: null,
    coreTopics: [],
    grammarPoints: [],
    prerequisites: [],
    dependenciesMet: false,
  }
}

describe('deriveStages — 4 stages from real progress (Pha 4)', () => {
  test('always returns the 4 named stages in order', () => {
    const stages = deriveStages([])
    expect(stages.map((s) => s.title)).toEqual(['Nền tảng', 'Sản sinh', 'Lưu loát', 'Tốt nghiệp'])
  })

  test('a fully-completed stage is done; the one with active nodes is active; the rest upcoming', () => {
    const nodes = [
      node('A1', 'COMPLETED'),
      node('A2', 'COMPLETED'),
      node('B1', 'IN_PROGRESS'),
      node('B2', 'LOCKED'),
    ]
    const byTitle = Object.fromEntries(deriveStages(nodes).map((s) => [s.title, s.state]))
    expect(byTitle['Nền tảng']).toBe('done') // A1 all complete
    expect(byTitle['Sản sinh']).toBe('active') // A2 done but B1 in progress → active
    expect(byTitle['Lưu loát']).toBe('upcoming') // B2 locked
    expect(byTitle['Tốt nghiệp']).toBe('upcoming') // no C1/C2 nodes
  })

  test('AVAILABLE alone makes a stage active', () => {
    const byTitle = Object.fromEntries(deriveStages([node('A1', 'AVAILABLE')]).map((s) => [s.title, s.state]))
    expect(byTitle['Nền tảng']).toBe('active')
  })

  test('a stage with no nodes is upcoming, not done', () => {
    const byTitle = Object.fromEntries(deriveStages([node('A1', 'COMPLETED')]).map((s) => [s.title, s.state]))
    expect(byTitle['Tốt nghiệp']).toBe('upcoming')
  })
})
