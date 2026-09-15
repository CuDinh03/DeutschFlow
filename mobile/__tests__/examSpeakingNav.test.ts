// Luật "màn cha" của cụm Luyện thi Nói: nút back trên header (và back cứng Android) điều hướng
// TƯỜNG MINH tới màn cha, không `router.back()` — Tabs (student) mặc định backBehavior=firstRoute
// nên back từ mọi màn ẩn (href: null) đều rơi về Heute (QA simulator 06/09/2026).

import { existsSync } from 'fs'
import { join } from 'path'
import { EXAM_ROUTES, examParentHref } from '@/lib/examSpeakingNav'

describe('examParentHref', () => {
  it('hub Luyện thi Nói lùi về tab Speaking', () => {
    expect(examParentHref('hub')).toBe('/(student)/speaking')
  })

  it.each(['room', 'result', 'weakness'] as const)('màn %s lùi về hub Luyện thi Nói', (screen) => {
    expect(examParentHref(screen)).toBe('/(student)/speaking-exam')
  })

  it('mọi href trong EXAM_ROUTES trỏ tới file màn có thật trong app/', () => {
    for (const href of Object.values(EXAM_ROUTES)) {
      expect(existsSync(join(__dirname, '..', 'app', `${href}.tsx`))).toBe(true)
    }
  })
})
