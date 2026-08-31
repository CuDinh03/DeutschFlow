import { describe, expect, test } from 'vitest'
import { studentsToCsv } from './orgCsv'
import type { OrgMember } from '@/lib/orgApi'

const member = (over: Partial<OrgMember>): OrgMember => ({
  userId: 1,
  email: 'a@b.vn',
  displayName: 'Nguyễn Văn A',
  role: 'STUDENT',
  status: 'ACTIVE',
  joinedAt: '2026-08-01T00:00:00Z',
  ...over,
})

describe('studentsToCsv', () => {
  test('có BOM UTF-8 và đủ header + từng dòng', () => {
    const csv = studentsToCsv([member({})])
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Tên hiển thị,Email,Trạng thái,Ngày tham gia')
    expect(lines[1]).toBe('Nguyễn Văn A,a@b.vn,ACTIVE,2026-08-01T00:00:00Z')
    expect(lines).toHaveLength(2)
  })

  test('escape tên chứa dấu phẩy và ngoặc kép', () => {
    const csv = studentsToCsv([member({ displayName: 'Trần "Bi", lớp A1' })])
    expect(csv).toContain('"Trần ""Bi"", lớp A1"')
  })

  test('tên null thành ô rỗng, không phải chữ "null"', () => {
    const csv = studentsToCsv([member({ displayName: null })])
    expect(csv.slice(1).split('\r\n')[1]).toBe(',a@b.vn,ACTIVE,2026-08-01T00:00:00Z')
  })
})
