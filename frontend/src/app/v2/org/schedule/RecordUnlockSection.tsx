'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { grantRecordUnlock, listActiveRecordUnlocks, type RecordUnlock } from '@/lib/sessionWorkspaceApi'
import { listClasses, type OrgClass, type OrgClassDetail } from '@/lib/orgApi'
import { GaBtn, GaCap } from '@/components/ui-v2'

const inputCls =
  'rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[13px] text-ga-ink outline-none focus:border-ga-accent'

/**
 * Cấp MỞ KHÓA sửa hồi tố (PR-7, P07): bản ghi buổi quá cửa sổ 7 ngày chỉ sửa được khi người
 * duyệt học vụ cấp mở khóa 24h (lý do bắt buộc — chính bản ghi là audit). Quyền thật kiểm ở BE
 * theo từng lớp (assertAcademicApprover) — người không có quyền sẽ nhận lỗi khi cấp.
 */
export function RecordUnlockSection() {
  const t = useTranslations('v2.org.schedule.unlocks')
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [classId, setClassId] = useState<number | null>(null)
  const [teachers, setTeachers] = useState<OrgClassDetail['teachers']>([])
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [active, setActive] = useState<RecordUnlock[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    listClasses(0, 100)
      .then((page) => {
        setClasses(page.content)
        setClassId((prev) => prev ?? page.content[0]?.id ?? null)
      })
      .catch((e: unknown) => toast.error(apiMessage(e)))
  }, [open])

  const loadClassContext = useCallback(async (cid: number) => {
    try {
      const [detail, unlocks] = await Promise.all([
        api.get<OrgClassDetail>(`/org/classes/${cid}`).then((r) => r.data),
        listActiveRecordUnlocks(cid).catch(() => [] as RecordUnlock[]),
      ])
      setTeachers(detail.teachers)
      setTeacherId(detail.teachers[0]?.teacherId ?? null)
      setActive(unlocks)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    }
  }, [])

  useEffect(() => { if (open && classId != null) void loadClassContext(classId) }, [open, classId, loadClassContext])

  const grant = async () => {
    if (classId == null || teacherId == null) return
    if (!reason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    setBusy(true)
    try {
      await grantRecordUnlock({ classId, teacherId, reason: reason.trim() })
      toast.success(t('grantSuccess'))
      setReason('')
      await loadClassContext(classId)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={t('heading')} className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ga-ui flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ga-muted hover:text-ga-ink"
        aria-expanded={open}
      >
        <LockOpen size={13} /> {t('heading')} {open ? '▾' : '▸'}
      </button>

      {open && (
        <div className="mt-2.5 border border-ga-line bg-ga-card p-4">
          <p className="ga-ui m-0 mb-3 text-[12.5px] leading-[1.5] text-ga-muted">{t('hint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={t('classLabel')} value={classId ?? ''} onChange={(e) => setClassId(Number(e.target.value))} className={inputCls}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label={t('teacherLabel')} value={teacherId ?? ''} onChange={(e) => setTeacherId(Number(e.target.value))} className={inputCls}>
              {teachers.map((tc) => (
                <option key={tc.teacherId} value={tc.teacherId}>
                  {tc.displayName ?? tc.email ?? `GV #${tc.teacherId}`}{tc.role === 'PRIMARY' ? ` · ${t('primary')}` : ''}
                </option>
              ))}
            </select>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className={`${inputCls} min-w-0 flex-1`}
            />
            <GaBtn variant="primary" size="sm" disabled={busy || !reason.trim() || teacherId == null} onClick={grant}>
              {t('grant')}
            </GaBtn>
          </div>

          {active.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 border-t border-ga-line pt-2.5 p-0">
              {active.map((u) => (
                <li key={u.id} className="ga-ui text-[12.5px] text-ga-muted">
                  {t('activeLine', {
                    teacher: teachers.find((tc) => tc.teacherId === u.grantedTo)?.displayName ?? `GV #${u.grantedTo}`,
                    expires: format(new Date(u.expiresAt), 'dd/MM HH:mm'),
                    reason: u.reason,
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
