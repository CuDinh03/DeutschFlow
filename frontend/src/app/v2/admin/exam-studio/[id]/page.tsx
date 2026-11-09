'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getDraft, type StudioDraft } from '@/lib/adminExamStudioApi'
import { WIZARD_STEPS, maxReachableStep, stepIndex } from '@/lib/examStudioLogic'
import { ErrorBanner, GaPageHdr, LoadingState, TkBadge } from '@/components/ui-v2'
import { StudioStepper } from '@/components/admin/exam-studio/StudioStepper'
import { StepFrame } from '@/components/admin/exam-studio/StepFrame'
import { StepSource } from '@/components/admin/exam-studio/StepSource'
import { StepText } from '@/components/admin/exam-studio/StepText'
import { StepItems } from '@/components/admin/exam-studio/StepItems'
import { StepReview } from '@/components/admin/exam-studio/StepReview'
import { BusyBanner, LastErrorBanner } from '@/components/admin/exam-studio/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Xưởng đề — trình hướng dẫn 5 bước cho một bản nháp Teil.
// Mọi thao tác AI chạy nền: khi draft.busyOp != null, hỏi lại getDraft mỗi 2 s và khoá thao tác sửa.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 2000

export default function AdminExamStudioDraftPage() {
  const t = useTranslations('v2.adminContent.examStudio')
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  const [draft, setDraft] = useState<StudioDraft | null>(null)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState(false)
  const [view, setView] = useState<number | null>(null)
  const pollFails = useRef(0)

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) { setLoadError(t('wizard.badId')); return }
    try {
      const d = await getDraft(id)
      setDraft(d)
      setLoadError('')
      setView((v) => v ?? stepIndex(d.step))
    } catch (e: unknown) {
      setLoadError(apiMessage(e))
    }
  }, [id, t])
  useEffect(() => { void load() }, [load])

  // Hỏi lại khi có job nền. Lỗi mạng tạm thời thì bỏ qua vài lần rồi mới báo.
  const busy = draft?.busyOp ?? null
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(async () => {
      try {
        const d = await getDraft(id)
        pollFails.current = 0
        setDraft(d)
      } catch (e: unknown) {
        pollFails.current += 1
        if (pollFails.current === 3) toast.error(apiMessage(e))
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [busy, id])

  const run = useCallback(async (fn: () => Promise<StudioDraft>, okMessage?: string) => {
    setPending(true)
    try {
      const d = await fn()
      setDraft(d)
      if (okMessage) toast.success(okMessage)
      return true
    } catch (e: unknown) {
      toast.error(apiMessage(e))
      return false
    } finally {
      setPending(false)
    }
  }, [])

  if (loadError && !draft) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} />
        <div className="px-4 py-6 sm:px-6 lg:px-10">
          <ErrorBanner variant="page" title={t('wizard.loadError')} message={loadError} onRetry={load} />
        </div>
      </div>
    )
  }
  if (!draft || view == null) {
    return <LoadingState label={t('loading')} />
  }

  const readOnly = draft.status !== 'DRAFT'
  const locked = busy != null || pending || readOnly
  const maxReach = maxReachableStep(draft)
  const done = draft.status === 'APPROVED' ? WIZARD_STEPS.length : stepIndex(draft.step)
  const current = Math.min(view, maxReach)
  const goNext = () => setView(Math.min(current + 1, WIZARD_STEPS.length - 1))
  const stepProps = { draft, locked, run }
  const title = draft.text?.titleDe || t('wizard.untitled', { id: draft.id })

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={title}
        subtitle={`telc · ${draft.cefrLevel} · ${t.has(`section.${draft.section}`) ? t(`section.${draft.section}`) : draft.section} · Teil ${draft.teil}${draft.theme ? ` · ${draft.theme}` : ''} · ${t(`mode.${draft.mode}`)}`}
        right={<TkBadge tone={draft.status === 'APPROVED' ? 'green' : draft.status === 'DISCARDED' ? 'neutral' : 'yellow'}>{t(`status.${draft.status}`)}</TkBadge>}
      />

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/v2/admin/exam-studio"
          className="ga-ui inline-flex w-fit items-center gap-1 text-ga-small font-semibold text-ga-muted hover:text-ga-accent">
          <ArrowLeft size={14} aria-hidden /> {t('wizard.back')}
        </Link>
        <StudioStepper current={current} maxReachable={maxReach} done={done} onSelect={setView} />

        {busy && <BusyBanner op={busy} />}
        {draft.lastError && !busy && <LastErrorBanner message={draft.lastError} />}
        {draft.status === 'DISCARDED' && (
          <p className="ga-ui rounded-ga bg-ga-side-active px-4 py-3 text-ga-small text-ga-muted">{t('wizard.discarded')}</p>
        )}

        {current === 0 && <StepFrame {...stepProps} onNext={goNext} canNext={maxReach >= 1} />}
        {current === 1 && <StepSource {...stepProps} onNext={goNext} />}
        {current === 2 && <StepText {...stepProps} onNext={goNext} />}
        {current === 3 && <StepItems {...stepProps} onNext={goNext} />}
        {current === 4 && <StepReview {...stepProps} />}
      </div>
    </div>
  )
}
