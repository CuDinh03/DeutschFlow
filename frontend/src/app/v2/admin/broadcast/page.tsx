'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { cn } from '@/lib/utils'

// Visual category (preview colour + badge). Purely cosmetic — the backend notification type comes
// from the TPL picker below (BroadcastNotificationRequest.type).
// `descKey` → t('cat.<descKey>'); the id (INFO/ACTION/BROADCAST) is also the badge label.
const CAT: Record<string, { color: string; descKey: 'info' | 'action' | 'broadcast' }> = {
  INFO: { color: '#2F6FC9', descKey: 'info' },
  ACTION: { color: '#E07B39', descKey: 'action' },
  BROADCAST: { color: '#7C56C8', descKey: 'broadcast' },
}

// Mẫu nội dung → NotificationType gửi lên backend (`type`) + tiêu đề/nội dung điền sẵn.
// `type` phải là hằng của NotificationType (BE), nhiều mẫu có thể dùng chung một type — nên id mẫu
// mới là khoá, KHÔNG dùng type làm khoá (v1 dùng type → 2 mẫu ADMIN_BROADCAST trùng key, bấm mẫu
// này sáng cả mẫu kia).
const TPL: { id: string; type: string; icon: string }[] = [
  { id: 'system', type: 'ADMIN_BROADCAST', icon: '📣' },
  { id: 'feature', type: 'ADMIN_BROADCAST', icon: '✨' },
  { id: 'review', type: 'REVIEW_DUE', icon: '📚' },
  { id: 'streak', type: 'STREAK_REMINDER', icon: '🔥' },
]

// audience id → labelKey + backend audienceType/tier/role (BroadcastNotificationRequest).
// `single` (SINGLE_USER) lấy thêm targetEmail từ ô nhập bên dưới.
const AUDIENCE: {
  id: string
  labelKey: 'all' | 'student' | 'teacher' | 'free' | 'pro' | 'premium' | 'single'
  payload: Record<string, string>
}[] = [
  { id: 'all', labelKey: 'all', payload: { audienceType: 'ALL' } },
  { id: 'student', labelKey: 'student', payload: { audienceType: 'ROLE', role: 'STUDENT' } },
  { id: 'teacher', labelKey: 'teacher', payload: { audienceType: 'ROLE', role: 'TEACHER' } },
  { id: 'free', labelKey: 'free', payload: { audienceType: 'TIER', tier: 'FREE' } },
  { id: 'pro', labelKey: 'pro', payload: { audienceType: 'TIER', tier: 'PRO' } },
  { id: 'premium', labelKey: 'premium', payload: { audienceType: 'TIER', tier: 'PREMIUM' } },
  { id: 'single', labelKey: 'single', payload: { audienceType: 'SINGLE_USER' } },
]

interface SentItem {
  title: string
  audienceLabel: string
  when: string
  cat: string
  scheduled: boolean
}

