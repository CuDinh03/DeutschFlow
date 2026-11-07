/** Đường dẫn phòng thi nói trong khu Luyện thi (Đợt 2 phòng thi nói, 07/11/2026). */
import { describe, it, expect } from 'vitest'
import { oralEntryHref, oralSessionHref, parseOralEntry, safeReturn } from '@/lib/exam/oralRoutes'
import { oralHref } from '@/components/exam/today/todayModel'

describe('oralRoutes', () => {
  it('lối vào mặc định: thi thử telc B1', () => {
    expect(oralEntryHref()).toBe('/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=MOCK')
  })

  it('luyện Teil kèm return; teil bị bỏ khi là thi thử', () => {
    expect(oralEntryHref({ provider: 'GOETHE', level: 'A2', mode: 'DRILL', teil: 2, ret: '/v2/student/mock-exam/practice?examId=7' })).toBe(
      '/v2/student/mock-exam/oral?provider=GOETHE&level=A2&mode=DRILL&teil=2&return=%2Fv2%2Fstudent%2Fmock-exam%2Fpractice%3FexamId%3D7',
    )
    expect(oralEntryHref({ mode: 'MOCK', teil: 2 })).not.toContain('teil=')
  })

  it('phòng thi của một phiên, return được mã hoá', () => {
    expect(oralSessionHref(42)).toBe('/v2/student/mock-exam/oral/42')
    expect(oralSessionHref(42, '/v2/student/exam')).toBe('/v2/student/mock-exam/oral/42?return=%2Fv2%2Fstudent%2Fexam')
  })

  it('return chỉ nhận đường dẫn nội bộ khu học viên', () => {
    expect(safeReturn('/v2/student/mock-exam/oral/other')).toBe('/v2/student/mock-exam/oral/other')
    for (const bad of [null, '', 'https://evil.com', '//evil.com/v2/student/', 'javascript:alert(1)', '/v2/admin/users', '/v2/student/\\evil']) {
      expect(safeReturn(bad)).toBe('/v2/student/exam')
    }
  })

  it('đọc tham số: giá trị lạ rơi về mặc định', () => {
    expect(parseOralEntry(new URLSearchParams('provider=X&level=C1&mode=Y&teil=abc&prepMode=Z&return=https://x'))).toEqual({
      provider: 'TELC',
      level: 'B1',
      mode: 'MOCK',
      teil: null,
      prepMode: null,
      ret: '/v2/student/exam',
    })
    expect(parseOralEntry(new URLSearchParams('provider=GOETHE&level=B2&mode=DRILL&teil=2&prepMode=FULL&return=/v2/student/mock-exam/oral/other'))).toEqual({
      provider: 'GOETHE',
      level: 'B2',
      mode: 'DRILL',
      teil: 2,
      prepMode: 'FULL',
      ret: '/v2/student/mock-exam/oral/other',
    })
  })

  it('oralHref của lịch ôn: không Teil = thi thử, có Teil = luyện Teil đó', () => {
    expect(oralHref({ provider: 'TELC', level: 'B1' })).toBe('/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=MOCK')
    expect(oralHref(null, 3)).toBe('/v2/student/mock-exam/oral?provider=TELC&level=B1&mode=DRILL&teil=3')
  })
})
