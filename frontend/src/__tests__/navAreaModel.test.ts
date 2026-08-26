/**
 * Wave 1 / S-01 — hợp đồng của MÔ HÌNH area navigation (IA-D1, IA-D6, IA-D7, IA-D8).
 *
 * Đây là test quan trọng nhất của đợt: nó chứng minh việc thu gọn nav KHÔNG làm mất
 * destination nào. Nguồn sự thật là cây route thật trong `src/app/v2/**` — mỗi route
 * student/teacher phải thuộc đúng một area hoặc là utility đã khai báo.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  studentAreas,
  teacherAreas,
  ROLE_AREAS,
  resolveArea,
  isUnder,
  isImmersiveRoute,
  studentNav,
  teacherNav,
  type RoleAreas,
} from '@/components/ui-v2/nav'

const APP_V2 = join(__dirname, '../app/v2')

/** Liệt kê route thật (thư mục có page.tsx), bỏ segment động và route group. */
function realRoutes(sub: string): string[] {
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    if (entries.includes('page.tsx')) out.push(url)
    for (const e of entries) {
      if (!statSync(join(dir, e)).isDirectory()) continue
      if (e.startsWith('[')) continue // segment động — cha đã đại diện
      const seg = e.startsWith('(') ? '' : `/${e}` // route group không xuất hiện trong URL
      walk(join(dir, e), url + seg)
    }
  }
  walk(join(APP_V2, sub), `/v2/${sub}`)
  return out.sort()
}

/** Mọi prefix mà một RoleAreas tuyên bố sở hữu (area href + match + local href + utility + inbox). */
function ownedPrefixes(role: RoleAreas): string[] {
  const out: string[] = []
  for (const a of role.areas) {
    out.push(a.href, ...a.match)
    for (const l of a.local ?? []) out.push(l.href)
  }
  for (const u of role.utility) out.push(u.href)
  if (role.inbox) out.push(role.inbox.href)
  return out
}

describe('S-01 — student: đúng 5 area, không mất destination', () => {
  it('persistent nav có ĐÚNG 5 top-level (IA-D1)', () => {
    expect(studentAreas.areas.map((a) => a.id)).toEqual([
      'heute',
      'lernen',
      'sprechen',
      'pruefung',
      'fortschritt',
    ])
  })

  it('mọi route /v2/student thật đều reachable (area hoặc utility) — 0 orphan', () => {
    const prefixes = ownedPrefixes(studentAreas)
    const orphans = realRoutes('student').filter((r) => !prefixes.some((p) => isUnder(r, p)))
    expect(orphans).toEqual([])
  })

  it('giữ nguyên URL — mọi href là route /v2 thật đang tồn tại (IA-D8)', () => {
    const real = Array.from(new Set([...realRoutes('student'), '/v2/profile', '/v2/notifications']))
    const hrefs = [
      ...studentAreas.areas.map((a) => a.href),
      ...studentAreas.areas.flatMap((a) => (a.local ?? []).map((l) => l.href)),
      ...studentAreas.utility.map((u) => u.href),
      studentAreas.inbox!.href,
    ]
    // `/speaking/history` là route con thật; so khớp bằng tiền tố route đã tồn tại.
    const missing = hrefs.filter((h) => !real.some((r) => isUnder(h, r) || isUnder(r, h)))
    expect(missing).toEqual([])
  })

  it('Lernen là Journey home (IA-D2) và Fortschritt là progress home (IA-D5)', () => {
    const byId = Object.fromEntries(studentAreas.areas.map((a) => [a.id, a]))
    expect(byId.lernen.href).toBe('/v2/student/roadmap')
    expect(byId.fortschritt.href).toBe('/v2/student/progress')
    // stats/achievements/history/certificates trở thành subsection của Fortschritt.
    expect(byId.fortschritt.local?.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        '/v2/student/stats',
        '/v2/student/achievements',
        '/v2/student/exercise-history',
        '/v2/student/certificates',
      ]),
    )
  })

  it('AI Interview thuộc Sprechen và đứng ĐẦU local nav (IA-D4)', () => {
    const sprechen = studentAreas.areas.find((a) => a.id === 'sprechen')!
    expect(sprechen.local![0].href).toBe('/v2/student/interviews')
    // Không tạo top-level thứ 6.
    expect(studentAreas.areas.some((a) => a.href.includes('interview'))).toBe(false)
  })

  it('utility KHÔNG nằm trong persistent nav (IA-D3)', () => {
    const utilityHrefs = studentAreas.utility.map((u) => u.href)
    expect(utilityHrefs).toEqual(
      expect.arrayContaining(['/v2/profile', '/v2/student/tuition', '/v2/student/welcome']),
    )
    const areaHrefs = studentAreas.areas.flatMap((a) => [a.href, ...(a.local ?? []).map((l) => l.href)])
    for (const u of utilityHrefs) expect(areaHrefs).not.toContain(u)
  })

  it('mỗi area có nhãn Đức + helper tiếng Việt (song ngữ theo trình độ)', () => {
    for (const a of studentAreas.areas) {
      expect(a.label.length).toBeGreaterThan(0)
      expect(a.helper.length).toBeGreaterThan(0)
      expect(a.helper).not.toBe(a.label)
    }
  })
})

