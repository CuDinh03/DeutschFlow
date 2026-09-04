'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle2, CornerDownRight, Loader2, Lock, LockOpen, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  completeSession,
  getSessionWorkspace,
  uncompleteSession,
  type SessionWorkspace,
} from '@/lib/sessionWorkspaceApi'
import {
  createLessonLog,
  updateLessonLog,
  type LessonLogAttendanceInput,
} from '@/lib/teacherLessonLogApi'
import { confirmSessionContents, type SessionContentStatus } from '@/lib/sessionContentApi'
import { ConfirmDialog, GaBtn, GaCap, GaPageHdr, TkBadge } from '@/components/ui-v2'

const ATT_STATUSES = ['PRESENT', 'LATE', 'ABSENT'] as const
type AttStatus = (typeof ATT_STATUSES)[number]

interface AttDraft {
  status: AttStatus
  needsMakeup: boolean
}

const inputCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13px] text-ga-ink outline-none focus:border-ga-accent'

/**
 * Màn LÀM VIỆC THEO BUỔI (PR-7, spec §8): ba khối Trước (nội dung đã phân bổ — phần chuyển tiếp
 * đứng đầu) / Trong (nhật ký + điểm danh, cờ "cần bù riêng" khi vắng — AC13) / Sau (xác nhận
 * nội dung + CHỐT BUỔI). Quá cửa sổ 7 ngày (P07) mọi chỉnh sửa khóa lại — banner nêu đường mở
 * khóa 24h qua người duyệt học vụ.
 */
