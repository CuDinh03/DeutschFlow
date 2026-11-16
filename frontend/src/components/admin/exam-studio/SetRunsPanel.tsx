'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Repeat, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { apiProblem, isGuided, type ApiProblem } from '@/lib/apiProblem'
import {
  addSetRunHoeren, approveSetRun, createSetRun, discardSetRun, getSetAuto, getStudioChannel, listSetRuns, putSetAuto,
  recheckSetRun, redoSetRunTeil,
  type SetAuto, type SetAutoJob, type SetRun, type SetRunStatus, type SetRunTeil,
} from '@/lib/adminExamStudioApi'
import { ConfirmDialog, ErrorBanner, GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { ProblemNotice } from '@/components/admin/ProblemNotice'
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

/** Lượt có Teil Nghe do máy soạn không. Lượt tạo trước 13/11/2026 chỉ có 6 Teil, không có phần Nghe. */
const hasHoeren = (r: SetRun) => r.teile.some((x) => x.section.toUpperCase() === 'HOEREN')
/** Lượt cũ đã chạy xong, chưa duyệt, là telc B1 (cấp duy nhất máy soạn được phần Nghe) ⇒ hiện nút "Tạo phần Nghe". */
const canAddHoeren = (r: SetRun) => (r.status === 'REVIEW' || r.status === 'NEEDS_ATTENTION')
  && r.examFormat.toUpperCase() === 'TELC' && r.cefrLevel === 'B1' && !hasHoeren(r)

/** Nhãn việc đứng đầu dòng lịch sử thì viết hoa chữ đầu ("phần Nghe…" ⇒ "Phần Nghe…"). */
const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s)

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
  const [auto, setAuto] = useState<SetAuto | null>(null)
  const [redoing, setRedoing] = useState<{ run: SetRun; teil: SetRunTeil } | null>(null)
  const [addingHoeren, setAddingHoeren] = useState<SetRun | null>(null)
  // Lỗi có chỉ dẫn của một lượt (vd. duyệt cả bộ bị chặn): hiện ngay trong thẻ lượt đó, không tự tắt.
  const [problem, setProblem] = useState<{ runId: number | null; problem: ApiProblem } | null>(null)
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, a] = await Promise.all([listSetRuns(), getSetAuto().catch(() => null)])
      setRuns(list)
      setAuto(a)
      setError('')
    } catch (e) {
      setError(apiMessage(e))
    }
  }, [])

  useEffect(() => { if (active) void load() }, [active, load])

  const activeRun = (runs ?? []).find((r) => ACTIVE.includes(r.status)) ?? null
  const anyActive = activeRun != null
  // Tự nối đang bật: "Làm lại Teil" / "Tạo phần Nghe" vẫn bấm được lúc máy chạy — backend xếp hàng (owner chốt 13/11/2026).
  const canQueue = auto?.enabled === true
  const jobLabel = (p: SetAutoJob) => (p.kind === 'REDO'
    ? t('pendingRedo', { teil: slotLabel(p.section ?? '', p.teil ?? 0), id: p.runId })
    : t('pendingAddHoeren', { id: p.runId }))
  // Giao diện có thể chưa thấy lượt máy vừa tự tạo (nạp lại 10 giây một lần): khi đó báo câu không kèm số lượt.
  const queuedMsg = () => (activeRun ? t('queued', { id: activeRun.id }) : t('queuedNoRun'))
  const pendingItems = (auto?.pending ?? []).map(jobLabel)
  const history = auto?.history ?? []
  useEffect(() => {
    if (!active || (!anyActive && !auto?.enabled)) return
    timer.current = setTimeout(() => void load(), REFRESH_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [active, anyActive, auto?.enabled, runs, load])

  const toggleAuto = async () => {
    setBusy(true)
    try {
      const on = !auto?.enabled
      setAuto(await putSetAuto(on
        ? { enabled: true, examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: getStudioChannel() }
        : { enabled: false }))
      toast.success(t(on ? 'autoEnabled' : 'autoDisabled'))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Lỗi của một thao tác: có chỉ dẫn (chuyện gì – ở đâu – làm gì) thì hiện khung không tự tắt ngay tại lượt liên
   * quan, toast chỉ nhắc ngắn; lỗi kiểu cũ vẫn là toast câu chữ của backend.
   */
  const fail = (e: unknown, runId: number | null) => {
    const p = apiProblem(e)
    if (!isGuided(p)) { toast.error(p.message); return }
    setProblem({ runId, problem: p })
    toast.error(p.title ?? p.message)
  }

  // Mở từ thông báo chuông (?run=11): cuộn tới thẻ của lượt đó một lần sau khi nạp xong.
  useEffect(() => {
    if (focused.current || !runs) return
    focused.current = true
    const id = new URLSearchParams(window.location.search).get('run')
    if (id) document.getElementById(`set-run-${id}`)?.scrollIntoView?.({ block: 'start' })
  }, [runs])

  const start = async () => {
    setBusy(true)
    try {
      await createSetRun({ examFormat: 'TELC', cefrLevel: 'B1', profile: 'REAL', channel: getStudioChannel() })
      setProblem(null)
      toast.success(t('started'))
      await load()
    } catch (e) {
      fail(e, null)
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
      setProblem(null)
      toast.success(t('approved'))
      await load()
      onApproved?.()
    } catch (e) {
      const p = apiProblem(e)
      if (isGuided(p)) {
        // Danh sách Teil chưa đạt cần đọc kỹ và bấm tới từng bản nháp: đóng hộp xác nhận, hiện trong thẻ lượt.
        setProblem({ runId: approving.id, problem: p })
        setApproving(null)
        toast.error(t('approveBlocked', { id: approving.id, count: new Set(p.issues.map((i) => i.label)).size }))
      } else {
        toast.error(p.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const recheck = async (r: SetRun) => {
    setBusy(true)
    try {
      const next = await recheckSetRun(r.id)
      setProblem(null)
      if (next.status === 'REVIEW') {
        toast.success(t('recheckedReady', { id: r.id }))
      } else {
        // Nói rõ còn vướng gì: Teil nào chưa xong, mấy mục kiểm cấp bộ còn đỏ.
        const notReady = next.teile.filter((x) => x.status !== 'READY').map((x) => slotLabel(x.section, x.teil))
        const red = (next.setChecks ?? []).filter((c) => c.light === 'RED').length
        toast.message(t('recheckedStill', { id: r.id, stuck: notReady.length, teile: notReady.join(', ') || '—', red }))
      }
      await load()
    } catch (e) {
      fail(e, r.id)
    } finally {
      setBusy(false)
    }
  }

  const redo = async () => {
    if (!redoing) return
    setBusy(true)
    try {
      // Làm lại bằng kênh đang chọn ở nút "Tạo đề bằng", không phải kênh lúc tạo lượt.
      const next = await redoSetRunTeil(redoing.run.id, redoing.teil.section, redoing.teil.teil, getStudioChannel())
      setRedoing(null)
      setProblem(null)
      // Lượt chưa chuyển sang chạy ⇒ backend đã xếp hàng chờ lượt đang chạy xong.
      toast.success(ACTIVE.includes(next.status) ? t('redoStarted') : queuedMsg())
      await load()
    } catch (e) {
      setRedoing(null)
      fail(e, redoing.run.id)
    } finally {
      setBusy(false)
    }
  }

  const addHoeren = async () => {
    if (!addingHoeren) return
    setBusy(true)
    try {
      // Như "Làm lại Teil": dùng kênh đang chọn ở nút "Tạo đề bằng", không phải kênh lúc tạo lượt.
      const next = await addSetRunHoeren(addingHoeren.id, getStudioChannel())
      setAddingHoeren(null)
      setProblem(null)
      toast.success(ACTIVE.includes(next.status) ? t('addHoerenStarted') : queuedMsg())
      await load()
    } catch (e) {
      setAddingHoeren(null)
      fail(e, addingHoeren.id)
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
      setProblem(null)
      await load()
    } catch (e) {
      fail(e, discarding.id)
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
        <div className="flex flex-wrap items-center gap-2">
          <GaBtn variant="ghost" onClick={() => void toggleAuto()} disabled={busy || auto == null}
            aria-pressed={auto?.enabled ?? false}>
            <Repeat className="h-4 w-4" aria-hidden /> {t(auto?.enabled ? 'autoOff' : 'autoOn')}
          </GaBtn>
          <GaBtn onClick={() => void start()} disabled={busy || anyActive}>
            <Sparkles className="h-4 w-4" aria-hidden /> {t('start')}
          </GaBtn>
        </div>
        {auto?.enabled ? (
          <p className="ga-ui basis-full text-ga-caption font-semibold text-ga-ink">
            {t('autoRunning', { waiting: auto.waiting, max: auto.maxWaiting })}
          </p>
        ) : (
          <p className="ga-ui basis-full text-ga-caption text-ga-muted">{t('autoHint', { max: auto?.maxWaiting ?? 5 })}</p>
        )}
        {auto?.note && <p className="ga-ui basis-full break-words text-ga-caption text-ga-muted">{auto.note}</p>}
        {anyActive && !auto?.enabled && <p className="ga-ui basis-full text-ga-caption text-ga-muted">{t('oneAtATime')}</p>}
        {anyActive && canQueue && <p className="ga-ui basis-full text-ga-caption text-ga-muted">{t('autoQueueHint')}</p>}
        {pendingItems.length > 0 && (
          <p className="ga-ui basis-full break-words text-ga-caption font-semibold text-ga-ink">
            {t('autoPending', { items: pendingItems.join('; ') })}
          </p>
        )}
        {history.length > 0 && (
          <details className="basis-full">
            <summary className="ga-ui cursor-pointer text-ga-caption font-semibold text-ga-ink">
              {t('historyTitle', { count: history.length })}
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <TkBadge tone={h.status === 'DONE' ? 'green' : 'red'}>{t(h.status === 'DONE' ? 'jobDone' : 'jobFailed')}</TkBadge>
                  <span className="ga-ui text-ga-small text-ga-ink">{capitalize(jobLabel(h))}</span>
                  <span className="ga-ui text-ga-caption text-ga-muted">{fmtDate(h.finishedAt ?? h.createdAt)}</span>
                  {h.error && <span className="ga-ui basis-full break-words text-ga-caption text-ga-muted">{h.error}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </GaCard>

      {error && <ErrorBanner title={t('loadError')} message={error} onRetry={() => void load()} />}
      {problem && (problem.runId == null || !(runs ?? []).some((r) => r.id === problem.runId && r.status !== 'DISCARDED')) && (
        <ProblemNotice problem={problem.problem} onDismiss={() => setProblem(null)} />
      )}

      {(runs ?? []).filter((r) => r.status !== 'DISCARDED').map((r) => {
        const ready = r.teile.filter((x) => x.status === 'READY').length
        const redChecks = (r.setChecks ?? []).filter((c) => c.light === 'RED').length
        return (
          <GaCard key={r.id} id={`set-run-${r.id}`} className="flex scroll-mt-4 flex-col gap-3 p-4 sm:p-5">
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
              {canAddHoeren(r) && (
                <GaBtn size="sm" variant="ghost" disabled={busy || (anyActive && !canQueue)} onClick={() => setAddingHoeren(r)}>{t('addHoeren')}</GaBtn>
              )}
              {r.status !== 'APPROVED' && (
                <button type="button" className={studioMiniBtn} disabled={busy} onClick={() => setDiscarding(r)}>
                  {t('discard')}
                </button>
              )}
            </div>
            {r.note && <p className="ga-ui text-ga-caption text-ga-muted">{r.note}</p>}
            {problem?.runId === r.id && <ProblemNotice problem={problem.problem} onDismiss={() => setProblem(null)} />}
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
                    <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                      {(r.status === 'NEEDS_ATTENTION' || r.status === 'REVIEW') && (
                        <button type="button" className={studioMiniBtn} disabled={busy || (anyActive && !canQueue)}
                          onClick={() => setRedoing({ run: r, teil: x })}>
                          {t('redo')}
                        </button>
                      )}
                      {x.draftId != null && (
                        <Link href={`/v2/admin/exam-studio/${x.draftId}`} className="ga-ui text-ga-caption font-semibold text-ga-accent hover:underline">
                          {t('openDraft')}
                        </Link>
                      )}
                    </span>
                  </div>
                  {x.lastError && x.status !== 'READY' && (
                    <p className="ga-ui break-words text-ga-caption text-ga-muted">
                      {/* Câu của máy đứng riêng thì không biết có phải làm gì không: nói rõ theo trạng thái Teil. */}
                      {(x.status === 'RUNNING' || x.status === 'STUCK') && (
                        <span className="font-semibold text-ga-ink">{t(`lastErrorWhen.${x.status}`)} </span>
                      )}
                      {x.lastError}
                    </p>
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
        description={t(approving && !hasHoeren(approving) ? 'approveBodyNoHoeren' : 'approveBody')}
        confirmLabel={t('approve')}
        cancelLabel={t('keep')}
        loading={busy}
        onConfirm={() => void approve()}
      />

      <ConfirmDialog
        open={redoing != null}
        onOpenChange={(o) => { if (!o) setRedoing(null) }}
        tone="caution"
        title={t('redoTitle', { teil: redoing ? slotLabel(redoing.teil.section, redoing.teil.teil) : '', id: redoing?.run.id ?? 0 })}
        description={t('redoBody')}
        confirmLabel={t('redo')}
        cancelLabel={t('keep')}
        loading={busy}
        onConfirm={() => void redo()}
      />

      <ConfirmDialog
        open={addingHoeren != null}
        onOpenChange={(o) => { if (!o) setAddingHoeren(null) }}
        tone="caution"
        title={t('addHoerenTitle', { id: addingHoeren?.id ?? 0 })}
        description={t('addHoerenBody')}
        confirmLabel={t('addHoeren')}
        cancelLabel={t('keep')}
        loading={busy}
        onConfirm={() => void addHoeren()}
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
