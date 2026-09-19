import { __setLocale } from '../../../test/mocks/expo-localization'
import {
  DEFAULT_LOCALE,
  defineMessages,
  getDeviceLocale,
  interpolate,
  normalizeLocale,
  resetDeviceLocaleForTests,
  translate,
} from '../index'

/** Q-D — i18n onboarding/auth mobile (Đợt 3 PR-3, 19/09/2026). */

const messages = defineMessages(
  { hello: 'Xin chào {name}', nested: { cta: 'Bắt đầu' }, onlyVi: 'chỉ có vi' },
  {
    en: { hello: 'Hello {name}', nested: { cta: 'Start' }, onlyVi: 'vi only' },
    de: { hello: 'Hallo {name}', nested: { cta: 'Loslegen' }, onlyVi: 'nur vi' },
  },
)

beforeEach(() => {
  resetDeviceLocaleForTests()
  __setLocale('vi')
})

describe('normalizeLocale', () => {
  it('lấy mã ngôn ngữ trước dấu - / _, không phân biệt hoa thường; ngoài vi/en/de rơi về vi', () => {
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('de_DE')).toBe('de')
    expect(normalizeLocale('VI')).toBe('vi')
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE)
  })
})

describe('getDeviceLocale', () => {
  it('đọc expo-localization và cache; reset mới đọc lại', () => {
    __setLocale('de')
    expect(getDeviceLocale()).toBe('de')
    __setLocale('en')
    expect(getDeviceLocale()).toBe('de')
    resetDeviceLocaleForTests()
    expect(getDeviceLocale()).toBe('en')
  })
})

describe('translate / interpolate', () => {
  it('trả đúng ngôn ngữ, khoá lồng nhau, có nội suy', () => {
    expect(translate(messages, 'vi')('hello', { name: 'Cự' })).toBe('Xin chào Cự')
    expect(translate(messages, 'en')('hello', { name: 'Cu' })).toBe('Hello Cu')
    expect(translate(messages, 'de')('nested.cta')).toBe('Loslegen')
  })

  it('mặc định theo ngôn ngữ thiết bị', () => {
    __setLocale('en')
    expect(translate(messages)('nested.cta')).toBe('Start')
  })

  it('chỗ giữ không có giá trị thì để nguyên; thiếu khoá (runtime) trả về chính khoá, không ném', () => {
    expect(interpolate('A {x} B {y}', { x: 1 })).toBe('A 1 B {y}')
    const t = translate(messages, 'en') as unknown as (k: string) => string
    expect(t('khong.co')).toBe('khong.co')
  })

  it('rơi về vi khi bản ngôn ngữ thiếu khoá (phòng runtime; tsc đã chặn lúc khai)', () => {
    const partial = { vi: { a: 'A-vi' }, en: {} as { a: string }, de: {} as { a: string } }
    expect(translate(partial, 'en')('a')).toBe('A-vi')
  })
})
