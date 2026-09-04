'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { CornerDownRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { TkModal, GaBtn } from '@/components/ui-v2'
import { fmtLocalIso, getClassWeek, type ClassSession } from '@/lib/classScheduleApi'
import {
  confirmSessionContents,
  getSessionContents,
  listLessonCurriculumItems,
  planSessionContents,
  type ConfirmEntry,
  type LessonCurriculumItem,
  type SessionContents,
  type SessionContentStatus,
} from '@/lib/sessionContentApi'
import type { ClassLesson } from '@/lib/teacherLessonsApi'
import { allocationSummary } from '../lessonPacing'

const VIOLET = '#7C56C8'
const STATUS_OPTIONS: SessionContentStatus[] = ['PLANNED', 'TAUGHT', 'PARTIAL']
/** Cửa sổ buổi hiện trong picker: 2 tuần đã qua (để xác nhận) + 5 tuần tới (để xếp). */
const WINDOW_PAST_DAYS = 14
const WINDOW_FUTURE_DAYS = 35

const fieldCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2 py-1.5 text-[12.5px] text-ga-ink outline-none focus:border-ga-accent'

interface ConfirmDraft {
  status: SessionContentStatus
  actual: string
  remaining: string
}

/**
 * Phân bổ các mục của một bài giáo trình vào buổi học + xác nhận kết quả sau buổi
 * (PR-4, spec §5 / AC06–AC08). Chọn buổi → tick mục cần dạy kèm phút dự kiến (PUT plan);
 * với buổi đã diễn ra, đổi trạng thái từng dòng (POST confirm) — PARTIAL kèm phút còn lại
 * sẽ tự tạo dòng chuyển tiếp đứng đầu buổi kế. Hoàn thành bài tự suy từ các xác nhận này.
 */
