'use client'

// Library materials the teacher handed out with this assignment (student side, read-only). The teacher
// picks them in the "giao bài tập" modal; this is the ONLY place a student reaches them — the
// /v2/materials surface is teacher/admin-gated, so access here is by having been GIVEN the assignment
// (enforced server-side). The student can view/open but not change.

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, FileText, Music, Video, Image as ImageIcon, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { fetchAssignmentMaterials, fetchAssignmentMaterialUrl } from '@/lib/studentClassesApi'
import type { Material, MaterialKind } from '@/lib/materialApi'
import { GaCap } from '@/components/ui-v2'

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

export function AssignmentMaterials({ assignmentId }: { assignmentId: number }) {
  const t = useTranslations('v2.student.assignment.materials')
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAssignmentMaterials(assignmentId)
      .then((m) => { if (active) setItems(m) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assignmentId])

  // Re-sign the URL right before opening: the one from the list is a presigned GET that expires (~1h),
  // so a student who opened the tab this morning would otherwise hit an expired-link error.
  const open = async (m: Material) => {
    setOpening(m.id)
    try {
      const fresh = await fetchAssignmentMaterialUrl(assignmentId, m.id)
      window.open(fresh, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(apiMessage(e) || t('openError'))
    } finally {
      setOpening(null)
    }
  }

  if (loading) {
    return (
      <div className="border border-ga-line bg-ga-card px-6 py-[22px]">
        <GaCap className="mb-3 block">{t('heading')}</GaCap>
        <span className="ga-ui inline-flex items-center gap-1.5 text-[13px] text-ga-subtle">
          <Loader2 size={14} className="animate-spin" /> {t('loading')}
        </span>
      </div>
    )
  }
  if (items.length === 0) return null

  return (
    <div className="border border-ga-line bg-ga-card px-6 py-[22px]">
      <GaCap className="mb-3 block">{t('heading')}</GaCap>
      <ul className="flex flex-col gap-1.5">
        {items.map((m) => {
          const Icon = KIND_ICON[m.kind] ?? FileText
          const dur = fmtDuration(m.durationSeconds)
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => open(m)}
                disabled={opening === m.id}
                className="ga-ui flex w-full items-center gap-2.5 rounded-ga border border-ga-line bg-ga-bg px-3.5 py-2.5 text-left text-[14px] text-ga-ink transition-colors hover:border-ga-accent disabled:opacity-60"
              >
                <Icon size={15} className="shrink-0 text-ga-muted" />
                <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                <span className="ga-ui shrink-0 text-[10px] font-bold uppercase text-ga-subtle">{m.kind}</span>
                {dur && <span className="ga-ui shrink-0 text-[11px] text-ga-subtle">{dur}</span>}
                {opening === m.id
                  ? <Loader2 size={14} className="shrink-0 animate-spin text-ga-subtle" />
                  : <ExternalLink size={14} className="shrink-0 text-ga-subtle" />}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="ga-ui mt-2.5 flex items-center gap-1.5 text-[12px] text-ga-subtle">
        <Paperclip size={12} /> {t('hint')}
      </p>
    </div>
  )
}
