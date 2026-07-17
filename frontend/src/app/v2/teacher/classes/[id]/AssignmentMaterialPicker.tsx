'use client'

// Controlled multi-select for picking library materials to hand out with an assignment. Loads the
// teacher's library once; a "+" button opens an in-place browse panel (a small window) that lists the
// teacher's files with a filter, so the teacher can browse and tick several without having to guess a
// search term first. Chosen materials show as chips (click-to-open + remove). The parent owns the
// selection and sends the ids to the create endpoint; the attach happens server-side on create.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, X, Plus, Search, Check, ExternalLink, FileText, Music, Video, Image as ImageIcon, Link as LinkIcon } from 'lucide-react'
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
  const [browseOpen, setBrowseOpen] = useState(false)
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listMaterials()
      .then((lib) => { if (active) setLibrary(lib) })
      .catch(() => { if (active) setLibrary([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // Close the browse panel on outside-click and Escape.
  useEffect(() => {
    if (!browseOpen) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setBrowseOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBrowseOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [browseOpen])

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return library
    return library.filter((m) => m.title.toLowerCase().includes(q) || (m.description ?? '').toLowerCase().includes(q))
  }, [library, query])

  const toggle = (m: Material) => {
    if (selectedIds.has(m.id)) onChange(selected.filter((x) => x.id !== m.id))
    else onChange([...selected, m])
  }
  const remove = (id: number) => onChange(selected.filter((m) => m.id !== id))
  // The list URL is a presigned GET (~1h), used immediately here — open in a new tab to view.
  const open = (m: Material) => { if (m.url) window.open(m.url, '_blank', 'noopener,noreferrer') }

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

      {loading ? (
        <span className="ga-ui inline-flex items-center gap-1.5 text-[12.5px] text-ga-subtle">
          <Loader2 size={13} className="animate-spin" /> {t('materialsLoading')}
        </span>
      ) : library.length === 0 ? (
        <p className="text-[12px] text-ga-subtle">{t('materialsNoLibrary')}</p>
      ) : (
        <div ref={panelRef} className="relative">
          {/* "+" opens the browse window */}
          <button
            type="button"
            onClick={() => { setBrowseOpen((o) => !o); setQuery('') }}
            aria-expanded={browseOpen}
            className="ga-ui flex w-full items-center gap-2 rounded-ga border border-dashed border-ga-line bg-ga-bg px-3.5 py-2.5 text-[13.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
          >
            <Plus size={15} className="shrink-0" />
            {t('materialsBrowse')}
            <span className="ga-ui ml-auto text-[11px] font-normal text-ga-subtle">{library.length}</span>
          </button>

          {/* Browse window: filter + scrollable list of the teacher's files */}
          {browseOpen && (
            <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-ga border border-ga-line bg-ga-card shadow-lg">
              <div className="relative border-b border-ga-line">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ga-subtle" />
                <input
                  autoFocus
                  className="ga-ui w-full bg-transparent py-2.5 pl-9 pr-9 text-[14px] text-ga-ink outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('materialsSearchPlaceholder')}
                />
                <button
                  type="button"
                  aria-label={t('materialsClose')}
                  onClick={() => setBrowseOpen(false)}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-surface hover:text-ga-ink"
                >
                  <X size={14} />
                </button>
              </div>

              {filtered.length === 0 ? (
                <p className="ga-ui flex items-center gap-1.5 px-3.5 py-3 text-[12.5px] text-ga-subtle">
                  <Paperclip size={12} /> {t('materialsNoMatch')}
                </p>
              ) : (
                <ul className="max-h-[240px] overflow-auto py-1">
                  {filtered.map((m) => {
                    const Icon = KIND_ICON[m.kind] ?? FileText
                    const isSel = selectedIds.has(m.id)
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => toggle(m)}
                          className={`ga-ui flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-ga-surface ${isSel ? 'text-ga-accent' : 'text-ga-ink'}`}
                        >
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${isSel ? 'border-ga-accent bg-ga-accent text-white' : 'border-ga-line'}`}>
                            {isSel && <Check size={11} strokeWidth={3} />}
                          </span>
                          <Icon size={14} className="shrink-0 text-ga-subtle" />
                          <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                          <span className="ga-ui shrink-0 text-[10px] font-bold uppercase text-ga-subtle">{m.kind}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
