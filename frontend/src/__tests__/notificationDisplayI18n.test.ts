import { describe, expect, it } from 'vitest'
import { TYPE_ICON, TYPE_TONE, dayBucket, notifTitle, relTime, type NotifT } from '@/lib/notificationDisplay'
import chromeVi from '../../messages/v2/chrome.vi.json'
import chromeDe from '../../messages/v2/chrome.de.json'

/** F-I18N-02c (06/09/2026): nhãn loại/thời gian thông báo đọc từ catalog chrome `v2.notif` qua translator. */
function makeT(catalog: { notif: Record<string, unknown> }): NotifT {
  const flat = (obj: Record<string, unknown>, prefix = ''): Record<string, string> =>
    Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'string') acc[key] = v
      else if (v && typeof v === 'object') Object.assign(acc, flat(v as Record<string, unknown>, key))
      return acc
    }, {})
  const table = flat(catalog.notif)
  const t = ((key: string, values?: Record<string, string | number>) =>
    Object.entries(values ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), table[key] ?? key)) as NotifT
  t.has = (key: string) => key in table
  return t
}

const tVi = makeT(chromeVi as never)
const tDe = makeT(chromeDe as never)
const item = (type: string) => ({ id: 1, type, title: null, body: null, payload: {}, read: false, createdAtUtc: new Date().toISOString() }) as never

describe('notificationDisplay — i18n', () => {
  it('tiêu đề theo loại đọc từ catalog của locale', () => {
    expect(notifTitle(item('REVIEW_DUE'), tVi)).toBe('Đến hạn ôn tập')
    expect(notifTitle(item('REVIEW_DUE'), tDe)).toBe('Wiederholung fällig')
    expect(notifTitle(item('UNKNOWN_TYPE'), tDe)).toBe('Benachrichtigung')
  })

  it('thời gian tương đối + nhóm ngày theo locale', () => {
    const now = new Date().toISOString()
    expect(relTime(now, tVi, 'vi')).toBe('vừa xong')
    expect(relTime(now, tDe, 'de')).toBe('gerade eben')
    const threeHours = new Date(Date.now() - 3 * 36e5).toISOString()
    expect(relTime(threeHours, tDe, 'de')).toBe('vor 3 Std.')
    expect(dayBucket(now, tVi)).toBe('Hôm nay')
    expect(dayBucket(now, tDe)).toBe('Heute')
    const old = new Date(Date.now() - 30 * 864e5).toISOString()
    expect(relTime(old, tDe, 'de')).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  })

  // DEC-18: ba loại nội bộ trung tâm có nhãn ở cả ba catalog (parity do check:i18n giữ) và fallback tiếng Việt.
  it('nhãn thông báo nội bộ trung tâm (DEC-18) có ở catalog và fallback', () => {
    expect(notifTitle(item('SCHEDULE_CHANGE_REJECTED'), tVi)).toBe('Đề xuất đổi lịch bị từ chối')
    expect(notifTitle(item('TIMESHEET_PERIOD_APPROVED'), tDe)).toBe('Stundenzettel genehmigt')
    expect(notifTitle(item('TIMESHEET_PERIOD_RETURNED'), tVi)).toBe('Kỳ công bị trả lại')
    expect(notifTitle(item('TIMESHEET_PERIOD_RETURNED'))).toBe('Kỳ công bị trả lại')
    for (const type of ['SCHEDULE_CHANGE_REJECTED', 'TIMESHEET_PERIOD_APPROVED', 'TIMESHEET_PERIOD_RETURNED']) {
      expect(TYPE_ICON[type]).toBeTruthy()
      expect(TYPE_TONE[type]).toMatch(/^var\(--ga-/)
    }
  })

  it('không có translator thì giữ hành vi tiếng Việt cũ', () => {
    expect(notifTitle(item('LEVEL_UP'))).toBe('Lên cấp độ')
    expect(dayBucket(new Date().toISOString())).toBe('Hôm nay')
  })
})
