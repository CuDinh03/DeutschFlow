'use client'

// Per-lesson materials, student side (read-only). Lazy-loads on first expand so the lesson list
// doesn't fire one request per lesson up front. The teacher attaches materials in tc-checklist; this
// is the ONLY place a student can read them — the /v2/materials surface is teacher/admin-gated, so
// access here is by enrollment (enforced server-side), and the student can view/open but not change.

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, ChevronRight, FileText, Music, Video, Image as ImageIcon, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { fetchLessonMaterials, fetchLessonMaterialUrl } from '@/lib/studentClassesApi'
import type { Material, MaterialKind } from '@/lib/materialApi'

const KIND_ICON: Record<MaterialKind, typeof FileText> = {
  PDF: FileText, DOCX: FileText, PPTX: FileText, OTHER: FileText,
  AUDIO: Music, VIDEO: Video, IMAGE: ImageIcon, LINK: LinkIcon,
}

/** mm:ss for an audio/video duration. */
function fmtDuration(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LessonMaterials({ lessonId }: { lessonId: number }) {
  const t = useTranslations('v2.student.classDetail.materials')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Material[]>([])
  const [opening, setOpening] = useState<number | null>(null)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      try {
        setItems(await fetchLessonMaterials(lessonId))
        setLoaded(true)
      } catch (e) {
        toast.error(apiMessage(e) || t('loadError'))
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }
  }

  // Re-sign the URL right before opening: the one from the list is a presigned GET that expires (~1h),
  // so a student who opened the tab this morning would otherwise hit an expired-link error.
  const openMaterial = async (m: Material) => {
    setOpening(m.id)
    try {
      const fresh = await fetchLessonMaterialUrl(lessonId, m.id)
      window.open(fresh, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(apiMessage(e) || t('openError'))
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="ga-ui inline-flex min-h-[40px] items-center gap-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:text-ga-accent lg:min-h-0"
      >
        <ChevronRight size={13} className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
        <Paperclip size={13} /> {t('heading')}
      </button>

      {open && (
        <div className="mt-1.5 pl-[18px]">
          {loading ? (
            <span className="ga-ui inline-flex items-center gap-1.5 text-[12px] text-ga-subtle">
              <Loader2 size={13} className="animate-spin" /> {t('loading')}
            </span>
          ) : items.length === 0 ? (
            <p className="ga-ui text-[12px] text-ga-subtle">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((m) => {
                const Icon = KIND_ICON[m.kind] ?? FileText
                const dur = fmtDuration(m.durationSeconds)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => openMaterial(m)}
                      disabled={opening === m.id}
                      className="ga-ui flex min-h-[40px] w-full items-center gap-2 rounded-ga border border-ga-line bg-ga-bg px-2.5 py-1.5 text-left text-[12.5px] text-ga-ink transition-colors hover:border-ga-accent disabled:opacity-60 lg:min-h-0"
                    >
                      <Icon size={14} className="shrink-0 text-ga-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                      {dur && <span className="ga-ui shrink-0 text-[11px] text-ga-subtle">{dur}</span>}
                      {opening === m.id
                        ? <Loader2 size={13} className="shrink-0 animate-spin text-ga-subtle" />
                        : <ExternalLink size={13} className="shrink-0 text-ga-subtle" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
