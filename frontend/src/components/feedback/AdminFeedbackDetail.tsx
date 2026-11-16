'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { GaBtn, GaGlyph, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { apiMessage } from '@/lib/api'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import { adminFeedbackApi, type AdminFeedbackDetail as Detail, type FeedbackStatus } from '@/lib/feedbackApi'
import { STATUS_PILL, TYPE_GLYPH } from './feedbackVisual'

/** Trạng thái đích hợp lệ từ một trạng thái (mục 9 của đặc tả); server kiểm lại. */
const TARGETS: Record<FeedbackStatus, FeedbackStatus[]> = {
  NEW: ['READ', 'IN_PROGRESS', 'SHIPPED', 'DECLINED'],
  READ: ['READ', 'IN_PROGRESS', 'SHIPPED', 'DECLINED'],
  IN_PROGRESS: ['IN_PROGRESS', 'SHIPPED', 'DECLINED'],
  SHIPPED: ['SHIPPED', 'READ', 'IN_PROGRESS'],
  DECLINED: ['DECLINED', 'READ', 'IN_PROGRESS'],
}

const TECH_KEYS = ['page', 'browser', 'os', 'device', 'locale', 'screen'] as const

interface Props {
  id: number
  /** Báo cho danh sách khi trạng thái/số trả lời đổi. */
  onChanged: (id: number, patch: { status?: FeedbackStatus; replyCount?: number }) => void
}

