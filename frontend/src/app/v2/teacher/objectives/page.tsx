'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Target, Users } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaBtn, GaCap, GaPageHdr, TkBadge } from '@/components/ui-v2'
import { ClassPicker, useTeacherClasses } from '../tcShared'

// ─────────────────────────────────────────────────────────────────────────────
// Đánh giá theo MỤC TIÊU giáo trình (PR-9, spec §7): ma trận mục tiêu × học viên,
// ô 3 trạng thái bấm-xoay; cột "chờ chấm" trung tính (AC12); gợi ý kèm riêng /
// ôn chung theo ngưỡng trung tâm — là gợi ý, không tự dời giáo trình.
// ─────────────────────────────────────────────────────────────────────────────

interface ObjectiveCol { id: number; lektionId: number; text: string; skillTag: string | null; cefrLevel: string | null }
interface Cell { objectiveId: number; status: 'NOT_ASSESSED' | 'NEEDS_PRACTICE' | 'ACHIEVED'; evidence: string | null }
interface StudentRow { studentId: number; displayName: string; pendingGradingCount: number; cells: Cell[] }
interface Suggestion { objectiveId: number; kind: 'INDIVIDUAL_SUPPORT' | 'GROUP_REVIEW' | 'MIXED'; studentIds: number[]; studentNames: string[]; unassessedCount: number }
interface Matrix { classId: number; objectives: ObjectiveCol[]; students: StudentRow[]; suggestions: Suggestion[] }

const NEXT_STATUS: Record<Cell['status'], Cell['status']> = {
  NOT_ASSESSED: 'ACHIEVED',
  ACHIEVED: 'NEEDS_PRACTICE',
  NEEDS_PRACTICE: 'NOT_ASSESSED',
}

const CELL_STYLE: Record<Cell['status'], { bg: string; fg: string; label: string }> = {
  NOT_ASSESSED: { bg: 'transparent', fg: 'var(--ga-subtle)', label: '—' },
  ACHIEVED: { bg: 'var(--ga-green-soft)', fg: 'var(--ga-green)', label: '✓' },
  NEEDS_PRACTICE: { bg: 'var(--ga-red-soft)', fg: 'var(--ga-red)', label: '!' },
}

