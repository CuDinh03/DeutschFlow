'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { assignClassTeacher, listClasses, type OrgClass, type OrgMember } from '@/lib/orgApi'
import { TkModal, GaBtn, ErrorBanner, TkSearch } from '@/components/ui-v2'

/**
 * Org-admin (OWNER/MANAGER) giao lớp cho một giáo viên (nút "Phân công" trang GV).
 * Liệt kê lớp của org (PATCH /org/classes/{id}/teacher); lớp đang có GV khác sẽ được
 * CHUYỂN sang GV này (backend thay PRIMARY trong class_teachers, giữ ASSISTANT).
 */
export function AssignClassModal({
  teacher,
  onClose,
  onAssigned,
}: {
  teacher: OrgMember
  onClose: () => void
  onAssigned: () => void
}) {
  const t = useTranslations('v2.org.teachers.assignModal')
  const [classes, setClasses] = useState<OrgClass[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    listClasses(0, 100)
      .then((page) => { if (alive) { setClasses(page.content ?? []); setError('') } })
      .catch((e: unknown) => { if (alive) setError(apiMessage(e)) })
    return () => { alive = false }
  }, [])

  const rows = useMemo(
    () => (classes ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [classes, query],
  )

  const assign = async (cls: OrgClass) => {
    setBusy(cls.id)
    try {
      const updated = await assignClassTeacher(cls.id, teacher.userId)
      setClasses((cur) => (cur ?? []).map((c) => (c.id === updated.id ? updated : c)))
      toast.success(t('success', { className: cls.name }))
      onAssigned()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('title')}
      description={t('description', { name: teacher.displayName || teacher.email || '' })}
      footer={<GaBtn variant="ghost" onClick={onClose}>{t('close')}</GaBtn>}
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="mb-3 w-full" />

      {classes == null && !error ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer h-[52px] border border-ga-line" aria-hidden />)}</div>
      ) : rows.length === 0 ? (
        <p className="ga-ui border border-dashed border-ga-line px-4 py-6 text-center text-[13px] text-ga-muted">
          {(classes ?? []).length === 0 ? t('emptyOrg') : t('emptySearch')}
        </p>
      ) : (
        <ul className="flex max-h-[320px] flex-col overflow-y-auto border border-ga-line">
          {rows.map((c, i) => {
            const isCurrent = c.teacherId === teacher.userId
            return (
              <li key={c.id} className="flex items-center gap-3 bg-ga-card px-4 py-3" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-ga-ink">{c.name}</div>
                  <div className="ga-ui mt-0.5 text-[11.5px] text-ga-muted">
                    {isCurrent ? t('statusCurrent') : c.teacherId == null ? t('statusUnassigned') : t('statusTaken')}
                  </div>
                </div>
                {isCurrent ? (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>
                    {t('currentBadge')}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => assign(c)}
                    className="ga-ui inline-flex min-h-[36px] shrink-0 items-center justify-center border border-ga-line px-3 py-1.5 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-50"
                  >
                    {busy === c.id ? t('assigning') : t('assignBtn')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </TkModal>
  )
}