export function AdminFeedbackDetail({ id, onChanged }: Props) {
  const t = useTranslations('v2.adminOps.feedback')
  const fmt = useFmt()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<FeedbackStatus>('READ')
  const [explanation, setExplanation] = useState('')
  const [tab, setTab] = useState<'reply' | 'note'>('reply')
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'status' | 'reply' | 'note' | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    setReply('')
    setExplanation('')
    adminFeedbackApi.detail(id)
      .then(async (res) => {
        if (!alive) return
        let d = res.data
        // FBK-20: mở chi tiết góp ý NEW thì đánh dấu đã đọc (POST — GET không ghi).
        if (d.status === 'NEW') {
          await adminFeedbackApi.markRead(id).catch(() => undefined)
          d = { ...d, status: 'READ' }
          onChanged(id, { status: 'READ' })
        }
        setData(d)
        setTarget(d.status)
        setNote(d.internalNote ?? '')
      })
      .catch((e) => alive && setError(apiMessage(e)))
    return () => { alive = false }
    // onChanged đổi danh tính mỗi lần render của cha; chỉ tải lại khi đổi góp ý.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <ErrorBanner message={error} />
  if (!data) return <LoadingState />

  const glyph = TYPE_GLYPH[data.type]

  const saveStatus = async () => {
    setBusy('status')
    try {
      await adminFeedbackApi.changeStatus([data.id], target, target === 'DECLINED' ? explanation.trim() : undefined)
      const fresh = (await adminFeedbackApi.detail(data.id)).data
      setData(fresh)
      setExplanation('')
      onChanged(data.id, { status: fresh.status, replyCount: fresh.replies.length })
      toast.success(t('statusSaved'))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const sendReply = async () => {
    setBusy('reply')
    try {
      const res = await adminFeedbackApi.reply(data.id, reply.trim())
      const replies = [...data.replies, res.data]
      setData({ ...data, replies })
      setReply('')
      onChanged(data.id, { replyCount: replies.length })
      toast.success(t('replySent'))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const saveNote = async () => {
    setBusy('note')
    try {
      await adminFeedbackApi.saveNote(data.id, note)
      toast.success(t('noteSaved'))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const declineLen = Array.from(explanation.trim()).length
  const statusDirty = target !== data.status
  const canSaveStatus = statusDirty && (target !== 'DECLINED' || (declineLen >= 10 && declineLen <= 1000))
  const roleLabel = t.has(`roles.${data.authorRole}`) ? t(`roles.${data.authorRole}`) : data.authorRole
  const field = 'w-full rounded-ga-touch border border-ga-line-strong bg-ga-card px-3 py-2 text-ga-small text-ga-ink focus:border-ga-focus focus:outline-none focus:ring-2 focus:ring-ga-focus'

  return (
    <article className="rounded-ga border border-ga-line bg-ga-card">
      <header className="flex items-center gap-3 border-b border-ga-line px-5 py-4">
        <GaGlyph icon={glyph.icon} tone={glyph.tone} size="md" />
        <div className="min-w-0">
          <p className="truncate text-ga-small font-semibold text-ga-ink">{data.authorName ?? '—'}</p>
          <p className="text-ga-caption text-ga-muted">
            {[roleLabel, data.authorLevel, data.authorPlan].filter(Boolean).join(' · ')}
            {data.authorSince && ` · ${t('detail.since', { date: fmt.date(data.authorSince) })}`}
          </p>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ga-caption text-ga-muted">
            <span className={cn('rounded-ga-pill px-2 py-0.5 font-semibold', STATUS_PILL[data.status])}>
              {t(`statusLong.${data.status}`)}
            </span>
            <span>{t(`types.${data.type}`)}</span>
            <span>{t(`areas.${data.area}`)}</span>
            <span>{data.satisfaction != null ? t('score', { n: data.satisfaction }) : t('noScore')}</span>
            {data.lowScore && <span className="rounded-ga-pill bg-ga-red-soft px-2 py-0.5 font-semibold text-ga-red">{t('lowScore')}</span>}
          </p>
          {/* Chữ thuần: text node (NFR-02). */}
          <p className="mt-3 whitespace-pre-line break-words text-ga-body leading-relaxed text-ga-ink">{data.content}</p>
        </div>

        <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-3 gap-y-1.5 text-ga-caption">
          <dt className="text-ga-muted">{t('detail.sent')}</dt>
          <dd className="text-ga-ink">{fmt.dateTime(data.createdAt)}</dd>
          <dt className="text-ga-muted">{t('detail.source')}</dt>
          <dd className="text-ga-ink">{t(`sources.${data.source}`)}</dd>
          {data.orgName && (<><dt className="text-ga-muted">{t('detail.org')}</dt><dd className="text-ga-ink">{data.orgName}</dd></>)}
          <dt className="text-ga-muted">{t('detail.contact')}</dt>
          <dd className="break-all text-ga-ink">{data.allowContact && data.authorEmail ? data.authorEmail : t('detail.contactNo')}</dd>
          <dt className="text-ga-muted">{t('detail.tech')}</dt>
          <dd className="text-ga-ink">
            {data.techInfo
              ? TECH_KEYS.filter((k) => data.techInfo?.[k]).map((k) => data.techInfo?.[k]).join(' · ')
              : t('detail.noTech')}
          </dd>
          <dt className="text-ga-muted">{t('detail.images')}</dt>
          <dd className="flex flex-wrap gap-2">
            {data.attachments.length === 0 && <span className="text-ga-ink">{t('detail.noImages')}</span>}
            {data.attachments.map((a, i) => (
              a.url ? (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ga-navy underline-offset-2 hover:underline"
                >
                  {t('detail.openImage', { n: i + 1 })}
                </a>
              ) : null
            ))}
          </dd>
        </dl>

        <div className="border-t border-ga-line pt-5">
          <label htmlFor="fb-status" className="mb-2 block text-ga-small font-semibold text-ga-ink">{t('statusField')}</label>
          <select
            id="fb-status"
            value={target}
            onChange={(e) => setTarget(e.target.value as FeedbackStatus)}
            className={field}
          >
            {TARGETS[data.status].map((s) => (
              <option key={s} value={s}>{t(`statusLong.${s}`)}</option>
            ))}
          </select>
          {target === 'DECLINED' && statusDirty && (
            <>
              <label htmlFor="fb-explain" className="mb-1.5 mt-3 block text-ga-caption font-semibold text-ga-ink">{t('explanation')}</label>
              <textarea id="fb-explain" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} className={field} />
              <p className="mt-1 text-ga-caption text-ga-muted">{t('explanationHint')}</p>
            </>
          )}
          {target === 'SHIPPED' && statusDirty && <p className="mt-2 text-ga-caption text-ga-muted">{t('shippedHint')}</p>}
          <GaBtn className="mt-3" variant="ghost" size="sm" disabled={!canSaveStatus} loading={busy === 'status'} onClick={saveStatus}>
            {t('saveStatus')}
          </GaBtn>
        </div>

        {data.replies.length > 0 && (
          <div>
            <p className="mb-2 text-ga-caption font-semibold text-ga-muted">{t('detail.history')}</p>
            <ol className="space-y-2">
              {data.replies.map((r) => (
                <li key={r.id} className="border-l-[3px] border-ga-navy bg-ga-surface px-3 py-2 text-ga-caption text-ga-ink">
                  <p className="mb-0.5 text-[11.5px] text-ga-muted">{fmt.dateTime(r.createdAt)}</p>
                  <p className="whitespace-pre-line break-words">{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <div role="tablist" className="mb-3 flex gap-4 border-b border-ga-line">
            {(['reply', 'note'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 py-2 text-ga-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                  tab === k ? 'border-ga-ink text-ga-ink' : 'border-transparent text-ga-muted hover:text-ga-ink',
                )}
              >
                {k === 'reply' ? <Reply size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
                {k === 'reply' ? t('tabReply') : t('tabNote')}
              </button>
            ))}
          </div>
          {tab === 'reply' ? (
            <div role="tabpanel">
              <textarea rows={3} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('replyPlaceholder')} className={field} />
              <GaBtn className="mt-2" size="sm" disabled={!reply.trim()} loading={busy === 'reply'} onClick={sendReply}>
                {t('sendReply')}
              </GaBtn>
            </div>
          ) : (
            <div role="tabpanel">
              <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} className={cn(field, 'bg-ga-yellow-soft')} />
              <GaBtn className="mt-2" variant="ghost" size="sm" loading={busy === 'note'} onClick={saveNote}>
                {t('saveNote')}
              </GaBtn>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
