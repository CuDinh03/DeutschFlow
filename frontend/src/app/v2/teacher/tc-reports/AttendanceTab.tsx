'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { FileDown, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, Loader2, Save } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  createLessonLog,
  updateLessonLog,
  deleteLessonLog,
  type ClassLessonLog,
  type LessonLogAttendanceEntry,
  type LessonLogRequest,
} from '@/lib/teacherLessonLogApi'
import { GaBtn, GaCap, TkBadge } from '@/components/ui-v2'
import { ReportPrintHeader } from './reportShared'

export interface AttendanceTabProps {
  classId: number
  lessonLogs: ClassLessonLog[]
  /** Functional-updater setter (the page passes its raw setState) so concurrent saves
   *  compose on the latest list instead of a stale closure snapshot. */
  onLessonLogsChange: Dispatch<SetStateAction<ClassLessonLog[]>>
  /** Authoritative current membership — the ONLY list allowed to drive the marking form. */
  roster: { studentId: number; name: string }[]
  /**
   * Roster for read-only history (printed matrix). Falls back to students seen across existing
   * logs when the enrolment endpoints fail, so the printed sheet is not blank. Never used as
   * marking input: those students may have left the class and the backend rejects them.
   */
  printRoster: { studentId: number; name: string }[]
  /** Class lessons, for optionally tagging a journal entry with the taught Lektion (Phase 1d-D3). */
  lessons: { id: number; title: string }[]
  classDisplayName: string
}

/** The three values the backend stores. Only these are ever sent on the wire. */
type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT'

/**
 * Draft-only status. UNMARKED means "the teacher has not said anything about this student yet" and
 * is never sent to the backend — no attendance row is written for them.
 *
 * This exists because the form used to default every roster student to PRESENT: a teacher who only
 * wanted to record what was taught, and never scrolled to the attendance section, silently marked
 * the whole class present — absentees included. That fabricated data flows into the attendance rate
 * and the certificate gate, so "no answer" must stay distinguishable from "present".
 */
type DraftStatus = AttendanceStatus | 'UNMARKED'

/**
 * Normalize a raw status string to the three-value domain. The backend column has no
 * CHECK constraint, so an unrecognized value is possible (legacy/corrupt data); it maps
 * to ABSENT — a single fail-safe used by every display/count helper so tone, glyph and
 * counts can never disagree about the same entry.
 */
function normalizeAttendanceStatus(status: string): AttendanceStatus {
  const s = (status ?? '').toUpperCase()
  if (s === 'PRESENT') return 'PRESENT'
  if (s === 'LATE') return 'LATE'
  return 'ABSENT'
}

const labelCls = 'ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted'
const fieldCls =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'
const selectCls =
  'rounded-ga border border-ga-line bg-ga-card px-1.5 py-1 text-[12px] text-ga-ink outline-none focus:border-ga-accent'
const iconBtnCls =
  'grid h-8 w-8 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-side-active hover:text-ga-ink'
const deleteBtnCls =
  'grid h-8 w-8 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red'

function attendanceTone(status: string): 'green' | 'yellow' | 'red' {
  const n = normalizeAttendanceStatus(status)
  if (n === 'LATE') return 'yellow'
  if (n === 'ABSENT') return 'red'
  return 'green'
}

function attendanceCounts(entries: LessonLogAttendanceEntry[]): { present: number; absent: number; late: number } {
  const counts = { present: 0, absent: 0, late: 0 }
  for (const a of entries) {
    const n = normalizeAttendanceStatus(a.status)
    if (n === 'PRESENT') counts.present++
    else if (n === 'LATE') counts.late++
    else counts.absent++
  }
  return counts
}

