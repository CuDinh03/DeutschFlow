'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { apiMessage } from '@/lib/api'
import { loadSeenTours, markTourSeen } from '@/lib/uiToursApi'
import { oralSessionHref, parseOralEntry, type ParsedOralEntry } from '@/lib/exam/oralRoutes'
import { useMicPermission } from '@/hooks/useMicPermission'
import type { BlueprintSummary } from '@/types/exam-speaking'
import { ErrorBanner, LoadingState, useImmersiveChrome } from '@/components/ui-v2'
import { OralMicCheckScreen } from '@/components/features/exam-speaking/OralMicCheckScreen'

/** Khoá "đã qua màn Kiểm tra micro" theo tài khoản (dùng kho hướng dẫn đã xem). */
const MIC_CHECKED_KEY = 'exam.oralMicCheck'
/** Chờ Permissions API trả lời trước khi quyết định có cần màn kiểm tra không. */
const PERMISSION_WAIT_MS = 400

type Stage = 'loading' | 'check' | 'creating' | 'error'

/**
 * Lối vào phòng thi nói (Đợt 2): đọc hệ/cấp/kiểu lượt từ `?provider&level&mode&teil&prepMode&return`.
 * Thi thử: lần đầu, hoặc khi micro chưa được cho phép, qua màn Kiểm tra micro rồi mới tạo phiên.
 * Luyện từng Teil: tạo phiên ngay (luyện cho gõ thay nói nên không chặn vì micro).
 */
export default function OralEntryPage() {
  const t = useTranslations('v2.student.examSpeaking.entry')
  const router = useRouter()
  const micPermission = useMicPermission()
  const [entry, setEntry] = useState<ParsedOralEntry | null>(null)
  const [blueprint, setBlueprint] = useState<BlueprintSummary | null>(null)
  const [seen, setSeen] = useState<boolean | null>(null)
  const [permReady, setPermReady] = useState(false)
  const [stage, setStage] = useState<Stage>('loading')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  useImmersiveChrome()

  useEffect(() => {
    setEntry(parseOralEntry(new URLSearchParams(window.location.search)))
    let alive = true
    void loadSeenTours().then((s) => alive && setSeen(s.has(MIC_CHECKED_KEY)))
    const id = window.setTimeout(() => setPermReady(true), PERMISSION_WAIT_MS)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    if (!entry) return
    let alive = true
    examSpeakingApi
      .listBlueprints({ provider: entry.provider, level: entry.level })
      .then((r) => alive && setBlueprint(r.data[0] ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [entry])

  const create = useCallback(async () => {
    if (!entry || startedRef.current) return
    startedRef.current = true
    setStage('creating')
    setError(null)
    try {
      const { data } = await examSpeakingApi.createSession({
        provider: entry.provider,
        level: entry.level,
        mode: entry.mode,
        teil: entry.teil ?? undefined,
        prepMode: entry.prepMode ?? undefined,
      })
      router.replace(oralSessionHref(data.id, entry.ret))
    } catch (e) {
      startedRef.current = false
      setError(apiMessage(e))
      setStage('error')
    }
  }, [entry, router])

  useEffect(() => {
    if (stage !== 'loading' || !entry || seen === null) return
    if (micPermission === 'unknown' && !permReady) return
    const needCheck = entry.mode === 'MOCK' && !(micPermission === 'granted' && seen)
    if (needCheck) setStage('check')
    else void create()
  }, [stage, entry, seen, micPermission, permReady, create])

  const go = () => {
    void markTourSeen(MIC_CHECKED_KEY)
    void create()
  }

  const providerName = entry?.provider === 'GOETHE' ? 'Goethe' : 'telc'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg" data-testid="oral-entry">
      <header className="shrink-0 border-b border-ga-line bg-ga-card">
        <div className="flex min-h-14 items-center gap-2 px-2 py-1.5 lg:gap-3 lg:px-4">
          <Link
            href={entry?.ret ?? '/v2/student/exam'}
            aria-label={t('exit')}
            title={t('exit')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            data-testid="oral-entry-exit"
          >
            <X size={18} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="ga-ui truncate text-ga-caption text-ga-muted">
              <span lang="de">Mündliche Prüfung</span>
              {entry && (
                <>
                  {' '}
                  · {providerName} {entry.level} · {entry.mode === 'MOCK' ? t('modeMock') : t('modeDrill', { n: entry.teil ?? 1 })}
                </>
              )}
            </p>
            {blueprint && (
              <p lang="de" className="truncate font-ga-display text-ga-h3 text-ga-ink">
                {blueprint.title}
              </p>
            )}
          </div>
        </div>
      </header>
      <main className="ga-autoscroll min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {stage === 'check' && <OralMicCheckScreen hasPrep={(blueprint?.prepSec ?? 0) > 0} busy={false} onGo={go} />}
        {(stage === 'loading' || stage === 'creating') && <LoadingState label={stage === 'creating' ? t('creating') : t('loading')} />}
        {stage === 'error' && (
          <div className="mx-auto max-w-md" data-testid="oral-entry-error">
            <ErrorBanner variant="page" message={error ?? t('createFailed')} onRetry={() => void create()} retryLabel={t('retryCreate')} />
          </div>
        )}
      </main>
    </div>
  )
}