export function AllocationModal({
  classId,
  lesson,
  onClose,
}: {
  classId: number
  lesson: ClassLesson
  onClose: () => void
}) {
  const t = useTranslations('v2.teacher.tcChecklist.alloc')
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [items, setItems] = useState<LessonCurriculumItem[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [data, setData] = useState<SessionContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingContents, setLoadingContents] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Mục CHƯA có trong buổi: tick chọn + phút dự kiến (seed từ estimatedMinutes của giáo trình).
  const [addSel, setAddSel] = useState<Record<number, { checked: boolean; minutes: string }>>({})
  // Nháp xác nhận theo dòng đã có — chỉ gửi những dòng thực sự đổi.
  const [confirmDraft, setConfirmDraft] = useState<Record<number, ConfirmDraft>>({})

  // Buổi của lớp trong cửa sổ ±vài tuần + các mục bắt buộc của Lektion — nạp một lần khi mở.
  useEffect(() => {
    let active = true
    const from = new Date()
    from.setDate(from.getDate() - WINDOW_PAST_DAYS)
    from.setHours(0, 0, 0, 0)
    const to = new Date()
    to.setDate(to.getDate() + WINDOW_FUTURE_DAYS)
    to.setHours(23, 59, 59, 0)
    Promise.all([
      getClassWeek(fmtLocalIso(from), fmtLocalIso(to)),
      listLessonCurriculumItems(classId, lesson.id),
    ])
      .then(([week, its]) => {
        if (!active) return
        const own = week
          .filter((s) => s.classId === classId && s.status !== 'CANCELLED')
          .sort((a, b) => a.startAt.localeCompare(b.startAt))
        setSessions(own)
        setItems(its)
        // Mặc định: buổi sắp tới gần nhất (xếp kế hoạch); hết buổi tương lai → buổi cuối (xác nhận).
        const nowIso = fmtLocalIso(new Date())
        const next = own.find((s) => s.startAt >= nowIso) ?? own[own.length - 1]
        setSessionId(next ? next.id : null)
        setError('')
      })
      .catch((e: unknown) => { if (active) setError(apiMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [classId, lesson.id])

  const loadContents = useCallback(async (sid: number) => {
    setLoadingContents(true)
    try {
      const d = await getSessionContents(sid)
      setData(d)
      setConfirmDraft({})
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoadingContents(false)
    }
  }, [])

  useEffect(() => { if (sessionId != null) void loadContents(sessionId) }, [sessionId, loadContents])

  const session = sessions.find((s) => s.id === sessionId) ?? null
  const isPast = session != null && session.startAt < fmtLocalIso(new Date())
  // Mục còn thêm được = chưa nằm trong buổi này (kể cả dòng chuyển tiếp cùng mục).
  const availableItems = useMemo(() => {
    const inSession = new Set((data?.contents ?? []).map((c) => c.curriculumItemId).filter((x) => x != null))
    return items.filter((i) => !inSession.has(i.id))
  }, [items, data])

  const summary = useMemo(
    () => allocationSummary(data?.contents ?? [], data?.teachingMinutes ?? 0),
    [data],
  )

  const draftFor = (contentId: number, current: { status: SessionContentStatus; actualMinutes: number | null; remainingMinutes: number | null }): ConfirmDraft =>
    confirmDraft[contentId] ?? {
      status: current.status,
      actual: current.actualMinutes != null ? String(current.actualMinutes) : '',
      remaining: current.remainingMinutes != null ? String(current.remainingMinutes) : '',
    }

  const savePlan = async () => {
    if (!data || sessionId == null) return
    // PUT thay TOÀN BỘ dòng PLANNED thường của buổi → gửi lại nguyên trạng những dòng
    // PLANNED hiện có (kể cả của bài khác), rồi nối các mục vừa tick của bài này.
    const kept = data.contents
      .filter((c) => c.status === 'PLANNED' && c.carriedFromId == null)
      .map((c) => ({
        classLessonId: c.classLessonId,
        curriculumItemId: c.curriculumItemId,
        plannedMinutes: c.plannedMinutes ?? 0,
        note: c.note,
      }))
    const added = availableItems
      .filter((i) => addSel[i.id]?.checked)
      .map((i) => ({
        classLessonId: lesson.id,
        curriculumItemId: i.id,
        plannedMinutes: Number(addSel[i.id]?.minutes || i.estimatedMinutes || 0),
        note: null,
      }))
    if (added.some((e) => !Number.isFinite(e.plannedMinutes) || e.plannedMinutes <= 0)) {
      toast.error(t('minutesInvalid'))
      return
    }
    setSaving(true)
    try {
      const d = await planSessionContents(sessionId, [...kept, ...added])
      setData(d)
      setAddSel({})
      toast.success(t('planSaved'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const saveConfirm = async () => {
    if (!data || sessionId == null) return
    const entries: ConfirmEntry[] = []
    for (const c of data.contents) {
      const d = confirmDraft[c.id]
      if (!d) continue
      const changed = d.status !== c.status
        || (d.actual !== (c.actualMinutes != null ? String(c.actualMinutes) : ''))
        || (d.remaining !== (c.remainingMinutes != null ? String(c.remainingMinutes) : ''))
      if (!changed) continue
      if (d.status === 'PARTIAL' && !(Number(d.remaining) > 0)) {
        toast.error(t('remainingRequired'))
        return
      }
      entries.push({
        contentId: c.id,
        status: d.status,
        actualMinutes: d.status === 'PLANNED' ? null : d.actual.trim() !== '' ? Number(d.actual) : null,
        remainingMinutes: d.status === 'PARTIAL' ? Number(d.remaining) : null,
      })
    }
    if (entries.length === 0) return
    setSaving(true)
    try {
      const d = await confirmSessionContents(sessionId, entries)
      setData(d)
      setConfirmDraft({})
      toast.success(t('confirmSaved'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const hasConfirmChanges = Object.keys(confirmDraft).length > 0
  const hasAdds = availableItems.some((i) => addSel[i.id]?.checked)

  return (
    <TkModal
      open
      onOpenChange={(o) => { if (!o && !saving) onClose() }}
      title={t('title')}
      description={lesson.title}
      size="lg"
      footer={
        <>
          <GaBtn variant="ghost" disabled={saving} onClick={onClose}>{t('close')}</GaBtn>
          {hasConfirmChanges && (
            <GaBtn loading={saving} onClick={saveConfirm}>{t('saveConfirm')}</GaBtn>
          )}
          {hasAdds && (
            <GaBtn loading={saving} onClick={savePlan}>{t('savePlan')}</GaBtn>
          )}
        </>
      }
    >
      {loading ? (
        <div className="ga-shimmer h-[160px] border border-ga-line" aria-hidden />
      ) : sessions.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ga-muted">{t('noSessions')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {error && <p className="text-[13px] font-semibold text-ga-red">{error}</p>}

          {/* Chọn buổi + khung phút học */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="ga-ui text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">
              {t('sessionLabel')}
            </label>
            <select
              aria-label={t('sessionLabel')}
              value={sessionId ?? ''}
              onChange={(e) => setSessionId(Number(e.target.value))}
              className={`${fieldCls} min-w-0 max-w-full`}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {format(new Date(s.startAt), 'EEE dd/MM · HH:mm')} · {s.teachingMinutes}′
                </option>
              ))}
            </select>
            {data && (
              <span
                className="ga-ui rounded-ga px-2 py-0.5 text-[11.5px] font-bold"
                style={summary.overBudget > 0
                  ? { background: 'var(--ga-red-soft)', color: 'var(--ga-red)' }
                  : { background: 'var(--ga-violet-soft)', color: VIOLET }}
              >
                {summary.overBudget > 0
                  ? t('overBudget', { over: summary.overBudget })
                  : t('budget', { planned: summary.plannedTotal, teaching: data.teachingMinutes })}
              </span>
            )}
          </div>

          {data && data.unallocatedCarryMinutes > 0 && (
            <p className="m-0 border px-3 py-2 text-[12.5px] font-semibold" style={{ background: 'var(--ga-red-soft)', borderColor: 'var(--ga-red)', color: 'var(--ga-red)' }}>
              {t('unallocated', { minutes: data.unallocatedCarryMinutes })}
            </p>
          )}

          {/* Nội dung đã xếp vào buổi */}
          <div>
            <span className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">{t('planHeading')}</span>
            {loadingContents ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-ga-muted"><Loader2 size={14} className="animate-spin" /> …</div>
            ) : !data || data.contents.length === 0 ? (
              <p className="m-0 border border-dashed border-ga-line px-3 py-4 text-center text-[13px] text-ga-muted">{t('empty')}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {data.contents.map((c) => {
                  const d = draftFor(c.id, c)
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-bg px-3 py-2">
                      {c.carriedFromId != null && (
                        <span className="ga-ui flex shrink-0 items-center gap-1 rounded-ga px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: 'var(--ga-yellow-soft)', color: 'var(--ga-gold)' }}>
                          <CornerDownRight size={11} /> {t('carriedBadge')}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 basis-full text-[13px] font-semibold text-ga-ink sm:basis-auto">
                        {c.itemText ?? c.note ?? c.lessonTitle}
                        <span className="ml-1.5 font-normal text-ga-subtle">· {c.plannedMinutes ?? 0}′</span>
                      </span>
                      {isPast || c.status !== 'PLANNED' || d.status !== c.status ? (
                        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <select
                            aria-label={t('statusLabel')}
                            value={d.status}
                            onChange={(e) => setConfirmDraft((prev) => ({ ...prev, [c.id]: { ...d, status: e.target.value as SessionContentStatus } }))}
                            className={fieldCls}
                          >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`status${s}`)}</option>)}
                          </select>
                          {d.status === 'TAUGHT' && (
                            <input
                              type="number" min={0} value={d.actual} placeholder={t('actualLabel')}
                              aria-label={t('actualLabel')}
                              onChange={(e) => setConfirmDraft((prev) => ({ ...prev, [c.id]: { ...d, actual: e.target.value } }))}
                              className={`${fieldCls} w-[110px]`}
                            />
                          )}
                          {d.status === 'PARTIAL' && (
                            <input
                              type="number" min={1} value={d.remaining} placeholder={t('remainingLabel')}
                              aria-label={t('remainingLabel')}
                              onChange={(e) => setConfirmDraft((prev) => ({ ...prev, [c.id]: { ...d, remaining: e.target.value } }))}
                              className={`${fieldCls} w-[120px]`}
                            />
                          )}
                        </span>
                      ) : (
                        <span className="ga-ui shrink-0 text-[11px] font-bold uppercase text-ga-subtle">{t('statusPLANNED')}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Thêm mục của bài này vào buổi */}
          {availableItems.length > 0 ? (
            <div>
              <span className="ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted">{t('addHeading')}</span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {availableItems.map((i) => {
                  const sel = addSel[i.id] ?? { checked: false, minutes: i.estimatedMinutes != null ? String(i.estimatedMinutes) : '' }
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 border border-dashed border-ga-line px-3 py-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sel.checked}
                          onChange={(e) => setAddSel((prev) => ({ ...prev, [i.id]: { ...sel, checked: e.target.checked } }))}
                          className="h-4 w-4 shrink-0 accent-[#7C56C8]"
                        />
                        <span className="min-w-0 break-words text-[13px] text-ga-ink">{i.text}</span>
                      </label>
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-ga-muted">
                        <input
                          type="number" min={1} value={sel.minutes}
                          aria-label={t('plannedMinutesLabel')}
                          onChange={(e) => setAddSel((prev) => ({ ...prev, [i.id]: { checked: true, minutes: e.target.value } }))}
                          className={`${fieldCls} w-[76px]`}
                        />
                        {t('minutes')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : items.length > 0 ? (
            <p className="m-0 text-[12.5px] text-ga-subtle">{t('allAdded')}</p>
          ) : null}
        </div>
      )}
    </TkModal>
  )
}
