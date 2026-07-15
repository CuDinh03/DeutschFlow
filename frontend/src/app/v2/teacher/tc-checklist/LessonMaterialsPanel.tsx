'use client'

// Per-lesson materials (Phase 1d-D2): attach/detach persisted teaching materials to a lesson.
// Self-contained (fetches its own data) so the tc-checklist editor stays lean. Rendered inside a
// lesson's edit form; attach/detach persist immediately (independent of the lesson metadata save).

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listLessonMaterials,
  listMaterials,
  attachMaterialToLesson,
  detachMaterialFromLesson,
  type Material,
} from '@/lib/materialApi'
import { GaBtn } from '@/components/ui-v2'
import { MaterialPreviewModal } from '../materials/MaterialPreviewModal'

const labelCls = 'ga-ui mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-ga-muted'
const selectCls =
  'min-w-0 flex-1 rounded-ga border border-ga-line bg-ga-bg px-2 py-1.5 text-[12.5px] text-ga-ink outline-none focus:border-ga-accent'

export function LessonMaterialsPanel({ lessonId }: { lessonId: number }) {
  const t = useTranslations('v2.teacher.tcChecklist')
  const [attached, setAttached] = useState<Material[]>([])
  const [library, setLibrary] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState<Material | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listLessonMaterials(lessonId), listMaterials()])
      .then(([a, lib]) => { if (active) { setAttached(a); setLibrary(lib) } })
      .catch(() => { if (active) { setAttached([]); setLibrary([]) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [lessonId])

  const attachedIds = new Set(attached.map((m) => m.id))
  const options = library.filter((m) => !attachedIds.has(m.id))

  const attach = async () => {
    if (!pick || busy) return
    setBusy(true)
    try {
      await attachMaterialToLesson(Number(pick), lessonId)
      setAttached(await listLessonMaterials(lessonId))
      setPick('')
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const detach = async (id: number) => {
    if (busy) return
    setBusy(true)
    try {
      await detachMaterialFromLesson(id, lessonId)
      setAttached((prev) => prev.filter((m) => m.id !== id))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className={labelCls}>{t('materials.heading')}</label>
      {loading ? (
        <Loader2 size={14} className="animate-spin text-ga-muted" />
      ) : (
        <>
          {attached.length > 0 ? (
            <ul className="mb-2 flex flex-col gap-1">
              {attached.map((m) => (
                <li key={m.id} className="flex items-center gap-2 border border-ga-line bg-ga-bg px-2.5 py-1.5">
                  <Paperclip size={12} className="shrink-0 text-ga-subtle" />
                  {/* Same reader as the library — a raw link to a .docx only ever downloads it. */}
                  <button
                    type="button"
                    onClick={() => setPreviewing(m)}
                    className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium text-ga-ink hover:underline"
                  >
                    {m.title}
                  </button>
                  <span className="ga-ui shrink-0 text-[10px] font-bold uppercase text-ga-subtle">{m.kind}</span>
                  <button
                    type="button"
                    aria-label={t('materials.detach')}
                    onClick={() => detach(m.id)}
                    disabled={busy}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-red-soft hover:text-ga-red disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[12px] text-ga-muted">{t('materials.empty')}</p>
          )}
          {options.length > 0 ? (
            <div className="flex items-center gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className={selectCls}>
                <option value="">{t('materials.pickPlaceholder')}</option>
                {options.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <GaBtn variant="ghost" size="sm" onClick={attach} disabled={!pick || busy}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {t('materials.attach')}
              </GaBtn>
            </div>
          ) : (
            library.length === 0 && <p className="text-[11px] text-ga-subtle">{t('materials.noLibrary')}</p>
          )}
        </>
      )}

      <MaterialPreviewModal material={previewing} onClose={() => setPreviewing(null)} />
    </div>
  )
}