export default function V2SessionWorkspacePage() {
  const t = useTranslations('v2.teacher.sessionWorkspace')
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const sessionId = Number(params.id)

  const [ws, setWs] = useState<SessionWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmUncomplete, setConfirmUncomplete] = useState(false)
  // Nhật ký nháp (khối Trong): topic + điểm danh theo roster.
  const [topic, setTopic] = useState('')
  const [attDraft, setAttDraft] = useState<Record<number, AttDraft>>({})
  // Xác nhận nội dung (khối Sau): trạng thái nháp theo content id.
  const [contentDraft, setContentDraft] = useState<Record<number, { status: SessionContentStatus; remaining: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSessionWorkspace(sessionId)
      setWs(data)
      setTopic(data.log?.topic ?? '')
      const draft: Record<number, AttDraft> = {}
      for (const r of data.roster) {
        const existing = data.log?.attendance.find((a) => a.studentId === r.studentId)
        draft[r.studentId] = existing
          ? { status: (existing.status as AttStatus) ?? 'PRESENT', needsMakeup: existing.needsMakeup }
          : { status: 'PRESENT', needsMakeup: false }
      }
      setAttDraft(draft)
      setContentDraft({})
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { if (Number.isFinite(sessionId)) void load() }, [sessionId, load])

  const saveLog = async () => {
    if (!ws) return
    if (!topic.trim()) {
      toast.error(t('topicRequired'))
      return
    }
    setBusy(true)
    try {
      const attendance: LessonLogAttendanceInput[] = ws.roster.map((r) => ({
        studentId: r.studentId,
        status: attDraft[r.studentId]?.status ?? 'PRESENT',
        // AC13: gửi tường minh để giữ quyết định bỏ/đặt cờ của giáo viên qua các lần sửa.
        needsMakeup: attDraft[r.studentId]?.needsMakeup ?? false,
      }))
      const body = {
        sessionDate: ws.startAt.slice(0, 10),
        topic: topic.trim(),
        attendance,
        sessionId: ws.sessionId,
      }
      if (ws.log) {
        await updateLessonLog(ws.classId, ws.log.id, body)
      } else {
        await createLessonLog(ws.classId, body)
      }
      toast.success(t('logSaved'))
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveContentConfirm = async () => {
    if (!ws) return
    const entries = Object.entries(contentDraft).map(([id, d]) => ({
      contentId: Number(id),
      status: d.status,
      remainingMinutes: d.status === 'PARTIAL' ? Number(d.remaining) : null,
    }))
    if (entries.length === 0) return
    if (entries.some((e) => e.status === 'PARTIAL' && !(Number(e.remainingMinutes) > 0))) {
      toast.error(t('remainingRequired'))
      return
    }
    setBusy(true)
    try {
      await confirmSessionContents(ws.sessionId, entries)
      toast.success(t('contentsSaved'))
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doComplete = async () => {
    setBusy(true)
    try {
      setWs(await completeSession(sessionId))
      setConfirmComplete(false)
      toast.success(t('completeSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doUncomplete = async () => {
    setBusy(true)
    try {
      setWs(await uncompleteSession(sessionId))
      setConfirmUncomplete(false)
      toast.success(t('uncompleteSuccess'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const absentCount = useMemo(
    () => Object.values(attDraft).filter((d) => d.status === 'ABSENT').length,
    [attDraft],
  )

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={ws ? t('title', { class: ws.className }) : t('titleFallback')}
        subtitle={ws ? `${format(new Date(ws.startAt), 'EEE dd/MM/yyyy · HH:mm')} · ${ws.teachingMinutes ?? ws.durationMinutes}′${ws.room ? ` · ${ws.room}` : ''}` : undefined}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/teacher/schedule')}>
            <ArrowLeft size={14} /> {t('backToSchedule')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <div className="ga-shimmer h-[420px] border border-ga-line" aria-hidden />
        ) : error || !ws ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center">
            <p className="ga-ui m-0 text-[14px] text-ga-red">{error || t('loadError')}</p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
            {/* Trạng thái chốt / cửa sổ sửa (P07) */}
            {ws.completedAt ? (
              <div className="flex flex-wrap items-center gap-2 border px-4 py-3" style={{ background: 'var(--ga-green-soft)', borderColor: 'var(--ga-green)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--ga-green)' }} />
                <span className="text-[13.5px] font-semibold text-ga-ink">
                  {t('completedAt', { date: format(new Date(ws.completedAt), 'dd/MM/yyyy HH:mm') })}
                </span>
                {ws.editable && (
                  <GaBtn variant="ghost" size="sm" onClick={() => setConfirmUncomplete(true)}>{t('uncomplete')}</GaBtn>
                )}
              </div>
            ) : !ws.editable ? (
              <div className="flex items-start gap-2 border px-4 py-3" style={{ background: 'var(--ga-red-soft)', borderColor: 'var(--ga-red)' }}>
                <Lock size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ga-red)' }} />
                <p className="ga-ui m-0 text-[13px] leading-[1.5] text-ga-ink">
                  {t('lockedBanner', { days: ws.editWindowDays })}
                </p>
              </div>
            ) : ws.unlockActive ? (
              <div className="flex items-center gap-2 border px-4 py-3" style={{ background: 'var(--ga-yellow-soft)', borderColor: 'var(--ga-gold)' }}>
                <LockOpen size={15} style={{ color: 'var(--ga-gold)' }} />
                <span className="ga-ui text-[13px] text-ga-ink">{t('unlockActive')}</span>
              </div>
            ) : null}

            {/* ── Trước buổi: nội dung đã phân bổ ── */}
            <section aria-label={t('beforeCap')}>
              <GaCap className="mb-2 block">{t('beforeCap')}</GaCap>
              {ws.contents.contents.length === 0 ? (
                <p className="m-0 border border-dashed border-ga-line px-4 py-4 text-center text-[13px] text-ga-muted">
                  {t('noContents')}
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {ws.contents.contents.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-card px-3.5 py-2">
                      {c.carriedFromId != null && (
                        <span className="ga-ui flex shrink-0 items-center gap-1 rounded-ga px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'var(--ga-yellow-soft)', color: 'var(--ga-gold)' }}>
                          <CornerDownRight size={11} /> {t('carriedBadge')}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-[13px] text-ga-ink">
                        {c.itemText ?? c.note ?? c.lessonTitle}
                        <span className="ml-1.5 text-ga-subtle">· {c.plannedMinutes ?? 0}′</span>
                      </span>
                      <TkBadge tone={c.status === 'TAUGHT' ? 'green' : c.status === 'PARTIAL' ? 'yellow' : 'neutral'}>
                        {t(`contentStatus.${c.status}`)}
                      </TkBadge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Bài tập gắn buổi (PR-8, spec §8) ── */}
            {ws.assignments.length > 0 && (
              <section aria-label={t('assignmentsCap')}>
                <GaCap className="mb-2 block">{t('assignmentsCap')}</GaCap>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {ws.assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-card px-3.5 py-2">
                      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ga-ink">{a.topic}</span>
                      {a.status === 'DRAFT' && (
                        <TkBadge tone="yellow">{t('assignmentDraft')}</TkBadge>
                      )}
                      {a.recipientCount > 0 && (
                        <span className="ga-ui text-[11px] text-ga-muted">{t('assignmentRecipients', { count: a.recipientCount })}</span>
                      )}
                      {a.dueDate && (
                        <span className="ga-ui text-[11.5px] text-ga-subtle">{t('assignmentDue', { date: format(new Date(a.dueDate), 'dd/MM HH:mm') })}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Trong buổi: nhật ký + điểm danh (AC13) ── */}
            <section aria-label={t('duringCap')}>
              <GaCap className="mb-2 block">{t('duringCap')}</GaCap>
              <div className="border border-ga-line bg-ga-card p-4">
                <label className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
                  {t('topicLabel')}
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                  disabled={!ws.editable}
                  className={`${inputCls} w-full disabled:opacity-60`}
                />

                <div className="mt-4">
                  <span className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
                    {t('attendanceLabel')}
                    {absentCount > 0 && (
                      <span className="ml-2 font-semibold normal-case tracking-normal" style={{ color: 'var(--ga-red)' }}>
                        {t('absentCount', { count: absentCount })}
                      </span>
                    )}
                  </span>
                  {ws.roster.length === 0 ? (
                    <p className="m-0 text-[13px] text-ga-subtle">{t('emptyRoster')}</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {ws.roster.map((r) => {
                        const d = attDraft[r.studentId] ?? { status: 'PRESENT' as AttStatus, needsMakeup: false }
                        return (
                          <li key={r.studentId} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-bg px-3 py-2">
                            <span className="min-w-0 flex-1 text-[13px] font-semibold text-ga-ink">{r.displayName}</span>
                            <select
                              aria-label={t('statusFor', { name: r.displayName })}
                              value={d.status}
                              disabled={!ws.editable}
                              onChange={(e) => {
                                const status = e.target.value as AttStatus
                                setAttDraft((prev) => ({
                                  ...prev,
                                  // AC13: chuyển sang VẮNG tự bật "cần bù riêng"; giáo viên bỏ được ngay dưới.
                                  [r.studentId]: { status, needsMakeup: status === 'ABSENT' },
                                }))
                              }}
                              className={`${inputCls} disabled:opacity-60`}
                            >
                              {ATT_STATUSES.map((st) => <option key={st} value={st}>{t(`attStatus.${st}`)}</option>)}
                            </select>
                            {d.status === 'ABSENT' && (
                              <label className="flex items-center gap-1.5 text-[12px] text-ga-muted">
                                <input
                                  type="checkbox"
                                  checked={d.needsMakeup}
                                  disabled={!ws.editable}
                                  onChange={(e) => setAttDraft((prev) => ({
                                    ...prev,
                                    [r.studentId]: { ...d, needsMakeup: e.target.checked },
                                  }))}
                                  className="h-4 w-4 accent-[var(--ga-red)]"
                                />
                                {t('needsMakeup')}
                              </label>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <GaBtn variant="primary" size="sm" disabled={busy || !ws.editable} onClick={saveLog}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : null} {ws.log ? t('saveLogUpdate') : t('saveLogCreate')}
                  </GaBtn>
                </div>
              </div>
            </section>

            {/* ── Sau buổi: xác nhận nội dung + chốt ── */}
            <section aria-label={t('afterCap')}>
              <GaCap className="mb-2 block">{t('afterCap')}</GaCap>
              {ws.contents.contents.length > 0 && (
                <div className="mb-3 border border-ga-line bg-ga-card p-4">
                  <span className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
                    {t('confirmHeading')}
                  </span>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {ws.contents.contents.map((c) => {
                      const d = contentDraft[c.id] ?? { status: c.status, remaining: c.remainingMinutes != null ? String(c.remainingMinutes) : '' }
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-bg px-3 py-2">
                          <span className="min-w-0 flex-1 text-[13px] text-ga-ink">{c.itemText ?? c.note ?? c.lessonTitle}</span>
                          <select
                            aria-label={t('confirmStatusLabel')}
                            value={d.status}
                            disabled={!ws.editable}
                            onChange={(e) => setContentDraft((prev) => ({ ...prev, [c.id]: { ...d, status: e.target.value as SessionContentStatus } }))}
                            className={`${inputCls} disabled:opacity-60`}
                          >
                            {(['PLANNED', 'TAUGHT', 'PARTIAL'] as const).map((st) => (
                              <option key={st} value={st}>{t(`contentStatus.${st}`)}</option>
                            ))}
                          </select>
                          {d.status === 'PARTIAL' && (
                            <input
                              type="number" min={1}
                              aria-label={t('remainingLabel')}
                              placeholder={t('remainingLabel')}
                              value={d.remaining}
                              disabled={!ws.editable}
                              onChange={(e) => setContentDraft((prev) => ({ ...prev, [c.id]: { ...d, remaining: e.target.value } }))}
                              className={`${inputCls} w-[120px] disabled:opacity-60`}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {Object.keys(contentDraft).length > 0 && (
                    <div className="mt-3 flex justify-end">
                      <GaBtn variant="primary" size="sm" disabled={busy || !ws.editable} onClick={saveContentConfirm}>
                        {t('saveConfirm')}
                      </GaBtn>
                    </div>
                  )}
                  {ws.contents.unallocatedCarryMinutes > 0 && (
                    <p className="m-0 mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--ga-red)' }}>
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      {t('unallocated', { minutes: ws.contents.unallocatedCarryMinutes })}
                    </p>
                  )}
                </div>
              )}

              {!ws.completedAt && (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-ga-line bg-ga-card px-4 py-3">
                  <p className="ga-ui m-0 min-w-0 flex-1 text-[13px] text-ga-muted">{t('completeHint')}</p>
                  <GaBtn
                    variant="primary"
                    disabled={busy || ws.status === 'CANCELLED' || new Date(ws.startAt) > new Date()}
                    onClick={() => setConfirmComplete(true)}
                  >
                    <CheckCircle2 size={15} /> {t('complete')}
                  </GaBtn>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={(o) => { if (!o) setConfirmComplete(false) }}
        title={t('completeDialogTitle')}
        description={ws ? `${ws.className} · ${format(new Date(ws.startAt), 'dd/MM/yyyy HH:mm')}` : undefined}
        details={[t('completeDialogDetail1', { days: ws?.editWindowDays ?? 7 }), t('completeDialogDetail2')]}
        confirmLabel={t('completeConfirm')}
        cancelLabel={t('cancel')}
        destructive={false}
        loading={busy}
        onConfirm={() => void doComplete()}
      />
      <ConfirmDialog
        open={confirmUncomplete}
        onOpenChange={(o) => { if (!o) setConfirmUncomplete(false) }}
        title={t('uncompleteDialogTitle')}
        details={[t('uncompleteDialogDetail')]}
        confirmLabel={t('uncompleteConfirm')}
        cancelLabel={t('cancel')}
        loading={busy}
        onConfirm={() => void doUncomplete()}
      />
    </div>
  )
}
