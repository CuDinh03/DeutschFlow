import { completionCaption, completionTitle, nodeActions } from '@/lib/nodeActions'

describe('nodeActions — lesson screen routing', () => {
  test('a node with both graded sets opens both runners', () => {
    expect(nodeActions({ exerciseCount: 6, hasSkillExercises: true, done: false })).toEqual({
      practice: true,
      skills: true,
      markLearned: false,
      doneNav: false,
    })
  })

  test('a completed node with both sets keeps both runners and shows the next-lesson nav', () => {
    expect(nodeActions({ exerciseCount: 6, hasSkillExercises: true, done: true })).toEqual({
      practice: true,
      skills: true,
      markLearned: false,
      doneNav: true,
    })
  })

  test('exercises only: node-practice stays the single action, done or not', () => {
    for (const done of [false, true]) {
      expect(nodeActions({ exerciseCount: 6, hasSkillExercises: false, done })).toEqual({
        practice: true,
        skills: false,
        markLearned: false,
        doneNav: false,
      })
    }
  })

  test('skill_exercises only (A1): skill-practice until done, then the done nav', () => {
    expect(nodeActions({ exerciseCount: 0, hasSkillExercises: true, done: false })).toEqual({
      practice: false,
      skills: true,
      markLearned: false,
      doneNav: false,
    })
    expect(nodeActions({ exerciseCount: 0, hasSkillExercises: true, done: true })).toEqual({
      practice: false,
      skills: false,
      markLearned: false,
      doneNav: true,
    })
  })

  test('theory-only: mark as learned until done, then the done nav', () => {
    expect(nodeActions({ exerciseCount: 0, hasSkillExercises: false, done: false })).toEqual({
      practice: false,
      skills: false,
      markLearned: true,
      doneNav: false,
    })
    expect(nodeActions({ exerciseCount: 0, hasSkillExercises: false, done: true })).toEqual({
      practice: false,
      skills: false,
      markLearned: false,
      doneNav: true,
    })
  })
})

describe('completion copy', () => {
  test('a first completion shows the XP and what it unlocked', () => {
    expect(completionTitle(120, false)).toBe('Tuyệt vời! +120 XP')
    expect(completionCaption(true, false)).toContain('mở khoá bài tiếp theo')
    expect(completionCaption(false, false)).toContain('mọi bài đang mở khoá')
  })

  test('extra practice on a completed node promises neither XP nor an unlock', () => {
    expect(completionTitle(0, true)).not.toContain('XP')
    expect(completionCaption(true, true)).toContain('không cộng XP')
    expect(completionCaption(true, true)).not.toContain('mở khoá')
  })
})