export default function V2ObjectiveMatrixPage() {
  const t = useTranslations('v2.teacher.objectives')
  const router = useRouter()
  const { classes, classId, setClassId, loadingClasses } = useTeacherClasses()
  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCell, setSavingCell] = useState<string | null>(null)

  const load = useCallback(async (cid: number) => {
    setLoading(true)
    try {
      const res = await api.get<Matrix>(`/v2/teacher/classes/${cid}/objective-matrix`)
      setMatrix(res.data)
      setError('')
    } catch (e: unknown) {
      setMatrix(null)
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (classId) void load(classId) }, [classId, load])

  // Ô bấm-xoay 3 trạng thái: — → ✓ (đạt) → ! (cần luyện) → —
  const cycle = async (row: StudentRow, cell: Cell) => {
    if (!classId) return
    const key = `${row.studentId}:${cell.objectiveId}`
    setSavingCell(key)
    try {
      const res = await api.post<Matrix>(`/v2/teacher/classes/${classId}/objective-assessments`, {
        studentId: row.studentId,
        objectiveId: cell.objectiveId,
        status: NEXT_STATUS[cell.status],
      })
      setMatrix(res.data)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSavingCell(null)
    }
  }

  // Giao bài củng cố: sang màn lớp với danh sách người nhận prefill (modal giao bài PR-8).
  const assignSupport = (s: Suggestion) => {
    if (!classId) return
    router.push(`/v2/teacher/classes/${classId}?assignStudents=${s.studentIds.join(',')}`)
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={<ClassPicker classes={classes} classId={classId} onChange={setClassId} disabled={loadingClasses} />}
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <div className="ga-shimmer h-[320px] border border-ga-line" aria-hidden />
        ) : error ? (
          <p className="m-0 border border-ga-line bg-ga-card px-4 py-6 text-center text-[13.5px] text-ga-muted">{error}</p>
        ) : !matrix || matrix.objectives.length === 0 ? (
          <p className="m-0 border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted">{t('empty')}</p>
        ) : (
          <>
            {/* Gợi ý hỗ trợ (spec §7) */}
            {matrix.suggestions.length > 0 && (
              <section aria-label={t('suggestionsCap')} className="mb-5">
                <GaCap className="mb-2 block">{t('suggestionsCap')}</GaCap>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {matrix.suggestions.map((s) => {
                    const obj = matrix.objectives.find((o) => o.id === s.objectiveId)
                    return (
                      <li key={s.objectiveId} className="flex flex-wrap items-center gap-2 border border-ga-line bg-ga-card px-3.5 py-2.5">
                        {s.kind === 'GROUP_REVIEW'
                          ? <Users size={14} className="shrink-0" style={{ color: 'var(--ga-orange)' }} />
                          : <Target size={14} className="shrink-0" style={{ color: 'var(--ga-violet)' }} />}
                        <span className="min-w-0 flex-1 text-[13px] text-ga-ink">
                          <strong>{obj?.text}</strong>
                          {' — '}
                          {s.kind === 'GROUP_REVIEW'
                            ? t('groupReview', { count: s.studentIds.length })
                            : t('individualSupport', { names: s.studentNames.join(', ') })}
                          {s.unassessedCount > 0 && (
                            <span className="ml-1.5 text-ga-subtle">{t('unassessedNote', { count: s.unassessedCount })}</span>
                          )}
                        </span>
                        <GaBtn variant="ghost" size="sm" onClick={() => assignSupport(s)}>{t('assignSupport')}</GaBtn>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Ma trận */}
            <div className="overflow-x-auto border border-ga-line bg-ga-card">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="ga-ui sticky left-0 bg-ga-card px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ga-muted">
                      {t('studentCol')}
                    </th>
                    <th className="ga-ui px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ga-muted">
                      {t('pendingCol')}
                    </th>
                    {matrix.objectives.map((o) => (
                      <th key={o.id} className="max-w-[140px] px-2 py-2 text-left align-bottom" title={o.text}>
                        <span className="ga-ui block truncate text-[11px] font-semibold normal-case text-ga-ink">{o.text}</span>
                        {o.skillTag && <span className="ga-ui text-[9.5px] font-bold uppercase text-ga-subtle">{o.skillTag}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.students.map((row) => (
                    <tr key={row.studentId} className="border-t border-ga-line">
                      <td className="sticky left-0 bg-ga-card px-3 py-1.5 font-semibold text-ga-ink">{row.displayName}</td>
                      <td className="px-2 py-1.5">
                        {row.pendingGradingCount > 0 ? (
                          // AC12: chờ chấm là trạng thái TRUNG TÍNH — badge riêng, không phải yếu.
                          <TkBadge tone="yellow">{t('pendingBadge', { count: row.pendingGradingCount })}</TkBadge>
                        ) : (
                          <span className="text-ga-subtle">—</span>
                        )}
                      </td>
                      {row.cells.map((cell) => {
                        const st = CELL_STYLE[cell.status]
                        const key = `${row.studentId}:${cell.objectiveId}`
                        return (
                          <td key={cell.objectiveId} className="px-2 py-1.5">
                            <button
                              type="button"
                              aria-label={t('cellLabel', { name: row.displayName, status: t(`status.${cell.status}`) })}
                              title={cell.evidence ?? t(`status.${cell.status}`)}
                              disabled={savingCell !== null}
                              onClick={() => cycle(row, cell)}
                              className="grid h-8 w-8 place-items-center rounded-ga border text-[13px] font-bold transition-colors disabled:opacity-50"
                              style={{ background: st.bg, color: st.fg, borderColor: 'var(--ga-line)' }}
                            >
                              {savingCell === key ? <Loader2 size={12} className="animate-spin" /> : st.label}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ga-ui mt-2.5 text-[12px] text-ga-subtle">{t('legend')}</p>
          </>
        )}
      </div>
    </div>
  )
}
