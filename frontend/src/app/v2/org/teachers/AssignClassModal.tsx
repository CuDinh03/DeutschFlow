'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  addOrgClassAssistant, assignClassTeacher, getOrgTeacherClasses, listClasses,
  type OrgClass, type OrgMember,
} from '@/lib/orgApi'
import { TkModal, GaBtn, ErrorBanner, TkSearch } from '@/components/ui-v2'

/**
 * Org-admin (OWNER/MANAGER) giao lớp cho một giáo viên (nút "Phân công" trang GV).
 * Hai hành động mỗi lớp (PR C trợ giảng): "Giao phụ trách" (PATCH — GV hiện tại HẠ vai
 * thành trợ giảng, không rời lớp) và "Thêm trợ giảng" (POST /org/classes/{id}/teachers).
 * Vai trợ giảng của GV này suy từ GET /org/teachers/{id}/classes (lớp tham gia nhưng
 * không phụ trách) — backend không trả role ở đây nên so với teacherId của lớp.
 */

type RowState = 'primary' | 'assistant' | 'unassigned' | 'taken'

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
  const [memberIds, setMemberIds] = useState<Set<number> | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([listClasses(0, 100), getOrgTeacherClasses(teacher.userId)])
      .then(([page, mine]) => {
        if (!alive) return
        setClasses(page.content ?? [])
        setMemberIds(new Set(mine.map((c) => c.id)))
        setError('')
      })
      .catch((e: unknown) => { if (alive) setError(apiMessage(e)) })
    return () => { alive = false }
  }, [teacher.userId])

  const rows = useMemo(
    () => (classes ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [classes, query],
  )

  const stateOf = (c: OrgClass): RowState => {
    if (c.teacherId === teacher.userId) return 'primary'
    if (memberIds?.has(c.id)) return 'assistant'
    return c.teacherId == null ? 'unassigned' : 'taken'
  }

  const assignPrimary = async (cls: OrgClass) => {
    setBusy(cls.id)
    try {
      const updated = await assignClassTeacher(cls.id, teacher.userId)
      setClasses((cur) => (cur ?? []).map((c) => (c.id === updated.id ? updated : c)))
      setMemberIds((cur) => { const next = new Set(cur); next.add(cls.id); return next })
      toast.success(t('success', { className: cls.name }))
      onAssigned()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const addAssistant = async (cls: OrgClass) => {
    setBusy(cls.id)
    try {
      await addOrgClassAssistant(cls.id, teacher.userId)
      setMemberIds((cur) => { const next = new Set(cur); next.add(cls.id); return next })
      toast.success(t('assistantAdded', { className: cls.name }))
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

      {(classes == null || memberIds == null) && !error ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer h-[52px] border border-ga-line" aria-hidden />)}</div>
      ) : rows.length === 0 ? (
        <p className="ga-ui border border-dashed border-ga-line px-4 py-6 text-center text-[13px] text-ga-muted">
          {(classes ?? []).length === 0 ? t('emptyOrg') : t('emptySearch')}
        </p>
      ) : (
        <ul className="flex max-h-[320px] flex-col overflow-y-auto border border-ga-line">
          {rows.map((c, i) => {
            const state = stateOf(c)
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2.5 bg-ga-card px-4 py-3 lg:flex-nowrap" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="min-w-0 flex-1 basis-[160px] lg:basis-0">
                  <div className="truncate text-[14px] font-semibold text-ga-ink">{c.name}</div>
                  <div className="ga-ui mt-0.5 text-[11.5px] text-ga-muted">
                    {state === 'primary' ? t('statusCurrent')
                      : state === 'assistant' ? t('statusAssistant')
                      : state === 'unassigned' ? t('statusUnassigned')
                      : t('statusTaken')}
                  </div>
                </div>
                {state === 'primary' ? (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>
                    {t('currentBadge')}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {state === 'assistant' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>
                        {t('assistantBadge')}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => assignPrimary(c)}
                      className="ga-ui inline-flex min-h-[36px] items-center justify-center border border-ga-line px-3 py-1.5 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-50"
                    >
                      {busy === c.id ? t('assigning') : t('assignBtn')}
                    </button>
                    {state !== 'assistant' && (
                      <button
                        type="button"
                        disabled={busy != null}
                        onClick={() => addAssistant(c)}
                        className="ga-ui inline-flex min-h-[36px] items-center justify-center border border-ga-line px-3 py-1.5 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-50"
                      >
                        {t('addAssistantBtn')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </TkModal>
  )
}
