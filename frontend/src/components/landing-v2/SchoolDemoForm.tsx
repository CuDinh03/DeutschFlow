'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GaBtn } from '@/components/ui-v2'
import { GaInput, GaTextarea } from '@/components/ui-v2/GaInput'
import { useTracking } from '@/hooks/useTracking'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale } from '@/lib/publicLocale'
import {
  submitSchoolDemoRequest,
  type SchoolDemoChannel,
  type SchoolDemoStudentCount,
} from '@/lib/marketingApi'
import { SUPPORT_EMAIL } from './links'

/**
 * Form "Đặt lịch demo 20 phút" của trang trung tâm (đợt 3a). Gửi `POST /api/public/school-demo-requests`;
 * backend lưu rồi báo owner (chuông admin + email nếu đã cấu hình).
 *
 * Câu báo lỗi viết theo ngôn ngữ trang dựa trên mã HTTP (400/429), không in thông điệp tiếng Việt của
 * backend. Ô `website` là honeypot: ẩn khỏi người thật (và khỏi trình đọc màn hình), bot điền thì bị loại.
 */

const STUDENT_COUNTS: SchoolDemoStudentCount[] = ['LT20', 'S20_50', 'S50_200', 'GT200']
const CHANNELS: SchoolDemoChannel[] = ['EMAIL', 'ZALO', 'WHATSAPP', 'PHONE']
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[0-9][0-9\s.\-()]{6,22}$/

const SELECT_CLASS =
  'w-full min-w-0 rounded-ga-touch border border-ga-line bg-ga-card px-3.5 py-2.5 text-ga-small font-medium text-ga-ink ' +
  'min-h-11 lg:min-h-9 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ga-focus ' +
  'aria-[invalid=true]:border-ga-red'

type Status = 'idle' | 'sending' | 'done'

export function SchoolDemoForm() {
  const t = useTranslations('v2.landing.schools.form')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const { trackEvent } = useTracking()

  const [name, setName] = React.useState('')
  const [organization, setOrganization] = React.useState('')
  const [country, setCountry] = React.useState('')
  const [studentCount, setStudentCount] = React.useState<SchoolDemoStudentCount | ''>('')
  const [channel, setChannel] = React.useState<SchoolDemoChannel>('EMAIL')
  const [contact, setContact] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [website, setWebsite] = React.useState('')
  const [status, setStatus] = React.useState<Status>('idle')
  const [error, setError] = React.useState('')
  const [showInvalid, setShowInvalid] = React.useState(false)

  const isEmail = channel === 'EMAIL'
  const missing = {
    name: !name.trim(),
    organization: !organization.trim(),
    country: !country.trim(),
    studentCount: !studentCount,
    contact: !contact.trim(),
  }
  const contactBad = !missing.contact && !(isEmail ? EMAIL_RE : PHONE_RE).test(contact.trim())

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    if (Object.values(missing).some(Boolean)) {
      setShowInvalid(true)
      setError(t('errorRequired'))
      return
    }
    if (contactBad) {
      setShowInvalid(true)
      setError(t('errorContact'))
      return
    }
    setError('')
    setStatus('sending')
    try {
      await submitSchoolDemoRequest({
        name: name.trim(),
        organization: organization.trim(),
        country: country.trim(),
        studentCount: studentCount as SchoolDemoStudentCount,
        contactChannel: channel,
        contact: contact.trim(),
        message: message.trim() || undefined,
        locale,
        website,
      })
      trackEvent('lead_submit', { group: 'A', form: 'school_demo', locale, students: studentCount })
      setStatus('done')
    } catch (err) {
      const code = (err as { response?: { status?: number } } | null)?.response?.status
      setError(code === 429 ? t('errorRateLimit') : code === 400 ? t('errorContact') : t('errorGeneric', { email: SUPPORT_EMAIL }))
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div role="status" className="border border-ga-border bg-ga-bg p-5 sm:p-7">
        <p className="mb-2 text-ga-h2 text-ga-ink">{t('successTitle')}</p>
        <p className="text-ga-body text-ga-muted">{t('successBody', { channel: t(`channels.${channel}`) })}</p>
      </div>
    )
  }

  const req = <span aria-hidden className="text-ga-red"> *</span>
  const label = 'mb-1.5 block text-ga-small font-semibold text-ga-ink'
  const invalid = (bad: boolean) => showInvalid && bad

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4 border border-ga-border bg-ga-bg p-5 sm:grid-cols-2 sm:p-7">
      <div>
        <label htmlFor="sd-name" className={label}>{t('name')}{req}</label>
        <GaInput id="sd-name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} invalid={invalid(missing.name)} maxLength={160} />
      </div>
      <div>
        <label htmlFor="sd-org" className={label}>{t('organization')}{req}</label>
        <GaInput id="sd-org" autoComplete="organization" required value={organization} onChange={(e) => setOrganization(e.target.value)} invalid={invalid(missing.organization)} maxLength={200} />
      </div>
      <div>
        <label htmlFor="sd-country" className={label}>{t('country')}{req}</label>
        <GaInput id="sd-country" autoComplete="country-name" required placeholder={t('countryPlaceholder')} value={country} onChange={(e) => setCountry(e.target.value)} invalid={invalid(missing.country)} maxLength={80} />
      </div>
      <div>
        <label htmlFor="sd-students" className={label}>{t('studentCount')}{req}</label>
        <select
          id="sd-students"
          required
          value={studentCount}
          onChange={(e) => setStudentCount(e.target.value as SchoolDemoStudentCount | '')}
          aria-invalid={invalid(missing.studentCount) || undefined}
          className={SELECT_CLASS}
        >
          <option value="">{t('studentCountPick')}</option>
          {STUDENT_COUNTS.map((c) => <option key={c} value={c}>{t(`studentCounts.${c}`)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sd-channel" className={label}>{t('channel')}{req}</label>
        <select id="sd-channel" value={channel} onChange={(e) => setChannel(e.target.value as SchoolDemoChannel)} className={SELECT_CLASS}>
          {CHANNELS.map((c) => <option key={c} value={c}>{t(`channels.${c}`)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sd-contact" className={label}>{isEmail ? t('contactEmail') : t('contactPhone')}{req}</label>
        <GaInput
          id="sd-contact"
          type={isEmail ? 'email' : 'tel'}
          autoComplete={isEmail ? 'email' : 'tel'}
          inputMode={isEmail ? 'email' : 'tel'}
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          invalid={invalid(missing.contact || contactBad)}
          maxLength={255}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="sd-message" className={label}>
          {t('message')} <span className="font-normal text-ga-muted">({t('optional')})</span>
        </label>
        <GaTextarea id="sd-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
      </div>
      {/* Honeypot: nằm ngoài màn hình, không nhận tab, trình đọc màn hình bỏ qua. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="sd-website">Website</label>
        <input id="sd-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        {error && <p role="alert" className="text-ga-small font-semibold text-ga-red">{error}</p>}
        <GaBtn type="submit" variant="ink" size="lg" className="w-full sm:w-auto sm:self-start" disabled={status === 'sending'}>
          <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
          {status === 'sending' ? t('submitting') : t('submit')}
        </GaBtn>
        <p className="text-ga-caption text-ga-muted">{t('consent')}</p>
      </div>
    </form>
  )
}
