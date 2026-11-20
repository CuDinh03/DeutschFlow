// `examRoutes` ép đường dẫn về `Href` (typed routes không suy ra được), nên tsc không bắt được đường
// tới màn chưa có. Canh ở mức file: mọi đường của Luyện thi phải có màn tương ứng trong app/(student).
import { existsSync } from 'fs'
import { join } from 'path'
import { diagnosticRoute, diagnosticTeilRoute, examPlanRoute, examSetRoute, fullExamRoute, oralRoute, roadmapRoute, teilRoute } from '../examRoutes'

const ROUTES = [examSetRoute(1), teilRoute(1, 'LESEN-1'), diagnosticTeilRoute(1, 'LESEN-1'), fullExamRoute(1), diagnosticRoute, examPlanRoute, roadmapRoute, oralRoute(null)]

describe('examRoutes', () => {
  it.each(ROUTES.map((r) => r.pathname))('%s có file màn', (pathname) => {
    const file = pathname.replace('/(student)/', '')
    expect(existsSync(join(__dirname, '..', '..', 'app', '(student)', `${file}.tsx`))).toBe(true)
  })
})
