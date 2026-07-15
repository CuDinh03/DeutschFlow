'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listMaterials,
  listArchivedMaterials,
  uploadMaterial,
  archiveMaterial,
  unarchiveMaterial,
  fetchMaterialAttachments,
  type Material,
  type MaterialScope,
} from '@/lib/materialApi'
import { getOrgRole } from '@/lib/authSession'
import { GaPageHdr, TkBadge, ErrorBanner, LoadingState, GaBtn } from '@/components/ui-v2'
import { GaSection } from '../../analyticsShared'

// Persisted teaching materials (B2B §5). PERSONAL follows the teacher; ORG stays with the center
// and is visible only while the teacher is an ACTIVE member (enforced server-side).

const KIND_TONE: Record<string, 'red' | 'navy' | 'violet' | 'blue'> = {
  PPTX: 'red',
  PDF: 'navy',
  DOCX: 'blue',
  IMAGE: 'violet',
  OTHER: 'blue',
}

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const fmtSize = (b: number | null) =>
  b == null ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

export default function V2TeacherMaterialsPage() {
  const t = useTranslations('v2.teacher.materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<MaterialScope>('PERSONAL')
  const [uploading, setUploading] = useState(false)
  const [canOrg, setCanOrg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setCanOrg(Boolean(getOrgRole())) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMaterials(await (view === 'archived' ? listArchivedMaterials() : listMaterials()))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [view])
  useEffect(() => { void load() }, [load])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error(t('pickFile')); return }
    if (!title.trim()) { toast.error(t('enterTitle')); return }
    setUploading(true)
    try {
      await uploadMaterial(file, title.trim(), scope)
      toast.success(t('uploadSuccess'))
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const handleArchive = async (m: Material) => {
    setBusy(m.id)
    try {
      // Warn with the real attachment count first: archiving pulls the material out of every lesson it
      // is attached to (listForLesson drops non-ACTIVE), so "Lưu trữ" is not the harmless tidy-up it
      // sounds like. It IS reversible now (Restore), which the message also says.
      const { lessons, classes } = await fetchMaterialAttachments(m.id)
      const attached = lessons + classes
      const msg = attached > 0
        ? t('archiveConfirmAttached', { title: m.title, lessons, classes })
        : t('archiveConfirm', { title: m.title })
      if (!window.confirm(msg)) return
      await archiveMaterial(m.id)
      toast.success(t('archiveSuccess'))
      await load()
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const handleUnarchive = async (m: Material) => {
    setBusy(m.id)
    try {
      await unarchiveMaterial(m.id)
      toast.success(t('unarchiveSuccess'))
      await load()
    } catch (err: unknown) {
      toast.error(apiMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}

        <GaSection title={t('uploadSection')} className="mb-[22px]">
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">{t('fileLabel')}</span>
              <input ref={fileRef} type="file" className="ga-ui text-[13px] text-ga-ink" />
            </label>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">{t('titleLabel')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] text-ga-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">{t('scopeLabel')}</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as MaterialScope)}
                className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] font-semibold text-ga-ink"
              >
                <option value="PERSONAL">{t('scopePersonal')}</option>
                {canOrg && <option value="ORG">{t('scopeOrg')}</option>}
              </select>
            </label>
            <GaBtn type="submit" variant="yellow" disabled={uploading}>
              {uploading ? t('uploading') : t('upload')}
            </GaBtn>
          </form>
        </GaSection>

        <div className="mb-3 flex items-center gap-1.5">
          {(['active', 'archived'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="ga-ui rounded-ga border px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={view === v
                ? { borderColor: 'var(--ga-accent)', color: 'var(--ga-accent)', background: 'var(--ga-side-active)' }
                : { borderColor: 'var(--ga-line)', color: 'var(--ga-muted)' }}
            >
              {v === 'active' ? t('viewActive') : t('viewArchived')}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <GaSection title={view === 'archived' ? t('archivedTitle', { count: materials.length }) : t('listTitle', { count: materials.length })} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ga-border">
                    {[t('colTitle'), t('colKind'), t('colScope'), t('colSize'), t('colDate'), ''].map((h, i) => (
                      <th key={i} className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${i === 5 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                        {view === 'archived' ? t('archivedEmpty') : t('empty')}
                      </td>
                    </tr>
                  ) : (
                    materials.map((m) => (
                      <tr key={m.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                        <td className="px-5 py-3">
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-ga-ink hover:underline">
                            {m.title}
                          </a>
                          {m.description && <p className="truncate text-[12px] text-ga-muted">{m.description}</p>}
                        </td>
                        <td className="px-5 py-3"><TkBadge tone={KIND_TONE[m.kind] ?? 'blue'}>{m.kind}</TkBadge></td>
                        <td className="px-5 py-3">
                          <TkBadge tone={m.ownerScope === 'ORG' ? 'navy' : 'violet'}>
                            {m.ownerScope === 'ORG' ? t('scopeOrg') : t('scopePersonal')}
                          </TkBadge>
                        </td>
                        <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtSize(m.sizeBytes)}</td>
                        <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtDate(m.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          {view === 'archived' ? (
                            <button
                              type="button"
                              disabled={busy === m.id}
                              onClick={() => handleUnarchive(m)}
                              className="ga-ui rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40"
                            >
                              {t('unarchive')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy === m.id}
                              onClick={() => handleArchive(m)}
                              className="ga-ui rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red disabled:opacity-40"
                            >
                              {t('archive')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GaSection>
        )}
      </div>
    </div>
  )
}
