import { describe, it, expect } from 'vitest'
import { isPrimaryTeacher, isRemovable, type ClassTeacher } from './coTeaching'

const primary: ClassTeacher = { teacherId: 10, name: 'Chị Lan', email: 'lan@ct.vn', role: 'PRIMARY', joinedAt: null }
const assistant: ClassTeacher = { teacherId: 22, name: 'Anh Nam', email: 'nam@ct.vn', role: 'ASSISTANT', joinedAt: null }
const teachers = [primary, assistant]

describe('isPrimaryTeacher', () => {
  it('is true when the current user is the PRIMARY teacher (string vs number id)', () => {
    expect(isPrimaryTeacher(teachers, '10')).toBe(true)
    expect(isPrimaryTeacher(teachers, 10)).toBe(true)
  })

  it('is false for an ASSISTANT teacher', () => {
    expect(isPrimaryTeacher(teachers, '22')).toBe(false)
  })

  it('is false for a non-member, and for null/empty/undefined user id', () => {
    expect(isPrimaryTeacher(teachers, '999')).toBe(false)
    expect(isPrimaryTeacher(teachers, null)).toBe(false)
    expect(isPrimaryTeacher(teachers, undefined)).toBe(false)
    expect(isPrimaryTeacher(teachers, '')).toBe(false)
  })

  it('does not match a same-id ASSISTANT (role must be PRIMARY)', () => {
    const swapped = [{ ...primary, role: 'ASSISTANT' }, assistant]
    expect(isPrimaryTeacher(swapped, '10')).toBe(false)
  })
})

describe('isRemovable', () => {
  it('ASSISTANT is removable, PRIMARY is not', () => {
    expect(isRemovable(assistant)).toBe(true)
    expect(isRemovable(primary)).toBe(false)
  })
})
