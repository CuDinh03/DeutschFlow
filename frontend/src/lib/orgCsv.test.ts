import { describe, expect, test } from 'vitest'
import { studentsToCsv, parseCsvLine, parseRosterCsv, rosterTemplateCsv, rosterErrorsCsv, splitCsvRecords } from './orgCsv'
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

  test('dùng header tuỳ biến khi truyền vào (trang Students truyền bản dịch theo locale)', () => {
    const csv = studentsToCsv([member({})], ['Display name', 'Email', 'Status', 'Joined on'])
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Display name,Email,Status,Joined on')
    expect(lines[1]).toBe('Nguyễn Văn A,a@b.vn,ACTIVE,2026-08-01T00:00:00Z')
  })
})


describe('parseCsvLine (PR-A5)', () => {
  test('ô thường, ô rỗng cuối dòng', () => {
    expect(parseCsvLine('a@x.com,A,')).toEqual(['a@x.com', 'A', ''])
  })
  test('ô bọc ngoặc kép chứa dấu phẩy và "" bên trong', () => {
    expect(parseCsvLine('a@x.com,"Nguyễn, An","0912"')).toEqual(['a@x.com', 'Nguyễn, An', '0912'])
    expect(parseCsvLine('b@x.com,"Trần ""Bình"" Văn"')).toEqual(['b@x.com', 'Trần "Bình" Văn'])
  })
  test('ngoặc không đóng không làm nổ — trả phần đã đọc', () => {
    expect(parseCsvLine('a@x.com,"chưa đóng, ngoặc')).toEqual(['a@x.com', 'chưa đóng, ngoặc'])
  })
})

describe('parseRosterCsv (PR-A5)', () => {
  test('bỏ BOM, nhận header, bỏ dòng trống, giữ số dòng gốc, đếm email sai', () => {
    const p = parseRosterCsv('\uFEFFemail,displayName,phone\r\n\r\nan@x.com,"Nguyễn, An",0912\r\nkhong-phai-email,B,\r\n')
    expect(p.hasHeader).toBe(true)
    expect(p.rows).toEqual([
      { email: 'an@x.com', displayName: 'Nguyễn, An', phone: '0912', line: 3 },
      { email: 'khong-phai-email', displayName: 'B', phone: '', line: 4 },
    ])
    expect(p.invalidEmails).toBe(1)
  })
  test('không header: dòng đầu là dữ liệu; email được hạ chữ thường', () => {
    const p = parseRosterCsv('AN@X.COM,An')
    expect(p.hasHeader).toBe(false)
    expect(p.rows).toEqual([{ email: 'an@x.com', displayName: 'An', phone: '', line: 1 }])
  })
  test('file mẫu và file lỗi có BOM và đúng header', () => {
    expect(rosterTemplateCsv().startsWith('\uFEFFemail,displayName,phone')).toBe(true)
    expect(rosterErrorsCsv(['Dòng 2: email không hợp lệ "x"'])).toBe('\uFEFFerror\r\n"Dòng 2: email không hợp lệ ""x"""\r\n')
  })
})

describe('splitCsvRecords — ô bọc nháy chứa xuống dòng (RFC 4180)', () => {
  test('giữ nguyên một bản ghi khi ô có nháy chứa ký tự xuống dòng', () => {
    const recs = splitCsvRecords('a@x.com,"Dòng1\nDòng2",0912')
    expect(recs).toHaveLength(1)
    expect(parseCsvLine(recs[0].text)).toEqual(['a@x.com', 'Dòng1\nDòng2', '0912'])
  })

  test('không chẻ đôi bản ghi nhiều dòng thành một tài khoản tên cụt cộng một lỗi ma', () => {
    const parsed = parseRosterCsv('email,displayName,phone\nfoo@x.com,"Line1\nLine2",0912\n')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]).toMatchObject({ email: 'foo@x.com', displayName: 'Line1\nLine2', phone: '0912' })
    expect(parsed.invalidEmails).toBe(0)
  })

  test('số dòng là dòng VẬT LÝ nơi bản ghi bắt đầu, tính cả header', () => {
    const parsed = parseRosterCsv('email,displayName,phone\na@x.com,A,1\nb@x.com,"B1\nB2",2\nc@x.com,C,3\n')
    expect(parsed.rows.map((r) => r.line)).toEqual([2, 3, 5])
  })

  test('vẫn tách đúng khi dùng CRLF và có dòng trống xen giữa', () => {
    const parsed = parseRosterCsv('a@x.com,A,1\r\n\r\nb@x.com,"B, có phẩy",2\r\n')
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[1]).toMatchObject({ displayName: 'B, có phẩy', line: 3 })
  })

  test('nháy escape bên trong ô nhiều dòng vẫn về đúng một dấu nháy', () => {
    const recs = splitCsvRecords('a@x.com,"nói ""xin chào""\nrồi đi"')
    expect(recs).toHaveLength(1)
    expect(parseCsvLine(recs[0].text)[1]).toBe('nói "xin chào"\nrồi đi')
  })

  test('nháy không đóng tới cuối tệp không làm mất bản ghi', () => {
    const recs = splitCsvRecords('a@x.com,"chưa đóng\nb@x.com,B,2')
    expect(recs).toHaveLength(1)
  })
})
