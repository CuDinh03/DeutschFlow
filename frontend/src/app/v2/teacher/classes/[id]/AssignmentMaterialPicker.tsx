'use client'

// Controlled multi-select for picking library materials to hand out with an assignment. Loads the
// teacher's library once, offers a searchable dropdown, and holds the chosen materials as chips (with
// click-to-open + remove). The parent owns the selection and sends the ids to the create endpoint;
// nothing is persisted here — the attach happens server-side when the assignment is created.

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, X, Plus, Search, ExternalLink, FileText, Music, Video, Image as ImageIcon, Link as LinkIcon } from 'lucide-react'
import { listMaterials, type Material, type MaterialKind } from '@/lib/materialApi'
import { GaCap } from '@/components/ui-v2'

const KIND_ICON: Record<MaterialKind, typeof FileText> = {
  PDF: FileText, DOCX: FileText, PPTX: FileText, OTHER: FileText,
  AUDIO: Music, VIDEO: Video, IMAGE: ImageIcon, LINK: LinkIcon,
}

interface AssignmentMaterialPickerProps {
  selected: Material[]
  onChange: (next: Material[]) => void
}

export function AssignmentMaterialPicker({ selected, onChange }: AssignmentMaterialPickerProps) {
  const t = useTranslations('v2.teacher.classDetail')
  const [library, setLibrary] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listMaterials()
      .then((lib) => { if (active) setLibrary(lib) })
      .catch(() => { if (active) setLibrary([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected])
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .filter((m) => !selectedIds.has(m.id))
      .filter((m) => !q || m.title.toLowerCase().includes(q) || (m.description ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [library, selectedIds, query])

  const add = (m: Material) => { onChange([...selected, m]); setQuery('') }
  const remove = (id: number) => onChange(selected.filter((m) => m.id !== id))
  // The list URL is a presigned GET (~1h), used immediately here — open in a new tab to view.
  const open = (m: Material) => { if (m.url) window.open(m.url, '_blank', 'noopener,noreferrer') }

  const inputCls = 'ga-ui w-full border border-ga-line bg-ga-bg py-2.5 pl-9 pr-3 text-[14px] text-ga-ink outline-none focus:border-ga-accent'

  return (
    <div>
      <GaCap className="mb-2 block">{t('materialsCap')}</GaCap>

      {/* Chosen materials */}
      {selected.length > 0 && (
        <ul className="mb-2.5 flex flex-col gap-1.5">
          {selected.map((m) => {
            const Icon = KIND_ICON[m.kind] ?? FileText
            return (
              <li key={m.id} className="flex items-center gap-2 border border-ga-line bg-ga-bg px-2.5 py-2">
                <Icon size={13} className="shrink-0 text-ga-subtle" />
                <button
                  type="button"
                  onClick={() => open(m)}
                  className="ga-ui inline-flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium text-ga-ink hover:underline"
                >
                  <span className="truncate">{m.title}</span>
                  <ExternalLink size={11} className="shrink-0 text-ga-subtle" />
                </button>
                <span className="ga-ui shrink-0 text-[10px] font-bold uppercase text-ga-subtle">{m.kind}</span>
                <button
                  type="button"
                  aria-label={t('materialsRemove')}
                  onClick={() => remove(m.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red"
                >
                  <X size={13} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Search + pick from library */}
      {loading ? (
        <span className="ga-ui inline-flex items-center gap-1.5 text-[12.5px] text-ga-subtle">
          <Loader2 size={13} className="animate-spin" /> {t('materialsLoading')}
        </span>
      ) : library.length === 0 ? (
        <p className="text-[12px] text-ga-subtle">{t('materialsNoLibrary')}</p>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ga-subtle" />
          <input
            className={inputCls}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('materialsSearchPlaceholder')}
          />
          {query.trim() && (
            options.length > 0 ? (
              <ul className="mt-1 max-h-[220px] overflow-auto border border-ga-line bg-ga-card shadow-sm">
                {options.map((m) => {
                  const Icon = KIND_ICON[m.kind] ?? FileText
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => add(m)}
                        className="ga-ui flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ga-ink transition-colors hover:bg-ga-surface"
                      >
                        <Icon size={13} className="shrink-0 text-ga-subtle" />
                        <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                        <span className="ga-ui shrink-0 text-[10px] font-bold uppercase text-ga-subtle">{m.kind}</span>
                        <Plus size={13} className="shrink-0 text-ga-accent" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ga-subtle">
                <Paperclip size={12} /> {t('materialsNoMatch')}
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}
