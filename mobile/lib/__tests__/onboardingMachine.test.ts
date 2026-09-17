/**
 * Hợp đồng máy trạng thái onboarding v3.1 — chạy trên CHÍNH fixture dùng chung với web
 * (`docs/onboarding-flow-spec.transitions.json` ở repo root). Web có `machine.test.ts` chạy y hệt.
 * Đổi luồng = sửa fixture trước, hai bên đỏ, rồi mới sửa code.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  isZeroLevel,
  nextOnboardingState,
  type OnbContext,
  type OnbEvent,
  type OnbState,
} from '@/lib/onboardingMachine'

interface FixtureRow {
  id: string
  state: OnbState
  event: OnbEvent
  ctx: Partial<OnbContext>
  next: OnbState
  note: string
}
interface Fixture {
  version: string
  states: OnbState[]
  events: OnbEvent[]
  defaultCtx: OnbContext
  rows: FixtureRow[]
}

// mobile/lib/__tests__ → repo root
const FIXTURE_PATH = resolve(__dirname, '../../../docs/onboarding-flow-spec.transitions.json')
const fixture: Fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))

describe('onboarding machine — fixture dùng chung web/mobile', () => {
  it('fixture đúng phiên bản và có hàng', () => {
    expect(fixture.version).toBe('onb_v3_1')
    expect(fixture.rows.length).toBeGreaterThan(30)
  })

  it.each(fixture.rows.map((r) => [r.id, r] as const))('%s', (_id, row) => {
    const ctx: OnbContext = { ...fixture.defaultCtx, ...row.ctx }
    expect(nextOnboardingState(row.state, row.event, ctx)).toBe(row.next)
  })

  it('I-13: mọi cặp (state, event) KHÔNG có trong bảng giữ nguyên state', () => {
    const covered = new Set(fixture.rows.map((r) => `${r.state}|${r.event}`))
    for (const state of fixture.states) {
      for (const event of fixture.events) {
        if (covered.has(`${state}|${event}`)) continue
        expect(nextOnboardingState(state, event, fixture.defaultCtx)).toBe(state)
      }
    }
  })

  it('I-1: từ CREATING với A0/null, plan_ready LUÔN tới FIRST_LESSON bất kể pathChoice', () => {
    for (const level of ['A0', null, 'a0']) {
      for (const pathChoice of [null, 'skip', 'placement', 'mock_exam'] as const) {
        const ctx: OnbContext = { ...fixture.defaultCtx, authed: true, level, pathChoice }
        expect(nextOnboardingState('CREATING', 'plan_ready', ctx)).toBe('FIRST_LESSON')
      }
    }
  })

  it('I-9: PATH_CHOICE khi chưa có tài khoản chỉ tới AUTH_GATE', () => {
    for (const pathChoice of ['skip', 'placement', 'mock_exam'] as const) {
      const ctx: OnbContext = { ...fixture.defaultCtx, authed: false, level: 'B1', pathChoice }
      expect(nextOnboardingState('PATH_CHOICE', 'path_selected', ctx)).toBe('AUTH_GATE')
    }
  })

  it('I-11: PROFILE_LITE không bao giờ tới TASTE hay PATH_CHOICE', () => {
    const ctx: OnbContext = { ...fixture.defaultCtx, authed: true, accountSource: 'ORG_ROSTER', level: 'B1' }
    for (const event of fixture.events) {
      const next = nextOnboardingState('PROFILE_LITE', event, ctx)
      expect(next).not.toBe('TASTE')
      expect(next).not.toBe('PATH_CHOICE')
    }
  })

  it('isZeroLevel: null/rỗng/A0 là ZERO', () => {
    expect(isZeroLevel(null)).toBe(true)
    expect(isZeroLevel('')).toBe(true)
    expect(isZeroLevel('a0')).toBe(true)
    expect(isZeroLevel('A1')).toBe(false)
  })
})
