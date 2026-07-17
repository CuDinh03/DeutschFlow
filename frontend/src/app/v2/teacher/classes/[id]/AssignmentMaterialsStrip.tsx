'use client'

// Shows the library materials attached to one assignment, on the teacher's task list. Lazy-loads its
// own data (one small request per assignment card, only when the tasks tab is rendered) — so the
// teacher can confirm what was handed out and open it in a new tab.

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, ExternalLink, FileText, Music, Video, Image as ImageIcon, Link as LinkIcon } from 'lucide-react'
import { listAssignmentMaterials, type Material, type MaterialKind } from '@/lib/materialApi'

const KIND_ICON: Record<MaterialKind, typeof FileText> = {
  PDF: FileText, DOCX: FileText, PPTX: FileText, OTHER: FileText,
  AUDIO: Music, VIDEO: Video, IMAGE: ImageIcon, LINK: LinkIcon,
}

export function AssignmentMaterialsStrip({ assignmentId }: { assignmentId: number }) {
  const t = useTranslations('v2.teacher.classDetail')
  const [items, setItems] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    listAssignmentMaterials(assignmentId)
      .then((m) => { if (active) setItems(m) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assignmentId])

  if (loading) return <Loader2 size={13} className="mt-2 animate-spin text-ga-subtle" />
  if (items.length === 0) return null

  // The list URL is a presigned GET (~1h), used immediately on click — open in a new tab.
  const open = (m: Material) => { if (m.url) window.open(m.url, '_blank', 'noopener,noreferrer') }

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <Paperclip size={12} className="text-ga-subtle" aria-label={t('materialsCap')} />
      {items.map((m) => {
        const Icon = KIND_ICON[m.kind] ?? FileText
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => open(m)}
            className="ga-ui inline-flex max-w-[220px] items-center gap-1.5 rounded-ga border border-ga-line bg-ga-bg px-2 py-1 text-[11.5px] font-medium text-ga-ink transition-colors hover:border-ga-accent"
          >
            <Icon size={12} className="shrink-0 text-ga-subtle" />
            <span className="truncate">{m.title}</span>
            <ExternalLink size={11} className="shrink-0 text-ga-subtle" />
          </button>
        )
      })}
    </div>
  )
}
