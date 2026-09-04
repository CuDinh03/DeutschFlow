'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { listAllTeacherStudents, type RosterStudent } from '@/lib/teacherMessagingApi'
import { GaBtn, TkModal, TkSearch, LoadingState } from '@/components/ui-v2'

const initial = (n: string) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

interface ComposePickerProps {
  /** Open (or start) a 1-1 thread with the chosen student. */
  onPick: (studentId: number, name: string) => void
}

/**
 * "+ Nhắn học viên" — a compose button that opens a searchable roster of every student across the
 * teacher's classes and starts a direct thread with the chosen one. The roster loads lazily on
 * first open. Rendered inside the inbox's conversation-list header.
 */
export function ComposePicker({ onPick }: ComposePickerProps) {
  // A6/F13: chuỗi Việt hardcode cuối cùng của inbox — về i18n như phần còn lại của /v2.
  const t = useTranslations('v2.teacher.composePicker')
  const [open, setOpen] = useState(false)
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  // Lazy-load the roster the first time the picker opens.
  useEffect(() => {
    if (!open || loaded) return
    let cancelled = false
    setLoading(true)
    listAllTeacherStudents()
      .then((list) => {
        if (cancelled) return
        setStudents(list)
        setLoaded(true)
        setError('')
      })
      .catch((e: unknown) => !cancelled && setError(apiMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, loaded])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    )
  }, [students, query])

  const pick = (s: RosterStudent) => {
    onPick(s.studentId, s.displayName)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <GaBtn variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={14} /> {t('trigger')}
      </GaBtn>

      <TkModal
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        description={t('description')}
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <TkSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />

          {loading ? (
            <LoadingState label={t('loadingRoster')} />
          ) : error ? (
            <p className="ga-ui py-6 text-center text-[13px] text-ga-red">{error}</p>
          ) : rows.length === 0 ? (
            <p className="ga-ui py-8 text-center text-[13px] text-ga-muted">
              {students.length === 0 ? t('emptyNoStudents') : t('emptyNoMatch')}
            </p>
          ) : (
            <div className="-mx-1 max-h-[52vh] overflow-y-auto">
              {rows.map((s) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-center gap-3 rounded-ga px-2 py-2.5 text-left transition-colors hover:bg-ga-surface"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ga-accent-soft text-[13px] font-bold text-ga-accent">
                    {initial(s.displayName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ga-ink">{s.displayName}</span>
                    <span className="block truncate text-[12px] text-ga-muted">
                      {s.email || '—'}
                      {s.classNames.length > 0 && <span className="text-ga-subtle"> · {s.classNames.join(', ')}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </TkModal>
    </>
  )
}
