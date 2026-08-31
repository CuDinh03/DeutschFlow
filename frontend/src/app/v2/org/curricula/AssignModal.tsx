'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listClasses, type OrgClass } from '@/lib/orgApi'
import {
  assignCurriculum,
  getAssignmentImpact,
  getClassCurriculumLink,
  unassignCurriculum,
  type ClassCurriculumLink,
  type CurriculumAssignmentImpact,
  type CurriculumVersionDetail,
} from '@/lib/orgCurriculumApi'
import { GaBtn, TkModal, ConfirmDialog, LoadingState } from '@/components/ui-v2'

/**
 * Gán phiên bản PUBLISHED cho một lớp trung tâm. Trước khi áp dụng luôn hiển thị TÁC ĐỘNG từ
 * backend trong ConfirmDialog (plan §2.11): số bài sẽ sinh/thay, dấu vết chặn (nhật ký, bài tập,
 * bài hoàn thành, sổ năng lực). Gỡ giáo trình cũng đi qua xác nhận cùng dữ liệu tác động.
 */
export function AssignModal({ open, version, onClose, onChanged }: {
  open: boolean
  version: CurriculumVersionDetail
  onClose: () => void
  onChanged: () => void
}) {
  const t = useTranslations('v2.org.curricula')
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [classId, setClassId] = useState<number | null>(null)
  const [link, setLink] = useState<ClassCurriculumLink | null>(null)
  const [impact, setImpact] = useState<CurriculumAssignmentImpact | null>(null)
  const [loadingImpact, setLoadingImpact] = useState(false)
  const [confirmAssign, setConfirmAssign] = useState(false)
  const [confirmUnassign, setConfirmUnassign] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setClassId(null)
    setLink(null)
    setImpact(null)
    setLoadingClasses(true)
    listClasses(0, 100)
      .then((page) => setClasses(page.content))
      .catch((e) => toast.error(apiMessage(e)))
      .finally(() => setLoadingClasses(false))
  }, [open])

  const selectClass = useCallback(async (id: number) => {
    setClassId(id)
    setLink(null)
    setImpact(null)
    setLoadingImpact(true)
    try {
      const [currentLink, nextImpact] = await Promise.all([
        getClassCurriculumLink(id),
        getAssignmentImpact(id, version.id),
      ])
      setLink(currentLink)
      setImpact(nextImpact)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setLoadingImpact(false)
    }
  }, [version.id])

  const selectedClass = classes.find((c) => c.id === classId) ?? null
  const alreadyThisVersion = link?.versionId === version.id

  const impactDetails = (i: CurriculumAssignmentImpact): string[] => {
    const rows = [t('impactLessons', { count: i.generatedLessonCount })]
    if (i.logCount > 0) rows.push(t('impactLogs', { count: i.logCount }))
    if (i.assignmentCount > 0) rows.push(t('impactAssignments', { count: i.assignmentCount }))
    if (i.completedLessonCount > 0) rows.push(t('impactCompleted', { count: i.completedLessonCount }))
    if (i.competencyRecordCount > 0) rows.push(t('impactCompetency', { count: i.competencyRecordCount }))
    rows.push(t('impactNewLessons', { count: version.lektionen.length }))
    return rows
  }

  const doAssign = async (): Promise<void> => {
    if (classId === null) return
    setBusy(true)
    try {
      await assignCurriculum(classId, version.id)
      toast.success(t('assignToast'))
      setConfirmAssign(false)
      onChanged()
      onClose()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const doUnassign = async (): Promise<void> => {
    if (classId === null) return
    setBusy(true)
    try {
      await unassignCurriculum(classId)
      toast.success(t('unassignToast'))
      setConfirmUnassign(false)
      onChanged()
      onClose()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TkModal open={open} onOpenChange={(o) => { if (!o) onClose() }}
      title={t('assignTitle', { name: version.curriculumName, no: version.versionNo })}>
      <div className="flex flex-col gap-3">
        {loadingClasses && <LoadingState variant="skeleton" rows={3} />}
        {!loadingClasses && (
          <label className="flex flex-col gap-1">
            <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">
              {t('assignClassLabel')}
            </span>
            <select
              value={classId ?? ''}
              onChange={(e) => { if (e.target.value) void selectClass(Number(e.target.value)) }}
              className="border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
            >
              <option value="">{t('assignSelectClass')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        {classId !== null && (
          <div className="border border-ga-line bg-ga-bg p-3 text-[13px] leading-relaxed text-ga-ink">
            {loadingImpact && <span className="text-ga-muted">{t('assignLoadingImpact')}</span>}
            {!loadingImpact && (
              <>
                <div>
                  {link
                    ? t('assignCurrent', { name: link.curriculumName, no: link.versionNo })
                    : t('assignNone')}
                </div>
                {impact && !alreadyThisVersion && (
                  <ul className="mt-1.5 list-disc pl-5 text-[12.5px] text-ga-muted">
                    {impactDetails(impact).map((row, i) => <li key={i}>{row}</li>)}
                  </ul>
                )}
                {impact && !impact.canApply && !alreadyThisVersion && (
                  <p className="mt-1.5 font-semibold text-red-700">{t('impactBlocked')}</p>
                )}
                {alreadyThisVersion && <p className="mt-1.5 text-ga-muted">{t('assignAlready')}</p>}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {link && (
            <GaBtn variant="ghost" disabled={busy || loadingImpact || impact?.canApply === false}
              onClick={() => setConfirmUnassign(true)}>
              {t('unassignBtn')}
            </GaBtn>
          )}
          <GaBtn variant="ghost" onClick={onClose}>{t('cancel')}</GaBtn>
          <GaBtn
            disabled={classId === null || loadingImpact || alreadyThisVersion || impact?.canApply === false}
            onClick={() => setConfirmAssign(true)}
          >
            {t('assignOk')}
          </GaBtn>
        </div>
      </div>

      {confirmAssign && impact && selectedClass && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmAssign(false) }}
          title={link ? t('assignConfirmSwitchTitle') : t('assignConfirmTitle')}
          description={t('assignConfirmDesc', {
            name: version.curriculumName, no: version.versionNo, className: selectedClass.name,
          })}
          details={impactDetails(impact)}
          confirmLabel={t('assignOk')}
          cancelLabel={t('cancel')}
          destructive={link != null}
          confirmDisabled={!impact.canApply}
          loading={busy}
          onConfirm={() => void doAssign()}
        />
      )}

      {confirmUnassign && selectedClass && link && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmUnassign(false) }}
          title={t('unassignConfirmTitle')}
          description={t('unassignConfirmDesc', { className: selectedClass.name, name: link.curriculumName })}
          details={impact ? impactDetails(impact) : undefined}
          confirmLabel={t('unassignOk')}
          cancelLabel={t('cancel')}
          confirmDisabled={impact?.canApply === false}
          loading={busy}
          onConfirm={() => void doUnassign()}
        />
      )}
    </TkModal>
  )
}
