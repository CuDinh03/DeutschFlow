'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import type { ClassLesson } from '@/lib/teacherLessonsApi'

// Shared helpers for the per-class course screens (tc-checklist + tc-progress + tc-reports).

export interface TeacherClass {
  id: number
  name: string
}

/**
 * Loads the teacher's classes and tracks the selected class id — kept in the URL (`?classId=`).
 *
 * The three per-class screens (tiến độ / nội dung / báo cáo) used to hold the selection in local state
 * only, each defaulting to the FIRST class. So navigating "Xem báo cáo đầy đủ" from class B landed you on
 * class A's report, and every screen change reset the picker. Sourcing it from the URL keeps the class
 * across those jumps, makes it bookmarkable/shareable, and lets one page deep-link another (see
 * {@link classHref}).
 */
export function useTeacherClasses() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlClassId = searchParams.get('classId')

  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [classId, setClassIdState] = useState<number | null>(urlClassId ? Number(urlClassId) : null)
  const [loadingClasses, setLoadingClasses] = useState(true)

  useEffect(() => {
    let active = true
    api
      .get('/v2/teacher/classes')
      .then((res) => {
        if (!active) return
        const list = ((res.data ?? []) as Record<string, unknown>[]).map((c) => ({ id: Number(c.id), name: String(c.name ?? `Lớp #${c.id}`) }))
        setClasses(list)
        // Honour a valid ?classId= from the URL; otherwise fall back to the first class.
        setClassIdState((prev) => {
          const fromUrl = urlClassId ? Number(urlClassId) : null
          if (fromUrl != null && list.some((c) => c.id === fromUrl)) return fromUrl
          return prev ?? list[0]?.id ?? null
        })
      })
      .catch(() => { /* surfaced by the lessons fetch */ })
      .finally(() => { if (active) setLoadingClasses(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selecting a class writes it to the URL so a later screen change (or reload) keeps it.
  const setClassId = useCallback((id: number) => {
    setClassIdState(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('classId', String(id))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  return { classes, classId, setClassId, loadingClasses }
}

/** Build a link to a per-class screen that carries the class id, so it opens on the same class. */
export function classHref(path: string, classId: number | null): string {
  return classId == null ? path : `${path}?classId=${classId}`
}

/** Course completion percentage from a flat lesson list. */
export function pct(lessons: { completed: boolean }[]): number {
  if (lessons.length === 0) return 0
  return Math.round((lessons.filter((l) => l.completed).length / lessons.length) * 100)
}

/** Styled class selector (matches Galerie tokens). */
export function ClassPicker({
  classes,
  classId,
  onChange,
  disabled,
}: {
  classes: TeacherClass[]
  classId: number | null
  onChange: (id: number) => void
  disabled?: boolean
}) {
  return (
    <div className="relative max-w-full">
      <select
        value={classId ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled || classes.length === 0}
        className="ga-ui min-h-[40px] max-w-full appearance-none border border-ga-line bg-ga-card py-2 pl-3.5 pr-9 text-[13px] font-semibold text-ga-ink outline-none focus:border-ga-accent disabled:opacity-60 lg:min-h-0"
      >
        {classes.length === 0 ? <option value="">Chưa có lớp</option> : classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ga-muted" />
    </div>
  )
}

export type { ClassLesson }