/** Print-only roster glyph: check/M/V per legacy convention, with a matching accent color. */
function glyphAndColor(entry: LessonLogAttendanceEntry | undefined): { glyph: string; color?: string } {
  if (!entry) return { glyph: '' }
  const n = normalizeAttendanceStatus(entry.status)
  if (n === 'PRESENT') return { glyph: '✓', color: 'var(--ga-green)' }
  if (n === 'LATE') return { glyph: 'M', color: 'var(--ga-gold)' }
  return { glyph: 'V', color: 'var(--ga-red)' }
}

function buildAttendanceDraft(
  students: { studentId: number; name: string }[],
  log: ClassLessonLog | null,
): Record<number, DraftStatus> {
  const draft: Record<number, DraftStatus> = {}
  for (const s of students) {
    const existing = log?.attendance.find((a) => a.studentId === s.studentId)
    // No existing record → UNMARKED. Never assume PRESENT.
    draft[s.studentId] = existing ? normalizeAttendanceStatus(existing.status) : 'UNMARKED'
  }
  return draft
}

export function AttendanceTab(props: AttendanceTabProps) {
  const { classId, lessonLogs, onLessonLogsChange, roster, printRoster, lessons, classDisplayName } = props
  const t = useTranslations('v2.teacher.tcReports')
  const tc = useTranslations('v2.common')

  const [formOpen, setFormOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<ClassLessonLog | null>(null)
  const [sessionDate, setSessionDate] = useState('')
  const [sessionNumber, setSessionNumber] = useState('')
  const [topic, setTopic] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [homework, setHomework] = useState('')
  const [note, setNote] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, DraftStatus>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const openAddForm = (): void => {
    setEditingLog(null)
    setSessionDate('')
    setSessionNumber('')
    setTopic('')
    setLessonId('')
    setHomework('')
    setNote('')
    setAttendanceDraft(buildAttendanceDraft(roster, null))
    setFormOpen(true)
  }

  const openEditForm = (log: ClassLessonLog): void => {
    setEditingLog(log)
    setSessionDate(log.sessionDate)
    setSessionNumber(log.sessionNumber != null ? String(log.sessionNumber) : '')
    setTopic(log.topic ?? '')
    // Only preselect the lesson if it still exists in the class (it may have been deleted).
    setLessonId(log.lessonId != null && lessons.some((l) => l.id === log.lessonId) ? String(log.lessonId) : '')
    setHomework(log.homework ?? '')
    setNote(log.note ?? '')
    setAttendanceDraft(buildAttendanceDraft(roster, log))
    setFormOpen(true)
  }

  const closeForm = (): void => {
    setFormOpen(false)
    setEditingLog(null)
  }

  const setStudentStatus = (studentId: number, status: DraftStatus): void => {
    setAttendanceDraft((prev) => ({ ...prev, [studentId]: status }))
  }

  /** One click for the common case (everyone showed up) — without making it the silent default. */
  const markAllPresent = (): void => {
    setAttendanceDraft((prev) => {
      const next = { ...prev }
      for (const s of roster) next[s.studentId] = 'PRESENT'
      return next
    })
  }

  const unmarkedCount = roster.filter((s) => (attendanceDraft[s.studentId] ?? 'UNMARKED') === 'UNMARKED').length

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      // Attendance the teacher actually marked (current roster). UNMARKED students are dropped:
      // no row is written, so "not recorded" never masquerades as "present".
      const rosterEntries = roster
        .map((s) => ({ studentId: s.studentId, status: attendanceDraft[s.studentId] ?? 'UNMARKED' }))
        .filter((e): e is { studentId: number; status: AttendanceStatus } => e.status !== 'UNMARKED')
      // … plus preserved records for anyone already on the log but NOT in the current
      // roster (e.g. a student who left the class, or a stale/empty roster) so an edit
      // never silently wipes their attendance.
      const rosterIds = new Set(roster.map((s) => s.studentId))
      const preserved = editingLog
        ? editingLog.attendance
            .filter((a) => !rosterIds.has(a.studentId))
            .map((a) => ({ studentId: a.studentId, status: a.status }))
        : []

      const payload: LessonLogRequest = {
        sessionDate,
        sessionNumber: sessionNumber.trim() ? Number(sessionNumber) : null,
        topic: topic.trim() ? topic.trim() : null,
        homework: homework.trim() ? homework.trim() : null,
        note: note.trim() ? note.trim() : null,
        attendance: [...rosterEntries, ...preserved],
        lessonId: lessonId ? Number(lessonId) : null,
      }
      if (editingLog) {
        const updated = await updateLessonLog(classId, editingLog.id, payload)
        onLessonLogsChange((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      } else {
        const created = await createLessonLog(classId, payload)
        onLessonLogsChange((prev) => [...prev, created])
      }
      closeForm()
    } catch {
      toast.error(t('attendance.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (log: ClassLessonLog): Promise<void> => {
    if (typeof window !== 'undefined' && !window.confirm(t('attendance.deleteConfirm'))) return
    setDeletingId(log.id)
    try {
      await deleteLessonLog(classId, log.id)
      onLessonLogsChange((prev) => prev.filter((l) => l.id !== log.id))
      // If the row being edited was just deleted, close the form so a later Save can't
      // PUT to a now-missing id.
      if (editingLog?.id === log.id) closeForm()
    } catch {
      toast.error(t('attendance.deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpanded = (logId: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="ga-ui text-[13px] text-ga-muted">{t('attendance.countLabel', { count: lessonLogs.length })}</span>
        <div className="flex items-center gap-2">
          {lessonLogs.length > 0 && (
            <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
              <FileDown size={14} /> {t('attendance.exportPdf')}
            </GaBtn>
          )}
          <GaBtn variant="yellow" size="sm" onClick={openAddForm} disabled={saving}>
            <Plus size={14} /> {t('attendance.addLog')}
          </GaBtn>
        </div>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-ga-line bg-ga-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-ga-display text-[16px] font-medium text-ga-ink">
              {editingLog ? t('attendance.formTitleEdit') : t('attendance.formTitleNew')}
            </h3>
            <button type="button" aria-label={tc('cancel')} onClick={closeForm} className={iconBtnCls}>
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="lesson-log-session-date">{t('attendance.sessionDateLabel')}</label>
              <input
                id="lesson-log-session-date"
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('attendance.sessionNumberLabel')}</label>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                placeholder={t('attendance.sessionNumberPlaceholder')}
                className={fieldCls}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className={labelCls}>{t('attendance.topicLabel')}</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('attendance.topicPlaceholder')} className={fieldCls} />
          </div>

          {lessons.length > 0 && (
            <div className="mt-3">
              <label className={labelCls}>{t('attendance.lessonLabel')}</label>
              <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className={fieldCls}>
                <option value="">{t('attendance.lessonNone')}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3">
            <label className={labelCls}>{t('attendance.homeworkLabel')}</label>
            <input type="text" value={homework} onChange={(e) => setHomework(e.target.value)} placeholder={t('attendance.homeworkPlaceholder')} className={fieldCls} />
          </div>

          <div className="mt-3">
            <label className={labelCls}>{t('attendance.noteLabel')}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} />
          </div>

          {roster.length === 0 && printRoster.length > 0 && (
            <div className="mt-4 border border-ga-gold/40 bg-ga-gold/5 px-3 py-2.5">
              <p className="ga-ui text-[12.5px] leading-relaxed text-ga-muted">
                {t('attendance.rosterUnavailable')}
              </p>
            </div>
          )}

          {roster.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <label className={`${labelCls} mb-0`}>{t('attendance.attendanceLabel')}</label>
                <div className="flex items-center gap-2.5">
                  {unmarkedCount > 0 && (
                    <span className="ga-ui text-[12px] font-semibold text-ga-muted">
                      {t('attendance.unmarkedCount', { count: unmarkedCount })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="ga-ui border border-ga-line px-2 py-1 text-[11.5px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent"
                  >
                    {t('attendance.markAllPresent')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {roster.map((s) => {
                  const status = attendanceDraft[s.studentId] ?? 'UNMARKED'
                  return (
                    <div key={s.studentId} className="flex items-center gap-2 border border-ga-line bg-ga-bg px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ga-ink">{s.name}</span>
                      <select
                        aria-label={s.name}
                        value={status}
                        onChange={(e) => setStudentStatus(s.studentId, e.target.value as DraftStatus)}
                        className={status === 'UNMARKED' ? `${selectCls} text-ga-subtle` : selectCls}
                      >
                        <option value="UNMARKED">{t('attendance.statusUnmarked')}</option>
                        <option value="PRESENT">{t('attendance.statusPresent')}</option>
                        <option value="LATE">{t('attendance.statusLate')}</option>
                        <option value="ABSENT">{t('attendance.statusAbsent')}</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <GaBtn type="button" variant="ghost" size="sm" onClick={closeForm} disabled={saving}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {tc('save')}
            </GaBtn>
          </div>
        </form>
      )}

      {lessonLogs.length === 0 && !formOpen && (
        <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
          {t('attendance.empty')}
        </div>
      )}

      {lessonLogs.length > 0 && (
        <div className="border border-ga-line bg-ga-card">
          {lessonLogs.map((log, i) => {
            const counts = attendanceCounts(log.attendance)
            const expanded = expandedIds.has(log.id)
            const dateLabel = format(new Date(log.sessionDate), 'dd/MM/yyyy')
            const summaryLabel = log.sessionNumber != null
              ? `${t('attendance.sessionLabel', { number: log.sessionNumber })} · ${dateLabel}`
              : dateLabel
            return (
              <div key={log.id} style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ga-ink">{summaryLabel}</span>
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--ga-green)' }}>
                        {t('attendance.presentCount', { count: counts.present })}
                      </span>
                      {counts.absent > 0 && (
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--ga-red)' }}>
                          {t('attendance.absentCount', { count: counts.absent })}
                        </span>
                      )}
                      {counts.late > 0 && (
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--ga-gold)' }}>
                          {t('attendance.lateCount', { count: counts.late })}
                        </span>
                      )}
                    </div>
                    {log.lessonTitle && (
                      <span className="ga-ui mt-0.5 inline-block rounded-ga px-1.5 text-[10px] font-bold" style={{ background: 'var(--ga-violet-soft)', color: 'var(--ga-violet)' }}>
                        {log.lessonTitle}
                      </span>
                    )}
                    {log.topic && <p className="mt-0.5 truncate text-[12.5px] text-ga-muted">{log.topic}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label={t('attendance.edit')} onClick={() => openEditForm(log)} disabled={saving} className={`${iconBtnCls} disabled:pointer-events-none disabled:opacity-40`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('attendance.delete')}
                      onClick={() => handleDelete(log)}
                      disabled={deletingId === log.id}
                      className={deleteBtnCls}
                    >
                      {deletingId === log.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                    <button
                      type="button"
                      aria-label={expanded ? t('attendance.collapse') : t('attendance.expand')}
                      onClick={() => toggleExpanded(log.id)}
                      className={iconBtnCls}
                    >
                      {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-ga-line bg-ga-bg px-4 py-3">
                    {log.homework && (
                      <p className="text-[12.5px] text-ga-ink">
                        <span className="font-semibold">{t('attendance.homeworkPrefix')}</span>
                        {log.homework}
                      </p>
                    )}
                    {log.note && (
                      <p className="mt-1 text-[12.5px] text-ga-ink">
                        <span className="font-semibold">{t('attendance.notePrefix')}</span>
                        {log.note}
                      </p>
                    )}
                    {log.attendance.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {log.attendance.map((a) => (
                          <TkBadge key={a.studentId} tone={attendanceTone(a.status)} variant="soft">
                            {a.name}
                          </TkBadge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lessonLogs.length > 0 && (
        <div className="hidden print:block">
          <div className="print-area">
            <ReportPrintHeader
              title={t('attendance.printTitle')}
              metaLine={classDisplayName ? t('classLabel', { name: classDisplayName }) : undefined}
              exportedAtLabel={t('exportedAt', { date: format(new Date(), 'dd/MM/yyyy') })}
            />

            <div className="mb-6">
              <GaCap className="mb-2">{t('attendance.printAttendanceHeading')}</GaCap>
              <div className="overflow-x-auto border border-ga-line">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-ga-side-active">
                      <th className="border border-ga-line px-2 py-1.5 text-left font-bold text-ga-ink" />
                      {lessonLogs.map((log) => (
                        <th key={log.id} className="border border-ga-line px-1.5 py-1.5 text-center font-semibold text-ga-ink">
                          <div>{log.sessionNumber != null ? t('attendance.sessionLabel', { number: log.sessionNumber }) : ''}</div>
                          <div className="font-normal text-ga-muted">{format(new Date(log.sessionDate), 'dd/MM/yyyy')}</div>
                        </th>
                      ))}
                      <th className="border border-ga-line px-2 py-1.5 text-center font-bold text-ga-ink">{t('attendance.printAbsentColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printRoster.map((s) => {
                      const absentTotal = lessonLogs.reduce((totalAbsent, log) => {
                        const entry = log.attendance.find((a) => a.studentId === s.studentId)
                        return entry && normalizeAttendanceStatus(entry.status) === 'ABSENT' ? totalAbsent + 1 : totalAbsent
                      }, 0)
                      return (
                        <tr key={s.studentId} className="bg-ga-card">
                          <td className="border border-ga-line px-2 py-1.5 font-medium text-ga-ink">{s.name}</td>
                          {lessonLogs.map((log) => {
                            const entry = log.attendance.find((a) => a.studentId === s.studentId)
                            const { glyph, color } = glyphAndColor(entry)
                            return (
                              <td key={log.id} className="border border-ga-line px-1.5 py-1.5 text-center font-bold" style={{ color }}>
                                {glyph}
                              </td>
                            )
                          })}
                          <td className="border border-ga-line px-2 py-1.5 text-center font-bold" style={{ color: 'var(--ga-red)' }}>
                            {absentTotal > 0 ? absentTotal : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <GaCap className="mb-2">{t('attendance.printLogHeading')}</GaCap>
              <div className="overflow-x-auto border border-ga-line">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-ga-side-active">
                      <th className="border border-ga-line px-2 py-1.5 text-center font-bold text-ga-ink">{t('attendance.printSessionColumn')}</th>
                      <th className="border border-ga-line px-2 py-1.5 text-center font-bold text-ga-ink">{t('attendance.printDateColumn')}</th>
                      <th className="border border-ga-line px-3 py-1.5 text-left font-bold text-ga-ink">{t('attendance.printTopicColumn')}</th>
                      <th className="border border-ga-line px-3 py-1.5 text-left font-bold text-ga-ink">{t('attendance.printHomeworkColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessonLogs.map((log) => (
                      <tr key={log.id} className="bg-ga-card">
                        <td className="border border-ga-line px-2 py-1.5 text-center text-ga-ink">{log.sessionNumber ?? ''}</td>
                        <td className="border border-ga-line px-2 py-1.5 text-center text-ga-ink">{format(new Date(log.sessionDate), 'dd/MM/yyyy')}</td>
                        <td className="border border-ga-line px-3 py-1.5 text-ga-ink">{log.topic ?? ''}</td>
                        <td className="border border-ga-line px-3 py-1.5 text-ga-ink">{log.homework ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 hidden justify-between text-[11px] text-ga-muted print:flex">
              <span>{t('attendance.printTeacherSign')}</span>
              <span>{t('attendance.printHeadSign')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
