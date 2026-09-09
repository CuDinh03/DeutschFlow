import { describe, expect, test } from 'vitest'
import { studentsToCsv, parseCsvLine, parseRosterCsv, rosterTemplateCsv, rosterErrorsCsv, splitCsvRecords, isIsoDate } from './orgCsv'
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


// ─── Gói 1 (DEC-22, 09/09/2026): cột `birthDate` + người giám hộ, TÙY CHỌN ───
// Owner chốt: có `birthDate` trong header thì đọc cột mới; không có thì giữ NGUYÊN hành vi cũ —
// tệp CSV các trung tâm đang dùng không được vỡ.

describe('isIsoDate', () => {
  test('nhận YYYY-MM-DD có thật trên lịch', () => {
    expect(isIsoDate('2011-09-15')).toBe(true)
    expect(isIsoDate('2024-02-29')).toBe(true)
  })
  test('từ chối ngày không có thật, dạng Excel tiếng Việt, và ô rác', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2023-02-29')).toBe(false)
    expect(isIsoDate('15/09/2011')).toBe(false)
    expect(isIsoDate('2011-9-5')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('parseRosterCsv — cột mới TÙY CHỌN', () => {
  test('tệp ba cột cũ: không đẻ thêm khoá, không bật cờ, đọc theo VỊ TRÍ như trước', () => {
    const p = parseRosterCsv('email,displayName,phone\r\nan@x.com,An,0912\r\n')
    expect(p.hasBirthDate).toBe(false)
    expect(p.hasGuardian).toBe(false)
    expect(p.invalidBirthDates).toBe(0)
    expect(p.rows[0].birthDate).toBeUndefined()
    expect(p.rows[0].guardianName).toBeUndefined()
  })

  test('tệp không header vẫn đọc theo vị trí, không bật cờ nào', () => {
    const p = parseRosterCsv('an@x.com,An,0912')
    expect(p.hasHeader).toBe(false)
    expect(p.hasBirthDate).toBe(false)
    expect(p.rows[0]).toEqual({ email: 'an@x.com', displayName: 'An', phone: '0912', line: 1 })
  })

  test('header khai birthDate → đọc theo TÊN cột, thứ tự cột tuỳ ý', () => {
    const p = parseRosterCsv('email,birthDate,displayName\r\nan@x.com,2011-09-15,"Nguyễn, An"\r\n')
    expect(p.hasBirthDate).toBe(true)
    expect(p.rows[0]).toMatchObject({ email: 'an@x.com', displayName: 'Nguyễn, An', birthDate: '2011-09-15', phone: '' })
  })

  test('tên cột không phân biệt hoa thường / gạch dưới / dấu cách / dấu chấm', () => {
    const p = parseRosterCsv('email,Display_Name,Birth.Date,GUARDIANNAME\r\nan@x.com,An,2011-09-15,Trần Thị C\r\n')
    expect(p.hasHeader).toBe(true)
    expect(p.hasBirthDate).toBe(true)
    expect(p.hasGuardian).toBe(true)
    expect(p.rows[0]).toMatchObject({ displayName: 'An', birthDate: '2011-09-15', guardianName: 'Trần Thị C' })
  })

  test('ô ngày trống KHÔNG bị tính sai; chỉ ô có chữ mà sai dạng mới bị đếm', () => {
    const p = parseRosterCsv('email,displayName,birthDate\r\na@x.com,A,\r\nb@x.com,B,15/09/2011\r\nc@x.com,C,2011-09-15\r\n')
    expect(p.invalidBirthDates).toBe(1)
    expect(p.rows.map((r) => r.birthDate)).toEqual(['', '15/09/2011', '2011-09-15'])
  })

  test('ô quan hệ giữ NGUYÊN VĂN (máy chủ nhận cả bí danh tiếng Việt); cột thiếu thì không có khoá', () => {
    const p = parseRosterCsv('email,birthDate,guardianName,guardianRelationship\r\na@x.com,2011-09-15,Trần Thị C,mẹ\r\n')
    expect(p.rows[0]).toMatchObject({ guardianName: 'Trần Thị C', guardianRelationship: 'mẹ' })
    expect(p.rows[0].guardianPhone).toBeUndefined()
  })

  // Bám sát `RosterColumnLayout` của backend — lệch chỗ nào là xem trước và kết quả nhập nói khác nhau.
  test('tên cột lạ ở vị trí 1: lùi về vị trí mặc định ĐÚNG như máy chủ, không bỏ trống tên', () => {
    const p = parseRosterCsv('email,fullName,birthDate\r\na@x.com,Nguyễn An,2011-09-15\r\n')
    expect(p.rows[0]).toMatchObject({ displayName: 'Nguyễn An', birthDate: '2011-09-15' })
  })

  test('vị trí mặc định đã có cột tên khác chiếm thì KHÔNG lùi về đó', () => {
    const p = parseRosterCsv('email,birthDate\r\na@x.com,2011-09-15\r\n')
    expect(p.rows[0].displayName).toBe('')
    expect(p.rows[0].birthDate).toBe('2011-09-15')
  })

  test('có guardianName nhưng KHÔNG có birthDate: máy chủ không đọc, nên web cũng không nhận', () => {
    const p = parseRosterCsv('email,displayName,guardianName\r\na@x.com,A,Trần Thị C\r\n')
    expect(p.hasBirthDate).toBe(false)
    expect(p.hasGuardian).toBe(false)
    expect(p.rows[0].guardianName).toBeUndefined()
  })

  test('ô đầu là `e-mail` KHÔNG được coi là tiêu đề — backend isHeader cũng không', () => {
    const p = parseRosterCsv('e-mail,displayName,birthDate\r\na@x.com,A,2011-09-15\r\n')
    expect(p.hasHeader).toBe(false)
    expect(p.hasBirthDate).toBe(false)
    expect(p.rows).toHaveLength(2)
  })

  test('vẫn giữ số dòng vật lý và đếm email sai khi đọc theo tên cột', () => {
    const p = parseRosterCsv('email,displayName,birthDate\r\n\r\nkhong-phai-email,A,2011-09-15\r\n')
    expect(p.invalidEmails).toBe(1)
    expect(p.rows[0].line).toBe(3)
  })
})

describe('rosterTemplateCsv — Gói 1', () => {
  test('ba cột cũ vẫn đứng đầu, cột mới nối vào sau', () => {
    const csv = rosterTemplateCsv()
    expect(csv.startsWith('\uFEFFemail,displayName,phone,birthDate,')).toBe(true)
    expect(csv).toContain('guardianName,guardianRelationship,guardianPhone')
    // Đường CSV của máy chủ KHÔNG đọc email người giám hộ — mời gõ vào là mời gõ vào hư không.
    expect(csv).not.toContain('guardianEmail')
  })

  test('tệp mẫu tự đọc lại được: có cột ngày sinh, không dòng nào sai định dạng, có ca vị thành niên kèm giám hộ', () => {
    const p = parseRosterCsv(rosterTemplateCsv())
    expect(p.hasBirthDate).toBe(true)
    expect(p.hasGuardian).toBe(true)
    expect(p.invalidEmails).toBe(0)
    expect(p.invalidBirthDates).toBe(0)
    expect(p.rows).toHaveLength(2)
    expect(p.rows[1]).toMatchObject({ birthDate: '2011-09-15', guardianName: 'Trần Thị C', guardianRelationship: 'MOTHER' })
  })
})
