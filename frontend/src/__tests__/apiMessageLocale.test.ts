import { afterEach, describe, expect, it } from 'vitest'
import { apiMessage } from '@/lib/api'
import { currentUiLocale } from '@/lib/i18n/clientLocale'

/** F-I18N-02c (06/09/2026): câu dự phòng của apiMessage theo cookie `locale`, không còn ghim tiếng Việt. */
const offline = { isAxiosError: true, message: 'Network Error', response: undefined }

afterEach(() => {
  document.cookie = 'locale=; max-age=0; path=/'
})

describe('apiMessage — fallback theo locale UI', () => {
  it('đọc cookie locale (vi mặc định, en/de khi có)', () => {
    expect(currentUiLocale()).toBe('vi')
    document.cookie = 'locale=de; path=/'
    expect(currentUiLocale()).toBe('de')
    document.cookie = 'locale=xx; path=/'
    expect(currentUiLocale()).toBe('vi')
  })

  it('không có body lỗi → câu dự phòng đúng ngôn ngữ', () => {
    expect(apiMessage(offline)).toBe('Mất kết nối mạng. Kiểm tra đường truyền rồi thử lại.')
    document.cookie = 'locale=en; path=/'
    expect(apiMessage(offline)).toBe('No network connection. Check your connection and try again.')
    document.cookie = 'locale=de; path=/'
    expect(apiMessage(offline)).toMatch(/^Keine Netzwerkverbindung/)
    expect(apiMessage('boom')).toBe('Unbekannter Fehler')
  })

  it('có `detail` từ backend thì trả nguyên văn bất kể locale', () => {
    document.cookie = 'locale=en; path=/'
    const withDetail = { isAxiosError: true, message: 'Request failed', response: { status: 400, data: { detail: 'Tên lớp không được để trống' } } }
    expect(apiMessage(withDetail)).toBe('Tên lớp không được để trống')
  })
})