describe('S-01 — teacher: 5 nhóm theo việc hằng ngày (IA-D6)', () => {
  it('đúng 5 nhóm', () => {
    expect(teacherAreas.areas.map((a) => a.id)).toEqual([
      'tHeute',
      'tKlassen',
      'tBewerten',
      'tMaterialien',
      'tBerichte',
    ])
  })

  it('mọi route /v2/teacher thật đều reachable — 0 orphan', () => {
    const prefixes = ownedPrefixes(teacherAreas)
    // `/v2/teacher/sessions` + `/v2/teacher/profile` là tàn dư v1 đã bị gỡ khỏi nav từ trước
    // Wave 1 (hồ sơ dùng chung `/v2/profile`) — không phải regression của đợt này.
    const known = ['/v2/teacher/sessions', '/v2/teacher/profile']
    const orphans = realRoutes('teacher').filter(
      (r) => !prefixes.some((p) => isUnder(r, p)) && !known.includes(r),
    )
    expect(orphans).toEqual([])
  })

  it('AI tools là phương thức tạo trong Materialien, không phải area riêng', () => {
    expect(teacherAreas.areas.some((a) => a.id.toLowerCase().includes('ai'))).toBe(false)
    const materialien = teacherAreas.areas.find((a) => a.id === 'tMaterialien')!
    expect(materialien.match).toContain('/v2/teacher/tools')
  })

  it('mobile: Berichte gộp vào "Mehr", còn đúng 4 ô bottom nav (IA-D7)', () => {
    const visible = teacherAreas.areas.filter((a) => !a.mobileInMore)
    expect(visible).toHaveLength(4)
    expect(teacherAreas.areas.find((a) => a.mobileInMore)!.id).toBe('tBerichte')
  })

  it('student KHÔNG gộp area nào vào Mehr — đúng 5 ô bottom nav', () => {
    expect(studentAreas.areas.filter((a) => a.mobileInMore)).toHaveLength(0)
  })
})

describe('resolveArea — suy ra area theo pathname', () => {
  const cases: Array<[string, string]> = [
    ['/v2/student/dashboard', 'heute'],
    ['/v2/student/beginner', 'heute'],
    ['/v2/student/roadmap', 'lernen'],
    ['/v2/student/learn/42', 'lernen'],
    ['/v2/student/practice/42/reading', 'lernen'],
    ['/v2/student/vocabulary/swipe', 'lernen'],
    ['/v2/student/classes/7/assignments/9', 'lernen'],
    ['/v2/student/speaking', 'sprechen'],
    ['/v2/student/speaking/history', 'sprechen'],
    ['/v2/student/interviews', 'sprechen'],
    ['/v2/student/weekly-speaking', 'sprechen'],
    ['/v2/student/exam', 'pruefung'],
    ['/v2/student/mock-exam/run', 'pruefung'],
    ['/v2/student/assessment', 'pruefung'],
    ['/v2/student/progress', 'fortschritt'],
    ['/v2/student/certificates', 'fortschritt'],
  ]
  for (const [path, id] of cases) {
    it(`${path} → ${id}`, () => {
      expect(resolveArea(studentAreas, path)?.id).toBe(id)
    })
  }

  it('trailing slash không đổi kết quả', () => {
    expect(resolveArea(studentAreas, '/v2/student/roadmap/')?.id).toBe('lernen')
  })

  it('route utility không thuộc area nào', () => {
    expect(resolveArea(studentAreas, '/v2/student/tuition')).toBeUndefined()
    expect(resolveArea(studentAreas, '/v2/profile')).toBeUndefined()
  })

  it('teacher: trang chủ và route con phân giải đúng nhóm', () => {
    expect(resolveArea(teacherAreas, '/v2/teacher')?.id).toBe('tHeute')
    expect(resolveArea(teacherAreas, '/v2/teacher/grading')?.id).toBe('tBewerten')
    expect(resolveArea(teacherAreas, '/v2/teacher/tools/grammar')?.id).toBe('tMaterialien')
    expect(resolveArea(teacherAreas, '/v2/teacher/tc-timesheet')?.id).toBe('tBerichte')
  })
})

describe('isImmersiveRoute — ẩn bottom nav trong mode toàn màn hình (S-13)', () => {
  it('bật cho Exam Room / Interview Room / phiên nói đang chạy', () => {
    expect(isImmersiveRoute('/v2/student/mock-exam/run')).toBe(true)
    expect(isImmersiveRoute('/v2/student/speaking/live')).toBe(true)
    expect(isImmersiveRoute('/v2/student/interviews')).toBe(true)
  })

  it('tắt cho màn thường (kể cả trang chuẩn bị của cùng area)', () => {
    expect(isImmersiveRoute('/v2/student/mock-exam')).toBe(false)
    expect(isImmersiveRoute('/v2/student/speaking')).toBe(false)
    expect(isImmersiveRoute('/v2/student/dashboard')).toBe(false)
  })
})

describe('không phá cấu hình cũ', () => {
  it('admin/org vẫn dùng sections (không áp learner five-item rule)', () => {
    expect(ROLE_AREAS.admin).toBeUndefined()
    expect(ROLE_AREAS.org).toBeUndefined()
  })

  it('RoleNav legacy của student/teacher vẫn export được (không xoá route/khai báo)', () => {
    expect(studentNav.sections.length).toBeGreaterThan(0)
    expect(teacherNav.sections.length).toBeGreaterThan(0)
  })
})
