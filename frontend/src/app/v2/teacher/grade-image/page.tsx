'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, ScanText, Sparkles, X, Copy, RefreshCw, Loader2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { gradeHandwritingImage, type GradeImageResult } from '@/lib/teacherGradingApi'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Chấm bài qua ảnh (GaGradeImage) — violet, upload · result.
// POST /v2/teacher/grading/grade-image (multipart: file [, topic]) → { transcription, score,
//   feedback } (Gemini OCR + AI grade). Score is 0–100 (platform-wide). 10MB cap.
//
// SCOPE: this is the tool for a photo that never came through the app — a teacher's own scan, a
//   sheet handed in on paper. It is stateless on purpose: nothing to save it against.
//   When the STUDENT submitted a photo, do NOT send the teacher here. The grading screen
//   (/v2/teacher/grading) now OCR-grades that submission in place via
//   POST /grading/submissions/{id}/ai-grade-image, which reads the student's file from S3 and
//   stores the result on the submission as an AI_GRADED proposal. Routing image submissions here
//   is what forced teachers to download the photo, re-upload it, and retype the score by hand.
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'
const MAX_BYTES = 10 * 1024 * 1024

type Phase = 'idle' | 'loading' | 'done' | 'error'
const scoreColor = (s: number) => (s >= 85 ? 'var(--ga-green)' : s >= 70 ? 'var(--ga-ink)' : 'var(--ga-red)')

export default function V2GradeImagePage() {
  const t = useTranslations('v2.teacher.gradeImage')
  const tc = useTranslations('v2.common')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<GradeImageResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [zoom, setZoom] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast.error(t('onlyImages')); return }
    if (f.size > MAX_BYTES) { toast.error(t('tooLarge')); return }
    setFile(f)
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    setResult(null)
    setPhase('idle')
    setError('')
  }

  const grade = async () => {
    if (!file) return
    setPhase('loading')
    setError('')
    try {
      const res = await gradeHandwritingImage(file, topic)
      setResult(res)
      setFeedback(res.feedback)
      setPhase('done')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setPhase('error')
    }
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:overflow-hidden">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex min-h-0 flex-1 flex-col lg:grid" style={{ gridTemplateColumns: '1fr 380px' }}>
        {/* Upload + preview */}
        <div className="border-b border-ga-line px-4 py-6 sm:px-6 lg:overflow-auto lg:border-b-0 lg:border-r lg:px-8 lg:py-7">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
              className="grid h-[240px] w-full place-items-center border-2 border-dashed text-center transition-colors lg:h-[360px]"
              style={{ borderColor: dragging ? VIOLET : 'var(--ga-line)', background: dragging ? 'var(--ga-violet-soft)' : 'var(--ga-bg)' }}
            >
              <div>
                <span className="mx-auto mb-3 grid h-14 w-14 place-items-center" style={{ background: 'var(--ga-violet-soft)' }}>
                  <Upload size={26} style={{ color: VIOLET }} />
                </span>
                <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('dropTitle')}</p>
                <p className="ga-ui mt-1.5 text-[13.5px] text-ga-muted">{t('dropDesc')}</p>
              </div>
            </button>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap">
                <div className="flex min-w-0 items-center gap-2 text-[13px] text-ga-muted">
                  <ImageIcon size={15} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-ga-subtle">· {(file.size / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setZoom((z) => !z)} className="ga-ui border border-ga-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">
                    {zoom ? t('zoomOut') : t('zoomIn')}
                  </button>
                  <button type="button" onClick={() => inputRef.current?.click()} className="ga-ui border border-ga-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">
                    {t('changeImage')}
                  </button>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={t('handwritingAlt')} className={`w-full border border-ga-line object-contain transition-[max-height] duration-300 ${zoom ? 'max-h-[760px]' : 'max-h-[300px] lg:max-h-[420px]'}`} />
              <div className="mt-4">
                <GaCap className="mb-2 block">{t('topicCap')}</GaCap>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                  className="ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
                />
              </div>
              <GaBtn variant="yellow" className="mt-4" loading={phase === 'loading'} disabled={phase === 'loading'} onClick={grade}>
                <Sparkles size={16} /> {t('gradeButton')}
              </GaBtn>
            </>
          )}
        </div>

        {/* Result */}
        <div className="bg-ga-card px-4 py-6 lg:overflow-auto lg:px-[22px] lg:py-7">
          {phase === 'loading' ? (
            <div className="grid h-full min-h-[160px] place-items-center text-center text-ga-muted lg:min-h-0">
              <div>
                <Loader2 size={28} className="mx-auto mb-3 animate-spin text-ga-accent" />
                <p className="ga-ui text-[14px]">{t('grading')}</p>
              </div>
            </div>
          ) : phase === 'error' ? (
            <div className="grid h-full min-h-[160px] place-items-center text-center lg:min-h-0">
              <div>
                <X size={32} className="mx-auto mb-3 text-ga-red" />
                <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('gradeError')}</p>
                <p className="ga-ui mx-auto mt-1.5 max-w-xs text-[13.5px] text-ga-muted">{error}</p>
                <GaBtn variant="primary" className="mt-4" onClick={grade}>{tc('retry')}</GaBtn>
              </div>
            </div>
          ) : !result ? (
            <div className="grid h-full min-h-[160px] place-items-center text-center text-ga-muted lg:min-h-0">
              <p className="ga-ui max-w-[220px] text-[14px]">{t.rich('idleHint', { b: (chunks) => <strong className="text-ga-ink">{chunks}</strong> })}</p>
            </div>
          ) : (
            <>
              {/* Score */}
              <div className="mb-5 border px-4 py-4 text-center lg:px-5" style={{ background: 'var(--ga-violet-soft)', borderColor: 'color-mix(in srgb, var(--ga-violet) 35%, transparent)' }}>
                <div className="ga-ui flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: VIOLET }}>
                  <Sparkles size={13} /> {t('aiScoreCap')}
                </div>
                <div className="mt-2 font-ga-display text-[44px] font-medium leading-none" style={{ color: scoreColor(result.score) }}>
                  {result.score}<span className="text-[20px] text-ga-muted">/100</span>
                </div>
              </div>

              {/* OCR transcription */}
              <div className="mb-4 border border-ga-line bg-ga-bg px-4 py-4 lg:px-[18px]">
                <GaCap className="mb-2 flex items-center gap-1.5"><ScanText size={13} /> {t('ocrCap')}</GaCap>
                <p className="m-0 whitespace-pre-wrap break-words font-ga-display text-[14.5px] italic leading-[1.65] text-ga-ink">{result.transcription}</p>
                <p className="ga-ui mt-2 text-[11.5px] text-ga-subtle">{t('ocrReviewHint')}</p>
              </div>

              {/* Teacher feedback (editable, prefilled from AI) */}
              <GaCap className="mb-2 block">{t('feedbackCap')}</GaCap>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                className="ga-ui mb-3.5 block w-full resize-y border border-ga-line bg-ga-bg px-3 py-2.5 text-[14px] leading-[1.6] text-ga-ink outline-none focus:border-ga-accent"
              />
              <div className="flex flex-wrap gap-2.5">
                <GaBtn variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(`${result.score}/100\n\n${feedback}`); toast.success(t('copySuccess')) }}>
                  <Copy size={14} /> {t('copy')}
                </GaBtn>
                <GaBtn variant="ghost" size="sm" onClick={() => { setFile(null); setResult(null); setPhase('idle'); setTopic(''); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl('') }}>
                  <RefreshCw size={14} /> {t('gradeAnother')}
                </GaBtn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