export default function V2AdminBroadcastPage() {
  const t = useTranslations('v2.adminOps.broadcast')
  const [cat, setCat] = useState('BROADCAST')
  const [tpl, setTpl] = useState(TPL[0])
  const [aud, setAud] = useState('all')
  const [email, setEmail] = useState('')
  const [when, setWhen] = useState<'now' | 'schedule'>('now')
  const [at, setAt] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<SentItem[]>([])

  const audience = AUDIENCE.find((a) => a.id === aud) ?? AUDIENCE[0]
  const isSingle = audience.id === 'single'
  const audienceLabel = isSingle
    ? `${t('audience.single')}${email.trim() ? ` · ${email.trim()}` : ''}`
    : t(`audience.${audience.labelKey}`)

  // Chọn mẫu → điền sẵn tiêu đề/nội dung (giống v1). Mẫu không có nội dung mặc định thì để trống
  // cho admin tự viết.
  const pickTpl = (next: (typeof TPL)[number]) => {
    setTpl(next)
    setTitle(t(`tpl.${next.id}.title`))
    setBody(t.has(`tpl.${next.id}.body`) ? t(`tpl.${next.id}.body`) : '')
  }

  const send = async () => {
    if (!title.trim()) {
      toast(t('enterTitle'))
      return
    }
    // BE validate @NotBlank cả title lẫn payload.body → gửi body rỗng sẽ 400, chặn sớm ở đây.
    if (!body.trim()) {
      toast(t('enterBody'))
      return
    }
    if (isSingle && !email.trim()) {
      toast(t('enterEmail'))
      return
    }
    const scheduled = when === 'schedule'
    setSending(true)
    try {
      await api.post('/admin/notifications/broadcast', {
        type: tpl.type,
        ...audience.payload,
        ...(isSingle ? { targetEmail: email.trim() } : {}),
        payload: { title: title.trim(), body: body.trim() },
        scheduledAt: scheduled && at ? new Date(at).toISOString() : undefined,
      })
      setSent((s) => [
        {
          title: title.trim(),
          audienceLabel,
          when: scheduled ? t('scheduledAt', { time: at || '…' }) : t('justNow'),
          cat,
          scheduled,
        },
        ...s,
      ])
      toast.success(scheduled ? t('queuedSchedule') : t('sentTo', { audience: audienceLabel }))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSending(false)
    }
  }

  const catColor = CAT[cat].color

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="grid flex-1 lg:grid-cols-[1fr_360px] lg:overflow-hidden">
        {/* Compose */}
        <div className="border-b border-ga-line px-4 py-5 sm:px-6 lg:overflow-auto lg:border-b-0 lg:border-r lg:px-9 lg:py-[26px]">
          <GaCap className="mb-2.5 block">{t('categoryLabel')}</GaCap>
          <div className="mb-[22px] flex flex-col gap-2 sm:flex-row">
            {Object.entries(CAT).map(([id, m]) => {
              const on = cat === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCat(id)}
                  className="flex-1 rounded-ga border px-3 py-[11px] text-left transition-colors"
                  style={{
                    background: on ? `${m.color}1f` : 'var(--ga-card)',
                    borderColor: on ? m.color : 'var(--ga-line)',
                    borderTopWidth: 3,
                    borderTopColor: on ? m.color : 'var(--ga-line)',
                  }}
                >
                  <div
                    className="text-[11px] font-bold tracking-[0.06em]"
                    style={{ color: on ? m.color : 'var(--ga-muted)' }}
                  >
                    {id}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ga-muted">{t(`cat.${m.descKey}`)}</div>
                </button>
              )
            })}
          </div>

          <GaCap className="mb-2.5 block">{t('typeLabel')}</GaCap>
          <div className="mb-[22px] grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TPL.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickTpl(m)}
                className={cn(
                  'flex min-h-[40px] items-center gap-2 rounded-ga border px-[14px] py-2.5 text-left text-[12.5px] font-semibold transition-colors lg:min-h-0',
                  tpl.id === m.id
                    ? 'border-ga-ink bg-ga-ink text-ga-card'
                    : 'border-ga-line bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink',
                )}
              >
                <span aria-hidden className="text-[15px]">{m.icon}</span>
                <span className="truncate">{t(`tpl.${m.id}.label`)}</span>
              </button>
            ))}
          </div>

          <GaCap className="mb-2.5 block">
            {t('audienceLabelPre')}<span className="text-ga-ink">{audienceLabel}</span>
          </GaCap>
          <div className="mb-[22px] flex flex-wrap gap-2">
            {AUDIENCE.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAud(a.id)}
                className={cn(
                  'min-h-[40px] rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0',
                  aud === a.id
                    ? 'border-ga-ink bg-ga-ink text-ga-card'
                    : 'border-ga-line bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink',
                )}
              >
                {t(`audience.${a.labelKey}`)}
              </button>
            ))}
          </div>

          {isSingle && (
            <>
              <GaCap className="mb-2 block">{t('emailLabel')}</GaCap>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="mb-[22px] block w-full rounded-ga border border-ga-line bg-ga-bg px-[15px] py-3 text-[14.5px] text-ga-ink outline-none"
              />
            </>
          )}

          <GaCap className="mb-2 block">{t('titleLabel')}</GaCap>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="mb-[18px] block w-full rounded-ga border border-ga-line bg-ga-bg px-[15px] py-3 text-[15px] font-semibold text-ga-ink outline-none"
          />
          <GaCap className="mb-2 block">{t('bodyLabel')}</GaCap>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t('bodyPlaceholder')}
            className="mb-[18px] block w-full resize-y rounded-ga border border-ga-line bg-ga-bg px-[15px] py-3 text-[14.5px] leading-[1.65] text-ga-ink outline-none"
          />

          <GaCap className="mb-2.5 block">{t('sendTimeLabel')}</GaCap>
          <div className="mb-[22px] flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full border border-ga-line sm:w-auto">
              {(['now', 'schedule'] as const).map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWhen(id)}
                  className={cn(
                    'min-h-[40px] flex-1 px-4 py-2.5 text-[12.5px] font-semibold transition-colors sm:flex-initial lg:min-h-0',
                    i && 'border-l border-ga-line',
                    when === id ? 'bg-ga-ink text-ga-card' : 'bg-transparent text-ga-muted',
                  )}
                >
                  {id === 'now' ? t('sendNow') : t('schedule')}
                </button>
              ))}
            </div>
            {when === 'schedule' && (
              <input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
                className="w-full min-w-0 flex-1 rounded-ga border border-ga-line bg-ga-bg px-[13px] py-2.5 text-[14px] text-ga-ink outline-none"
              />
            )}
          </div>

          <GaBtn variant="yellow" disabled={sending} onClick={send}>
            <span aria-hidden className="inline-block h-[7px] w-[7px] bg-ga-ink" />
            {sending ? t('sending') : when === 'schedule' ? t('scheduleSend') : t('sendNow')}
          </GaBtn>
        </div>

        {/* Preview + history */}
        <div className="bg-ga-card px-4 py-5 lg:overflow-auto lg:px-6 lg:py-[26px]">
          <GaCap className="mb-3.5 block">{t('preview')}</GaCap>
          <div
            className="flex gap-3.5 border border-ga-line px-4 py-4 lg:px-[18px]"
            style={{ background: `${catColor}10`, borderLeft: `3px solid ${catColor}` }}
          >
            <Megaphone size={22} aria-hidden style={{ color: catColor, flexShrink: 0 }} />
            <div className="min-w-0">
              <div
                className="mb-1.5 inline-flex border bg-white px-1.5 py-[3px] text-[9px] font-bold tracking-[0.06em]"
                style={{ color: catColor, borderColor: `${catColor}55` }}
              >
                {cat}
              </div>
              <div className="text-[14.5px] font-bold text-ga-ink" style={{ overflowWrap: 'anywhere' }}>
                {title || t('previewTitle')}
              </div>
              <div className="mt-1 text-[13px] leading-[1.5] text-ga-muted" style={{ overflowWrap: 'anywhere' }}>
                {body || t('previewBody')}
              </div>
              <div className="mt-2 text-[11.5px] text-ga-subtle">
                {when === 'schedule' ? t('scheduledPreview', { time: at || t('noTimeChosen') }) : t('previewJustNow')} · {audienceLabel}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <GaCap className="mb-3 block">{t('sentAndScheduled')}</GaCap>
            {sent.length === 0 ? (
              <p className="text-[12.5px] text-ga-muted">{t('sentEmpty')}</p>
            ) : (
              sent.map((r, i) => (
                <div
                  key={i}
                  className={cn('flex items-start gap-2.5 py-[11px]', i && 'border-t border-ga-line')}
                >
                  <span
                    aria-hidden
                    className="mt-[5px] h-[7px] w-[7px] shrink-0"
                    style={{ background: CAT[r.cat].color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ga-ink" style={{ overflowWrap: 'anywhere' }}>
                      {r.title}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ga-muted">
                      {r.audienceLabel} · {r.when}
                    </div>
                  </div>
                  {r.scheduled && (
                    <span
                      className="shrink-0 px-1.5 py-[3px] text-[9px] font-bold"
                      style={{ color: 'var(--ga-gold)', background: 'var(--ga-yellow-soft)' }}
                    >
                      {t('scheduledBadge')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
