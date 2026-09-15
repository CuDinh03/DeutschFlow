import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * V-12b — hai route giáo viên mồ côi khỏi sidebar không được là màn SỐNG.
 *
 * `/v2/teacher/sessions` là nửa giáo viên của chợ gia sư C2C: nửa học viên (`/teachers`,
 * `/v2/student/tutor`) đã `notFound()` khi `MARKETPLACE_ENABLED` tắt, còn nửa này thì không —
 * gõ thẳng URL là vào được luồng tiền chưa hoàn thiện, kèm chuỗi tiếng Việt chưa qua i18n.
 * `/v2/teacher/profile` là bản hồ sơ v1 thiếu form đổi mật khẩu, đã bị nav thay bằng `/v2/profile`.
 */
const FE_ROOT = resolve(__dirname, '../../../..')
const src = (rel: string) => readFileSync(resolve(FE_ROOT, rel), 'utf8')

describe('route giáo viên mồ côi (V-12b)', () => {
  it('/v2/teacher/sessions chặn sau MARKETPLACE_ENABLED, cùng cổng với nửa học viên', () => {
    const sessions = src('src/app/v2/teacher/sessions/page.tsx')
    expect(sessions).toContain("import { MARKETPLACE_ENABLED } from '@/lib/features'")
    expect(sessions).toMatch(/if \(!MARKETPLACE_ENABLED\) notFound\(\)/)

    // Cùng một cổng chứ không phải cổng riêng: nửa học viên vẫn phải giữ nguyên điều kiện đó.
    expect(src('src/app/v2/student/tutor/page.tsx')).toMatch(/if \(!MARKETPLACE_ENABLED\) notFound\(\)/)
  })

  it('/v2/teacher/profile chỉ còn redirect sang hồ sơ dùng chung', () => {
    const profile = src('src/app/v2/teacher/profile/page.tsx')
    expect(profile).toMatch(/redirect\('\/v2\/profile'\)/)
    // Không còn form/tab riêng — nếu còn thì đây lại là màn hồ sơ thứ hai, nghèo hơn.
    expect(profile).not.toContain('useState')
    expect(profile).not.toContain('tabAvail')
  })

  it('khoá catalog của màn hồ sơ giáo viên cũ đã gỡ khỏi cả ba ngôn ngữ', () => {
    for (const loc of ['vi', 'en', 'de']) {
      const cat = JSON.parse(src(`messages/v2/teacher.${loc}.json`)) as { teacher: Record<string, unknown> }
      expect(cat.teacher, `teacher.profile còn sót ở ${loc}`).not.toHaveProperty('profile')
    }
  })
})
