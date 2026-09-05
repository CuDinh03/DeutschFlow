// Sơ đồ màn cha của màn ẩn trong Tabs (student) + bộ nhớ "tab chính mở gần nhất".
// Tabs firstRoute đưa router.back() về Heute → mọi màn ẩn phải điều hướng tường minh.

import { existsSync } from 'fs'
import { join } from 'path'
import {
  PARENT_OF, STUDENT_TAB, isMainTab, lastMainTabHref, noteFocusedRoute, resetLastMainTab,
} from '@/lib/screenParents'

const APP = join(__dirname, '..', 'app')
const routeFileExists = (href: string): boolean =>
  existsSync(join(APP, `${href}.tsx`)) || existsSync(join(APP, href, 'index.tsx'))

describe('PARENT_OF', () => {
  it('mọi khoá là file màn có thật trong app/(student)', () => {
    for (const screen of Object.keys(PARENT_OF)) {
      expect({ screen, exists: existsSync(join(APP, '(student)', `${screen}.tsx`)) }).toEqual({ screen, exists: true })
    }
  })

  it('mọi màn cha là route có thật (file .tsx hoặc thư mục có index.tsx)', () => {
    for (const [screen, parent] of Object.entries(PARENT_OF)) {
      expect({ screen, parent, exists: routeFileExists(parent) }).toEqual({ screen, parent, exists: true })
    }
  })

  it('bài thi và xem lại về sảnh thi thử; node/skill về Lernweg; lớp con về danh sách lớp', () => {
    expect(PARENT_OF['exam-attempt']).toBe('/(student)/exam')
    expect(PARENT_OF['exam-review']).toBe('/(student)/exam')
    expect(PARENT_OF.node).toBe('/(student)/lernweg')
    expect(PARENT_OF['classes/[id]']).toBe('/(student)/classes')
    expect(PARENT_OF['messages/[userId]']).toBe('/(student)/messages')
  })
})

describe('lastMainTabHref', () => {
  beforeEach(() => resetLastMainTab())

  it('mặc định là Heute', () => {
    expect(lastMainTabHref()).toBe(STUDENT_TAB.index)
  })

  it('nhớ tab chính mở gần nhất, bỏ qua màn ẩn và route rỗng', () => {
    noteFocusedRoute('learn')
    expect(lastMainTabHref()).toBe('/(student)/learn')
    noteFocusedRoute('srs')
    noteFocusedRoute(undefined)
    expect(lastMainTabHref()).toBe('/(student)/learn')
    noteFocusedRoute('profile')
    expect(lastMainTabHref()).toBe('/(student)/profile')
  })

  it('isMainTab chỉ nhận 4 tab chính', () => {
    expect(['index', 'learn', 'speaking', 'profile'].every(isMainTab)).toBe(true)
    expect(isMainTab('srs')).toBe(false)
    expect(isMainTab('constructor')).toBe(false)
  })
})
