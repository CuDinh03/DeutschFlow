import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * F-I18N-02d (06/09/2026): tên dự phòng "Lớp #id" / "Học viên #id" trong lib ngoài React đi qua
 * uiText() theo cookie `locale` — người dùng EN/DE không còn thấy tiếng Việt trong danh sách lớp/học viên.
 */
const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import { listAllTeacherStudents, listTeacherClasses } from '@/lib/teacherMessagingApi'
import { getClassesSummary } from '@/lib/teacherAnalyticsApi'

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  document.cookie = 'locale=; max-age=0; path=/'
})

describe('teacherMessagingApi — tên dự phòng theo locale UI', () => {
  it('lớp không tên: vi mặc định, en/de theo cookie; lớp có tên giữ nguyên', async () => {
    get.mockResolvedValue({ data: [{ id: 7, name: '  ' }, { id: 8, name: 'A2 Sáng', studentCount: 3 }] })
    expect((await listTeacherClasses()).map((c) => c.name)).toEqual(['Lớp #7', 'A2 Sáng'])
    document.cookie = 'locale=en; path=/'
    expect((await listTeacherClasses())[0].name).toBe('Class #7')
    document.cookie = 'locale=de; path=/'
    expect((await listTeacherClasses())[0].name).toBe('Klasse #7')
  })

  it('học viên không tên hiển thị', async () => {
    get.mockImplementation((url: string) =>
      url.endsWith('/students')
        ? Promise.resolve({ data: [{ studentId: 42, email: 'x@y.z' }] })
        : Promise.resolve({ data: [{ id: 1, name: 'A1' }] }),
    )
    expect((await listAllTeacherStudents())[0].displayName).toBe('Học viên #42')
    document.cookie = 'locale=en; path=/'
    expect((await listAllTeacherStudents())[0].displayName).toBe('Student #42')
    document.cookie = 'locale=de; path=/'
    expect((await listAllTeacherStudents())[0].displayName).toBe('Lernende/r #42')
  })
})

describe('teacherAnalyticsApi.getClassesSummary — tên dự phòng theo locale UI', () => {
  it('tên thiếu → "Lớp #id" / "Class #id" / "Klasse #id"', async () => {
    get.mockResolvedValue({ data: [{ id: 3, studentCount: 2 }] })
    expect((await getClassesSummary())[0].name).toBe('Lớp #3')
    document.cookie = 'locale=en; path=/'
    expect((await getClassesSummary())[0].name).toBe('Class #3')
    document.cookie = 'locale=de; path=/'
    expect((await getClassesSummary())[0].name).toBe('Klasse #3')
  })
})
