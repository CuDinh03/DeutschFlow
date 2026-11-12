'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  approveSetRun, createSetRun, discardSetRun, getStudioChannel, listSetRuns, recheckSetRun,
  type SetRun, type SetRunStatus, type SetRunTeil,
} from '@/lib/adminExamStudioApi'
import { ConfirmDialog, ErrorBanner, GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { slotLabel } from './AssembliesTab'
import { studioMiniBtn } from './ui'

const ACTIVE: SetRunStatus[] = ['PLANNING', 'RUNNING']
const RUN_TONE: Record<SetRunStatus, 'blue' | 'green' | 'yellow' | 'neutral'> = {
  PLANNING: 'blue', RUNNING: 'blue', REVIEW: 'green', NEEDS_ATTENTION: 'yellow', APPROVED: 'green', DISCARDED: 'neutral',
}
const TEIL_TONE: Record<SetRunTeil['status'], 'blue' | 'green' | 'red' | 'neutral'> = {
  PENDING: 'neutral', RUNNING: 'blue', READY: 'green', STUCK: 'red',
}
const REFRESH_MS = 10_000

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * "Tạo bộ đề tự động": một nút cho một lượt chạy (telc B1), và bảng theo dõi các lượt — mỗi Teil đang ở bước nào,
 * đã tự sửa mấy vòng, có kẹt không. Mỗi Teil là một bản nháp thường, bấm vào mở trong trình 5 bước. Lượt chạy
 * dùng kênh AI đang chọn ở nút "Tạo đề bằng". Trong lúc có lượt đang chạy, bảng tự nạp lại mỗi 10 giây.
 */
export function SetRunsPanel({ active, onApproved }: { active: boolean; onApproved?: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio.setRuns')
  const [runs, setRuns] = useState<SetRun[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [discarding, setDiscarding] = useState<SetRun | null>(null)
  const [approving, setApproving] = useState<SetRun | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      setRuns(await listSetRuns())
      setError('')
    } catch (e) {
      setError(apiMessage(e))
    }
  }, [])

  useEffect(() => { if (active) void load() }, [active, load])

  const anyActive = (runs ?? []).some((r) => ACTIVE.includes(r.status))
  useEffect(() => {
    if (!active || !anyActive) return
    timer.current = setTimeout(() => void load(), REFRESH_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [active, anyActive, runs, load])

  const start = async () => {
    setBusy(true)
    try {
      await createSetRun({ examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: getStudioChannel() })
      toast.success(t('started'))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    if (!approving) return
    setBusy(true)
    try {
      await approveSetRun(approving.id)
      setApproving(null)
      toast.success(t('approved'))
      await load()
      onApproved?.()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const recheck = async (r: SetRun) => {
    setBusy(true)
    try {
      const next = await recheckSetRun(r.id)
      if (next.status === 'REVIEW') toast.success(t('recheckedReady'))
      else toast.message(t('recheckedStill'))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const discard = async () => {
    if (!discarding) return
    setBusy(true)
    try {
      await discardSetRun(discarding.id)
      setDiscarding(null)
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="set-runs-h" className="flex flex-col gap-3">
      <GaCard className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="set-runs-h" className="ga-ui text-ga-h3 text-ga-ink">{t('title')}</h2>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('body')}</p>
        </div>
        <GaBtn onClick={() => void start()} disabled={busy || anyActive}>
          <Sparkles className="h-4 w-4" aria-hidden /> {t('start')}
        </GaBtn>
        {anyActive && <p className="ga-ui basis-full text-ga-caption text-ga-muted">{t('oneAtATime')}</p>}
      </GaCard>

      {error && <ErrorBanner message={error} />}

      {(runs ?? []).filter((r) => r.status !== 'DISCARDED').map((r) => {
        const ready = r.teile.filter((x) => x.status === 'READY').length
        const redChecks = (r.setChecks ?? []).filter((c) => c.light === 'RED').length
        return (
          <GaCard key={r.id} className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="ga-ui text-ga-body font-semibold text-ga-ink">
                {t('runTitle', { id: r.id, exam: `${r.examFormat.toLowerCase()} ${r.cefrLevel}` })}
              </span>
              <TkBadge tone={RUN_TONE[r.status]}>{t(`status.${r.status}`)}</TkBadge>
              <TkBadge tone="neutral">{t('progress', { ready, total: r.teile.length })}</TkBadge>
              <span className="ga-ui min-w-0 flex-1 text-ga-caption text-ga-muted">
                {t(`channel.${r.channel === 'ROUTER' ? 'ROUTER' : 'FIREWORKS'}`)} · {fmtDate(r.createdAt)}
              </span>
              {r.status === 'REVIEW' && (
                <GaBtn size="sm" disabled={busy} onClick={() => setApproving(r)}>{t('approve')}</GaBtn>
              )}
              {r.status === 'NEEDS_ATTENTION' && (
                <GaBtn size="sm" variant="ghost" disabled={busy} onClick={() => void recheck(r)}>{t('recheck')}</GaBtn>
              )}
              {r.status !== 'APPROVED' && (
                <button type="button" className={studioMiniBtn} disabled={busy} onClick={() => setDiscarding(r)}>
                  {t('discard')}
                </button>
              )}
            </div>
            {r.note && <p className="ga-ui text-ga-caption text-ga-muted">{r.note}</p>}
            {r.status === 'NEEDS_ATTENTION' && (
              <div className="flex flex-col gap-1 rounded-ga border border-ga-line px-3 py-2">
                <GaCap>{t('gate.title')}</GaCap>
                <ul className="flex flex-col gap-1">
                  <li className="flex flex-wrap items-baseline gap-x-2">
                    <TkBadge tone={ready === r.teile.length ? 'green' : 'red'}>{t(ready === r.teile.length ? 'gate.ok' : 'gate.missing')}</TkBadge>
                    <span className="ga-ui text-ga-small text-ga-ink">{t('gate.teile', { ready, total: r.teile.length })}</span>
                  </li>
                  <li className="flex flex-wrap items-baseline gap-x-2">
                    <TkBadge tone={redChecks === 0 ? 'green' : 'red'}>{t(redChecks === 0 ? 'gate.ok' : 'gate.missing')}</TkBadge>
                    <span className="ga-ui text-ga-small text-ga-ink">{t('gate.checks', { red: redChecks })}</span>
                  </li>
                </ul>
                <p className="ga-ui text-ga-caption text-ga-muted">{t('gate.next')}</p>
              </div>
            )}
            {(r.setChecks ?? []).length > 0 && (
              <div className="flex flex-col gap-1 rounded-ga bg-ga-surface px-3 py-2">
                <GaCap>{t('setChecks')}</GaCap>
                <ul className="flex flex-col gap-1">
                  {(r.setChecks ?? []).map((c) => (
                    <li key={c.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <TkBadge tone={c.light === 'RED' ? 'red' : c.light === 'YELLOW' ? 'yellow' : 'green'}>
                        {t(`light.${c.light}`)}
                      </TkBadge>
                      <span className="ga-ui text-ga-small text-ga-ink">{c.label}</span>
                      {c.detail && <span className="ga-ui basis-full break-words text-ga-caption text-ga-muted">{c.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="flex flex-col divide-y divide-ga-line">
              {r.teile.map((x) => (
                <li key={`${x.section}-${x.teil}`} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="ga-ui w-40 shrink-0 text-ga-small font-semibold text-ga-ink">{slotLabel(x.section, x.teil)}</span>
                    <TkBadge tone={TEIL_TONE[x.status]}>
                      {x.status === 'RUNNING' ? t(`stage.${x.stage}`) : t(`teilStatus.${x.status}`)}
                    </TkBadge>
                    {x.theme && <span className="ga-ui text-ga-caption text-ga-muted" lang="de">{x.theme}</span>}
                    {(x.repairRound > 0 || x.themeTry > 0) && (
                      <span className="ga-ui text-ga-caption text-ga-muted">
                        {t('repairs', { rounds: x.repairRound, themes: x.themeTry })}
                      </span>
                    )}
                    {x.draftId != null && (
                      <Link href={`/v2/admin/exam-studio/${x.draftId}`} className="ga-ui ml-auto text-ga-caption font-semibold text-ga-accent hover:underline">
                        {t('openDraft')}
                      </Link>
                    )}
                  </div>
                  {x.lastError && x.status !== 'READY' && (
                    <p className="ga-ui break-words text-ga-caption text-ga-muted">{x.lastError}</p>
                  )}
                  {x.status === 'STUCK' && (
                    <details className="rounded-ga bg-ga-surface px-3 py-2" open>
                      <summary className="ga-ui cursor-pointer text-ga-small font-semibold text-ga-ink">{t('fix.title')}</summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <div>
                          <GaCap>{t('fix.problems')}</GaCap>
                          {(x.problems ?? []).length === 0 ? (
                            <p className="ga-ui text-ga-small text-ga-ink">{t('fix.noProblems')}</p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {(x.problems ?? []).map((p) => (
                                <li key={`${p.kind}-${p.ref}`} className="ga-ui text-ga-small text-ga-ink">
                                  <TkBadge tone="red">{p.kind === 'ITEM' ? t('fix.item', { id: p.ref }) : t('fix.check')}</TkBadge>{' '}
                                  <span lang={p.kind === 'ITEM' ? 'de' : undefined}>{p.label}</span>
                                  {p.detail && <span className="block break-words text-ga-caption text-ga-muted">{p.detail}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <GaCap>{t('fix.howTitle')}</GaCap>
                          <ol className="ga-ui list-decimal pl-5 text-ga-small text-ga-ink">
                            <li>{t('fix.step1')}</li>
                            <li>{t('fix.step2')}</li>
                            <li>{t('fix.step3')}</li>
                            <li>{t('fix.step4')}</li>
                          </ol>
                        </div>
                        <div>
                          <GaCap>{t('fix.doneTitle')}</GaCap>
                          <p className="ga-ui text-ga-small text-ga-ink">{t('fix.done')}</p>
                        </div>
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </GaCard>
        )
      })}

      {runs && runs.every((r) => r.status === 'DISCARDED') && (
        <p className="ga-ui text-ga-small text-ga-muted"><GaCap>{t('none')}</GaCap></p>
      )}

      <ConfirmDialog
        open={approving != null}
        onOpenChange={(o) => { if (!o) setApproving(null) }}
        tone="caution"
        title={t('approveTitle', { id: approving?.id ?? 0 })}
        description={t('approveBody')}
        confirmLabel={t('approve')}
        cancelLabel={t('keep')}
        loading={busy}
        onConfirm={() => void approve()}
      />

      <ConfirmDialog
        open={discarding != null}
        onOpenChange={(o) => { if (!o) setDiscarding(null) }}
        title={t('discardTitle', { id: discarding?.id ?? 0 })}
        description={t('discardBody')}
        confirmLabel={t('discard')}
        cancelLabel={t('keep')}
        loading={busy}
        onConfirm={() => void discard()}
      />
    </section>
  )
}
