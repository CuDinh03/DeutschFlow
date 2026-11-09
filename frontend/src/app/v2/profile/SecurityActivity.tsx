'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GaBtn } from '@/components/ui-v2'
import { getSecurityEvents, type SecurityEventItem } from '@/lib/profileApi'
import { relTime } from '@/lib/notificationDisplay'

const PAGE_SIZE = 10

/**
 * Nhãn theo tên vết audit (danh sách trắng ở backend `UserSecurityEventsService.EVENTS`). Khoá
 * next-intl không chứa dấu chấm nên ánh xạ sang khoá phẳng; vết lạ (backend thêm trước khi web kịp
 * cập nhật) rơi về nhãn chung chứ không hiện tên kỹ thuật.
 */
const EVENT_KEY: Record<string, string> = {
  'user.password.changed': 'securityEvents.passwordChanged',
  'user.password.reset': 'securityEvents.passwordReset',
  'admin.user.password.reset': 'securityEvents.passwordResetBySupport',
  'admin.user.deactivated': 'securityEvents.accountLocked',
  'admin.user.reactivated': 'securityEvents.accountUnlocked',
  'support_session.started': 'securityEvents.supportSessionStarted',
  'support_session.ended': 'securityEvents.supportSessionEnded',
  'user.mfa.enabled': 'securityEvents.mfaEnabled',
  'user.mfa.recovery_used': 'securityEvents.mfaRecoveryUsed',
  'admin.user.mfa.reset': 'securityEvents.mfaResetBySupport',
}

/**
 * "Hoạt động bảo mật" trên tab Bảo mật của /v2/profile (đợt 2 admin, 09/11/2026): đổi/đặt lại mật
 * khẩu, bị khoá/mở khoá… Chỉ loại + thời điểm — backend không trả người thao tác hay lý do.
 */
export function SecurityActivity() {
  const t = useTranslations('v2.account.profile')
  const tn = useTranslations('v2.notif')
  const locale = useLocale()
  const [items, setItems] = useState<SecurityEventItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError(false)
    try {
      const res = await getSecurityEvents(nextPage, PAGE_SIZE)
      setItems((prev) => (nextPage === 0 ? res.items : [...prev, ...res.items]))
      setTotal(res.total)
      setPage(nextPage)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(0)
  }, [load])

  return (
    <section className="max-w-md border-t border-ga-line pt-6" data-testid="security-activity">
      <h3 className="ga-ui text-ga-body font-semibold text-ga-ink">{t('securityActivityTitle')}</h3>
      <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('securityActivityDesc')}</p>

      {error && (
        <p role="alert" className="ga-ui mt-3 text-ga-small text-ga-red">
          {t('securityActivityError')}
        </p>
      )}

      {!error && !loading && items.length === 0 && (
        <p className="ga-ui mt-3 text-ga-small text-ga-subtle">{t('securityActivityEmpty')}</p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-ga-line border-y border-ga-line">
          {items.map((it, i) => (
            <li key={`${it.event}-${it.occurredAt}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
              <span className="ga-ui min-w-0 text-ga-small text-ga-ink">
                {t(EVENT_KEY[it.event] ?? 'securityEvents.other')}
              </span>
              <time
                dateTime={it.occurredAt}
                title={new Date(it.occurredAt).toLocaleString(locale)}
                className="ga-ui shrink-0 text-ga-caption text-ga-subtle"
              >
                {relTime(it.occurredAt, tn, locale)}
              </time>
            </li>
          ))}
        </ul>
      )}

      {items.length < total && (
        <GaBtn variant="ghost" className="mt-3" disabled={loading} onClick={() => void load(page + 1)}>
          {t('securityActivityMore')}
        </GaBtn>
      )}
    </section>
  )
}
