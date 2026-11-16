'use client'

/* eslint-disable @next/next/no-img-element -- ảnh xem trước là object URL cục bộ, không qua next/image */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, ImagePlus, Loader2, Send, X } from 'lucide-react'
import { GaBtn, GaGlyph } from '@/components/ui-v2'
import { apiMessage, httpStatus } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  AREAS_BY_AUDIENCE,
  CONTENT_MAX,
  CONTENT_MIN,
  FEEDBACK_TYPES,
  MAX_ATTACHMENTS,
  feedbackApi,
  type FeedbackArea,
  type FeedbackAudience,
  type FeedbackType,
  type MyFeedback,
} from '@/lib/feedbackApi'
import { collectTechInfo } from '@/lib/feedbackTechInfo'
import { TYPE_GLYPH } from './feedbackVisual'
import { prepareImage } from './feedbackImages'

interface Shot {
  key: string
  previewUrl: string
  attachmentId: number | null
  uploading: boolean
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function codePoints(s: string): number {
  return Array.from(s.trim()).length
}

/** Trang mà người dùng vừa ở trước khi mở Góp ý (cùng nguồn), không thì chính trang này. */
function sourcePage(): string {
  try {
    if (document.referrer) {
      const ref = new URL(document.referrer)
      if (ref.origin === window.location.origin) return ref.pathname
    }
  } catch {
    // referrer hỏng: rơi về trang hiện tại
  }
  return window.location.pathname
}

interface FeedbackFormProps {
  audience: FeedbackAudience
  onSent: (item: MyFeedback) => void
}

export function FeedbackForm({ audience, onSent }: FeedbackFormProps) {
  const t = useTranslations('v2.account.feedback')
  const locale = useLocale()
  const areas = AREAS_BY_AUDIENCE[audience]

  const [type, setType] = useState<FeedbackType>('IDEA')
  const [score, setScore] = useState<number | null>(null)
  const [area, setArea] = useState<FeedbackArea>(areas[0])
  const [content, setContent] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [techOn, setTechOn] = useState(false)
  const [techOpen, setTechOpen] = useState(false)
  const [allowContact, setAllowContact] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const requestId = useRef(newRequestId())
  const fileInput = useRef<HTMLInputElement>(null)
  const shotsRef = useRef(shots)
  shotsRef.current = shots

  useEffect(() => setArea((a) => (areas.includes(a) ? a : areas[0])), [areas])
  // Thu hồi object URL khi rời trang.
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)), [])

  const tech = useMemo(
    () => (typeof window === 'undefined'
      ? null
      : collectTechInfo(sourcePage(), locale, navigator.userAgent, window.innerWidth, window.innerHeight)),
    [locale],
  )

  const length = codePoints(content)
  const uploading = shots.some((s) => s.uploading)
  const canSend = length >= CONTENT_MIN && length <= CONTENT_MAX && !uploading && !sending

  const pickType = (next: FeedbackType) => {
    setType(next)
    setTechOn(next === 'BUG') // FBK-07: mặc định bật với Báo lỗi
  }

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setImageError(null)
    const room = MAX_ATTACHMENTS - shotsRef.current.length
    if (files.length > room) setImageError(t('imageTooMany'))
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const prepared = await prepareImage(file)
      if ('error' in prepared) {
        setImageError(t('imageWrong'))
        continue
      }
      const key = newRequestId()
      const previewUrl = URL.createObjectURL(prepared.blob)
      setShots((prev) => [...prev, { key, previewUrl, attachmentId: null, uploading: true }])
      try {
        const res = await feedbackApi.upload(prepared.blob, prepared.name)
        setShots((prev) => prev.map((s) => (s.key === key ? { ...s, attachmentId: res.data.id, uploading: false } : s)))
      } catch (e) {
        URL.revokeObjectURL(previewUrl)
        setShots((prev) => prev.filter((s) => s.key !== key))
        setImageError(httpStatus(e) === 400 ? t('imageWrong') : t('imageFailed'))
      }
    }
  }

  const removeShot = (shot: Shot) => {
    URL.revokeObjectURL(shot.previewUrl)
    setShots((prev) => prev.filter((s) => s.key !== shot.key))
    if (shot.attachmentId != null) void feedbackApi.removeAttachment(shot.attachmentId).catch(() => undefined)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    setSendError(null)
    try {
      const res = await feedbackApi.submit({
        type,
        area,
        satisfaction: score,
        content: content.trim(),
        allowContact,
        techInfo: techOn ? tech : null,
        attachmentIds: shots.flatMap((s) => (s.attachmentId == null ? [] : [s.attachmentId])),
        clientRequestId: requestId.current,
      })
      shots.forEach((s) => URL.revokeObjectURL(s.previewUrl))
      setShots([])
      setContent('')
      setScore(null)
      setAllowContact(false)
      requestId.current = newRequestId()
      setSent(true)
      onSent(res.data)
    } catch (err) {
      // Giữ nguyên nội dung đang gõ; gửi lại dùng cùng clientRequestId nên không tạo bản trùng.
      setSendError(httpStatus(err) === 429 ? apiMessage(err) : t('sendFailed'))
    } finally {
      setSending(false)
    }
  }

  const label = 'mb-2 block text-ga-small font-semibold text-ga-ink'

  return (
    <form onSubmit={submit} noValidate className="rounded-ga border border-ga-line bg-ga-card p-5 lg:p-6">
      {sent && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-ga border border-ga-green bg-ga-green-soft px-4 py-3">
          <GaGlyph icon={Check} tone="green" size="sm" />
          <div>
            <p className="text-ga-small font-semibold text-ga-ink">{t('sentTitle')}</p>
            <p className="text-ga-caption text-ga-muted">{t('sentBody')}</p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className={label}>{t('typeLabel')}</legend>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {FEEDBACK_TYPES.map((value) => {
            const on = type === value
            const glyph = TYPE_GLYPH[value]
            return (
              <label
                key={value}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-2 rounded-ga-touch border bg-ga-card p-3 transition-shadow hover:shadow-ga-card-hover',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ga-focus',
                  on ? 'border-ga-ink ring-1 ring-inset ring-ga-ink' : 'border-ga-line-strong',
                )}
              >
                <input type="radio" name="fb-type" value={value} checked={on} onChange={() => pickType(value)} className="sr-only" />
                <GaGlyph icon={glyph.icon} tone={on ? 'ink' : glyph.tone} size="sm" />
                <span className="text-ga-small font-semibold text-ga-ink">{t(`types.${value}`)}</span>
                <span className="text-ga-caption leading-snug text-ga-muted">{t(`typeHints.${value}`)}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className={label}>
          {t('scaleLabel')} <span className="ml-1.5 font-normal text-ga-muted">{t('optional')}</span>
        </legend>
        <div className="grid grid-cols-5 overflow-hidden rounded-ga-touch border border-ga-line-strong">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = score === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                aria-label={`${n} · ${t(`scale.${n}`)}`}
                onClick={() => setScore(on ? null : n)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 border-r border-ga-line px-1 py-2 last:border-r-0',
                  'focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus',
                  on ? 'bg-ga-yellow' : 'bg-ga-card hover:bg-ga-surface',
                )}
              >
                <span className="text-ga-body font-bold text-ga-ink">{n}</span>
                <span className={cn('text-center text-ga-caption leading-tight', on ? 'text-ga-ink' : 'text-ga-muted')}>
                  {t(`scale.${n}`)}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className={label}>{t('areaLabel')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {areas.map((value) => (
            <label
              key={value}
              className={cn(
                'relative cursor-pointer rounded-ga-pill border px-3 py-1.5 text-ga-caption transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ga-focus',
                area === value ? 'border-ga-ink bg-ga-ink text-ga-card' : 'border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-surface',
              )}
            >
              <input type="radio" name="fb-area" value={value} checked={area === value} onChange={() => setArea(value)} className="sr-only" />
              {t(`areas.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="fb-content" className={label}>{t(`contentLabel.${type}`)}</label>
        <textarea
          id="fb-content"
          value={content}
          onChange={(e) => { setContent(e.target.value); setSent(false) }}
          maxLength={CONTENT_MAX + 50}
          rows={5}
          placeholder={t(`contentHint.${type}`)}
          aria-describedby="fb-content-count"
          className="w-full resize-y rounded-ga-touch border border-ga-line-strong bg-ga-card px-3 py-2.5 text-ga-body leading-relaxed text-ga-ink placeholder:text-ga-subtle focus:border-ga-focus focus:outline-none focus:ring-2 focus:ring-ga-focus"
        />
        <p id="fb-content-count" aria-live="polite" className="mt-1.5 flex text-ga-caption text-ga-muted">
          <span className="ml-auto tabular-nums">{t('counter', { n: length, max: CONTENT_MAX })}</span>
        </p>
      </div>

      <div className="mt-6">
        <p className={label}>
          {t('imagesLabel')} <span className="ml-1.5 font-normal text-ga-muted">{t('imagesHint')}</span>
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files) }}
          className="flex flex-wrap items-center gap-3 rounded-ga-touch border border-dashed border-ga-line-strong bg-ga-bg p-3"
        >
          {shots.map((shot) => (
            <div key={shot.key} className="relative h-14 w-20 overflow-hidden rounded-ga border border-ga-line bg-ga-card">
              <img src={shot.previewUrl} alt="" className="h-full w-full object-cover" />
              {shot.uploading ? (
                <span className="absolute inset-0 grid place-items-center bg-ga-card/70" aria-label={t('imageUploading')}>
                  <Loader2 size={16} className="ga-spin text-ga-ink" aria-hidden />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeShot(shot)}
                  aria-label={t('imageRemove')}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-ga-pill bg-ga-ink text-ga-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                >
                  <X size={13} aria-hidden />
                </button>
              )}
            </div>
          ))}
          {shots.length < MAX_ATTACHMENTS && (
            <div className="flex items-center gap-3 text-ga-caption text-ga-muted">
              <GaGlyph icon={ImagePlus} tone="plain" size="sm" />
              <span>
                {t('imagesDrop')}{' '}
                <button type="button" onClick={() => fileInput.current?.click()} className="font-semibold text-ga-navy underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
                  {t('imagesPick')}
                </button>
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }}
              />
            </div>
          )}
        </div>
        {imageError && <p role="alert" className="mt-1.5 text-ga-caption text-ga-red">{imageError}</p>}
      </div>

      <div className="my-6 h-px bg-ga-line" />

      <label className="flex cursor-pointer items-start gap-2.5 text-ga-small text-ga-ink">
        <input type="checkbox" checked={techOn} onChange={(e) => setTechOn(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ga-ink" />
        <span>
          {t('techLabel')}
          <span className="block text-ga-caption text-ga-muted">{t('techHint')}</span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => setTechOpen((v) => !v)}
        aria-expanded={techOpen}
        className="ml-[26px] mt-1 text-ga-caption font-semibold text-ga-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        {techOpen ? t('techHide') : t('techShow')}
      </button>
      {techOpen && tech && (
        <dl className="ml-[26px] mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-ga border border-ga-line bg-ga-bg px-3 py-2.5 font-mono text-ga-caption text-ga-muted">
          {(['page', 'browser', 'os', 'device', 'locale', 'screen'] as const).map((k) => (
            <div key={k} className="contents">
              <dt>{t(`techFields.${k}`)}</dt>
              <dd className="break-all text-ga-ink">{k === 'device' && tech.device ? t(`devices.${tech.device}`) : tech[k]}</dd>
            </div>
          ))}
        </dl>
      )}

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-ga-small text-ga-ink">
        <input type="checkbox" checked={allowContact} onChange={(e) => setAllowContact(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ga-ink" />
        <span>
          {t('contactLabel')}
          <span className="block text-ga-caption text-ga-muted">{t('contactHint')}</span>
        </span>
      </label>

      {sendError && <p role="alert" className="mt-5 text-ga-small text-ga-red">{sendError}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3.5">
        <GaBtn type="submit" size="lg" disabled={!canSend} loading={sending}>
          <Send size={16} aria-hidden />
          {t('submit')}
        </GaBtn>
        <span className="text-ga-caption text-ga-muted">{length < CONTENT_MIN ? t('needMore') : t('readyHint')}</span>
      </div>
    </form>
  )
}
