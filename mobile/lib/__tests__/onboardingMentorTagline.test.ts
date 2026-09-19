import { __setLocale } from '../../test/mocks/expo-localization'
import { resetDeviceLocaleForTests } from '@/lib/i18n'
import { MENTOR_META, mentorTagline } from '@/lib/onboardingMentor'
import { skillMeta, placementResultCopy } from '@/lib/placementTest'

/** Q-D — tagline mentor + câu chữ placement theo ngôn ngữ thiết bị (Đợt 3 PR-3, 19/09/2026). */

beforeEach(() => {
  resetDeviceLocaleForTests()
  __setLocale('vi')
})

describe('mentorTagline', () => {
  it('vi = MENTOR_META (nguồn); en/de dịch; mã lạ → câu chung theo ngôn ngữ', () => {
    expect(mentorTagline('ANNA')).toBe(MENTOR_META.ANNA.tagline)
    expect(mentorTagline('ANNA', 'en')).toBe('Career advisor & exam coach')
    expect(mentorTagline('ANNA', 'de')).toBe('Berufsberaterin & Prüfungscoach')
    expect(mentorTagline('KHONG_CO', 'en')).toBe('Your learning companion')
    expect(mentorTagline(null)).toBe('Người đồng hành học tập của bạn')
  })

  it('mọi mã trong MENTOR_META đều có bản en và de (không rơi về vi)', () => {
    for (const code of Object.keys(MENTOR_META)) {
      expect(mentorTagline(code, 'en')).not.toBe(MENTOR_META[code].tagline)
      expect(mentorTagline(code, 'de')).not.toBe(MENTOR_META[code].tagline)
    }
  })

  it('theo ngôn ngữ thiết bị khi không truyền locale', () => {
    __setLocale('de')
    expect(mentorTagline('LENA')).toBe('Einzelhandel')
  })
})

describe('placementTest copy theo ngôn ngữ', () => {
  it('skillMeta và placementResultCopy đổi ngôn ngữ, giữ số liệu', () => {
    __setLocale('en')
    expect(skillMeta('HOEREN').label).toBe('Listening')
    const failed = placementResultCopy(
      { passed: false, scorePercent: 40, correctCount: 4, totalQuestions: 10, weakModules: [1, 2], retryAfterDays: 3 } as never,
      'B1',
    )
    expect(failed.score).toBe('4/10 correct (40%)')
    expect(failed.body).toContain('2 topics')
    expect(failed.body).toContain('3 days')
  })
})
