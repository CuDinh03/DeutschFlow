'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { format } from 'date-fns'
import { FileDown, Pencil, X, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { GaBtn, GaCap, TkBadge } from '@/components/ui-v2'
import { saveEvaluation, type StudentEvaluation, type StudentEvaluationInput } from '@/lib/teacherEvaluationApi'
import { ReportPrintHeader, SkillBar, SKILL_COLORS } from './reportShared'

export interface EvaluationTabProps {
  classId: number
  evaluations: StudentEvaluation[]
  /** Functional-updater setter (the page passes its raw setState) so a concurrent save
   *  composes on the latest list instead of a stale closure snapshot. */
  onEvaluationsChange: Dispatch<SetStateAction<StudentEvaluation[]>>
}

interface EvaluationFormState {
  skillHoren: string
  skillLesen: string
  skillSchreiben: string
  skillSprechen: string
  teacherComment: string
}

const EMPTY_FORM: EvaluationFormState = {
  skillHoren: '',
  skillLesen: '',
  skillSchreiben: '',
  skillSprechen: '',
  teacherComment: '',
}

type ScoreFieldKey = 'skillHoren' | 'skillLesen' | 'skillSchreiben' | 'skillSprechen'

interface SkillMeta {
  key: 'horen' | 'lesen' | 'schreiben' | 'sprechen'
  field: ScoreFieldKey
  labelKey: string
  color: string
}

const SKILLS: SkillMeta[] = [
  { key: 'horen', field: 'skillHoren', labelKey: 'skillLabels.horen', color: SKILL_COLORS.horen },
  { key: 'lesen', field: 'skillLesen', labelKey: 'skillLabels.lesen', color: SKILL_COLORS.lesen },
  { key: 'schreiben', field: 'skillSchreiben', labelKey: 'skillLabels.schreiben', color: SKILL_COLORS.schreiben },
  { key: 'sprechen', field: 'skillSprechen', labelKey: 'skillLabels.sprechen', color: SKILL_COLORS.sprechen },
]

const FIELD_CLASSES =
  'w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-[13.5px] text-ga-ink outline-none focus:border-ga-accent'

function formFromEvaluation(evaluation: StudentEvaluation): EvaluationFormState {
  return {
    skillHoren: evaluation.skillHoren != null ? String(evaluation.skillHoren) : '',
    skillLesen: evaluation.skillLesen != null ? String(evaluation.skillLesen) : '',
    skillSchreiben: evaluation.skillSchreiben != null ? String(evaluation.skillSchreiben) : '',
    skillSprechen: evaluation.skillSprechen != null ? String(evaluation.skillSprechen) : '',
    teacherComment: evaluation.teacherComment ?? '',
  }
}

function parseScoreInput(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = parseFloat(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function hasComment(evaluation: StudentEvaluation): boolean {
  return evaluation.teacherComment != null && evaluation.teacherComment.trim() !== ''
}

function AttendanceLine({ evaluation }: { evaluation: StudentEvaluation }) {
  const t = useTranslations('v2.teacher.tcReports')
  return (
    <>
      {t('evaluation.attendanceSummary', {
        present: evaluation.presentCount + evaluation.lateCount,
        total: evaluation.totalSessions,
      })}
      {evaluation.absentCount > 0 && t('evaluation.absentSuffix', { count: evaluation.absentCount })}
    </>
  )
}

export function EvaluationTab(props: EvaluationTabProps) {
  const { classId, evaluations, onEvaluationsChange } = props
  const t = useTranslations('v2.teacher.tcReports')
  const tc = useTranslations('v2.common')

  const [editingEval, setEditingEval] = useState<StudentEvaluation | null>(null)
  const [form, setForm] = useState<EvaluationFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openEdit = (evaluation: StudentEvaluation): void => {
    setEditingEval(evaluation)
    setForm(formFromEvaluation(evaluation))
  }

  const closeEdit = (): void => {
    setEditingEval(null)
    setForm(EMPTY_FORM)
  }

  const updateField = (key: keyof EvaluationFormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (): Promise<void> => {
    if (!editingEval) return
    setSaving(true)
    try {
      const payload: StudentEvaluationInput = {
        teacherComment: form.teacherComment.trim() === '' ? null : form.teacherComment.trim(),
        skillHoren: parseScoreInput(form.skillHoren),
        skillLesen: parseScoreInput(form.skillLesen),
        skillSchreiben: parseScoreInput(form.skillSchreiben),
        skillSprechen: parseScoreInput(form.skillSprechen),
      }
      const updated = await saveEvaluation(classId, editingEval.studentId, payload)
      onEvaluationsChange((prev) =>
        prev.map((evaluation) => (evaluation.studentId === updated.studentId ? updated : evaluation)),
      )
      closeEdit()
      toast.success(t('evaluation.saveSuccess'))
    } catch {
      toast.error(t('evaluation.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap lg:gap-4">
        <p className="min-w-0 text-[13px] text-ga-muted">{t('evaluation.helperText')}</p>
        {evaluations.length > 0 && (
          <GaBtn type="button" variant="ghost" size="sm" onClick={() => window.print()}>
            <FileDown size={14} aria-hidden /> {t('evaluation.exportPdf')}
          </GaBtn>
        )}
      </div>

      {editingEval && (
        <div className="mb-4 rounded-ga border border-ga-line bg-ga-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ga-ink">
              {t('evaluation.formTitle', { name: editingEval.name })}
            </h3>
            {/* Vùng chạm 40px trên mobile qua pseudo-element trong suốt (icon 16px giữ nguyên). */}
            <button type="button" onClick={closeEdit} className="relative text-ga-muted after:absolute after:-inset-3 after:content-[''] hover:text-ga-ink lg:after:hidden">
              <X size={16} />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSave()
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SKILLS.map((skill) => (
                <div key={skill.field}>
                  <label className="mb-1 block text-[12px] font-medium text-ga-muted" htmlFor={`eval-${skill.field}`}>
                    {t(skill.labelKey)} {t('evaluation.scoreLabelSuffix')}
                  </label>
                  <input
                    id={`eval-${skill.field}`}
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    placeholder="—"
                    value={form[skill.field]}
                    onChange={(e) => updateField(skill.field, e.target.value)}
                    className={FIELD_CLASSES}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-[12px] font-medium text-ga-muted" htmlFor="eval-comment">
                {t('evaluation.commentLabel')}
              </label>
              <textarea
                id="eval-comment"
                rows={3}
                placeholder={t('evaluation.commentPlaceholder')}
                value={form.teacherComment}
                onChange={(e) => updateField('teacherComment', e.target.value)}
                className={`${FIELD_CLASSES} resize-none`}
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <GaBtn type="button" variant="ghost" size="sm" onClick={closeEdit}>
                {tc('cancel')}
              </GaBtn>
              <GaBtn type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Save size={14} aria-hidden />}{' '}
                {tc('save')}
              </GaBtn>
            </div>
          </form>
        </div>
      )}

      {evaluations.length === 0 ? (
        <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10">
          {t('evaluation.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((evaluation) => (
            <div key={evaluation.studentId} className="rounded-ga border border-ga-line bg-ga-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ga-ink">{evaluation.name}</span>
                    <span className="text-[12px] text-ga-muted">{evaluation.email}</span>
                    {evaluation.certificateEligible && (
                      <TkBadge tone="green" variant="soft">
                        <CheckCircle2 size={11} aria-hidden /> {t('evaluation.certificateEligible')}
                      </TkBadge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {SKILLS.map((skill) => (
                      <div key={skill.key} className="flex items-center gap-1.5">
                        <span className="w-16 shrink-0 text-[12px] text-ga-muted">{t(skill.labelKey)}</span>
                        <SkillBar value={evaluation[skill.field]} color={skill.color} />
                      </div>
                    ))}
                  </div>
                  {evaluation.totalSessions > 0 && (
                    <p className="mt-1.5 text-[12px] text-ga-muted">
                      <AttendanceLine evaluation={evaluation} />
                    </p>
                  )}
                  {hasComment(evaluation) && (
                    <p className="mt-1.5 text-[12px] italic text-ga-muted">“{evaluation.teacherComment}”</p>
                  )}
                </div>
                <GaBtn type="button" variant="ghost" size="sm" onClick={() => openEdit(evaluation)} disabled={saving}>
                  <Pencil size={13} aria-hidden /> {t('evaluation.edit')}
                </GaBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {evaluations.length > 0 && (
        <div className="print-area hidden print:block">
          {evaluations.map((evaluation, idx) => (
            <div key={evaluation.studentId} className={idx > 0 ? 'break-before-page' : undefined}>
              <ReportPrintHeader
                title={t('evaluation.printTitle')}
                metaLine={t('classLabel', { name: evaluation.className })}
                exportedAtLabel={t('exportedAt', { date: format(new Date(), 'dd/MM/yyyy') })}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-ga-line p-3">
                  <GaCap className="mb-2">{t('evaluation.printStudentInfo')}</GaCap>
                  <p className="text-[13px] font-semibold text-ga-ink">{evaluation.name}</p>
                  <p className="text-[12px] text-ga-muted">{evaluation.email}</p>
                  {evaluation.avgScore != null && evaluation.avgScore > 0 && (
                    <p className="mt-1 text-[12px] text-ga-ink">
                      {t('evaluation.printAvgScore', { score: evaluation.avgScore.toFixed(1) })}
                    </p>
                  )}
                  {evaluation.totalSessions > 0 && (
                    <p className="mt-1 text-[12px] text-ga-muted">
                      <AttendanceLine evaluation={evaluation} />
                    </p>
                  )}
                </div>
                <div className="border border-ga-line p-3">
                  <GaCap className="mb-2">{t('evaluation.printSkillHeading')}</GaCap>
                  <div className="space-y-1.5">
                    {SKILLS.map((skill) => (
                      <div key={skill.key} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-[12px] text-ga-muted">{t(skill.labelKey)}</span>
                        <SkillBar value={evaluation[skill.field]} color={skill.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 border border-ga-line p-3">
                <GaCap className="mb-2">{t('evaluation.printCommentHeading')}</GaCap>
                <p className="text-[13px] text-ga-ink">
                  {hasComment(evaluation) ? evaluation.teacherComment : t('evaluation.printNoComment')}
                </p>
              </div>
              {evaluation.certificateEligible && (
                <div className="mt-4 border border-ga-green bg-ga-green-soft p-3 text-[13px] text-ga-ink">
                  {t('evaluation.printCertificateNote')}
                </div>
              )}
              <div className="mt-8 grid grid-cols-2 gap-8">
                <div>
                  <div className="h-10 border-b border-ga-ink" />
                  <p className="mt-1 text-center text-[12px] text-ga-muted">{t('evaluation.printTeacherSign')}</p>
                </div>
                <div>
                  <div className="h-10 border-b border-ga-ink" />
                  <p className="mt-1 text-center text-[12px] text-ga-muted">{t('evaluation.printHeadSign')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
