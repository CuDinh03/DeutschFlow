'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye, FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  DIFFICULTY_LABEL,
  discardDraft, listBlocks, listDrafts,
  type StudioBlockSummary, type StudioDraftSummary,
} from '@/lib/adminExamStudioApi'
import { DIFFICULTY_ORDER } from '@/lib/examStudioLogic'
import {
  ConfirmDialog, EmptyState, ErrorBanner, GaBtn, GaCap, GaPageHdr, LoadingState,
  TkBadge, TkTabs, TkTabsContent, TkTabsList, TkTabsTrigger,
} from '@/components/ui-v2'
import { CreateDraftModal } from '@/components/admin/exam-studio/CreateDraftModal'
import { BlockPreviewModal } from '@/components/admin/exam-studio/BlockPreviewModal'
import { AssembliesTab } from '@/components/admin/exam-studio/AssembliesTab'
import { studioMiniBtn } from '@/components/admin/exam-studio/ui'

// ─────────────────────────────────────────────────────────────────────────────
// Xưởng đề (admin) — danh sách bản nháp + kho Teil đã duyệt. Thiết kế:
// plans/2026-11-09-thiet-ke-co-che-tao-de.md (LOCAL). Đợt 1: telc · B1 · LESEN · Teil 2.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'drafts' | 'blocks' | 'assemblies'
const TABS: Tab[] = ['drafts', 'blocks', 'assemblies']

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminExamStudioPage() {
  const t = useTranslations('v2.adminContent.examStudio')
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('drafts')
  const [creating, setCreating] = useState(false)

  // ?tab=blocks (từ màn duyệt xong) / ?tab=assemblies. Đọc tay để khỏi cần Suspense cho useSearchParams.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q && (TABS as string[]).includes(q)) setTab(q as Tab)
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" size="sm" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden /> {t('createTeil')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <GaCap className="mb-3.5 block">{t('hint')}</GaCap>
        <TkTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TkTabsList>
            <TkTabsTrigger value="drafts">{t('tabs.drafts')}</TkTabsTrigger>
            <TkTabsTrigger value="blocks">{t('tabs.blocks')}</TkTabsTrigger>
            <TkTabsTrigger value="assemblies">{t('tabs.assemblies')}</TkTabsTrigger>
          </TkTabsList>
          <TkTabsContent value="drafts"><DraftsTab active={tab === 'drafts'} /></TkTabsContent>
          <TkTabsContent value="blocks"><BlocksTab active={tab === 'blocks'} /></TkTabsContent>
          <TkTabsContent value="assemblies"><AssembliesTab active={tab === 'assemblies'} /></TkTabsContent>
        </TkTabs>
      </div>

      <CreateDraftModal
        open={creating}
        onOpenChange={setCreating}
        onCreated={(d) => { setCreating(false); router.push(`/v2/admin/exam-studio/${d.id}`) }}
      />
    </div>
  )
}

function DraftsTab({ active }: { active: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [rows, setRows] = useState<StudioDraftSummary[] | null>(null)
  const [error, setError] = useState('')
  const [discarding, setDiscarding] = useState<StudioDraftSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const all = await listDrafts()
      setRows(all.filter((d) => d.status !== 'DISCARDED'))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    }
  }, [])
  useEffect(() => { if (active) void load() }, [active, load])

  const discard = async () => {
    if (!discarding) return
    setBusy(true)
    try {
      await discardDraft(discarding.id)
      toast.success(t('drafts.discarded'))
      setDiscarding(null)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorBanner title={t('drafts.loadError')} message={error} onRetry={load} />
  if (!rows) return <LoadingState variant="skeleton" rows={4} label={t('loading')} />
  if (rows.length === 0) return <EmptyState variant="invite" icon="draw" title={t('drafts.empty')} description={t('drafts.emptyHint')} />

  return (
    <>
      <ul className="flex flex-col divide-y divide-ga-line rounded-ga border border-ga-line bg-ga-card">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-60">
              <Link href={`/v2/admin/exam-studio/${d.id}`} className="ga-ui block truncate text-ga-body font-semibold text-ga-ink hover:text-ga-accent">
                {d.titleDe || t('wizard.untitled', { id: d.id })}
              </Link>
              <p className="ga-ui text-ga-caption text-ga-muted">
                telc · {d.cefrLevel} · {d.section} · Teil {d.teil}{d.theme ? ` · ${d.theme}` : ''} · {fmtDate(d.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TkBadge tone="navy">{t(`step.${d.step === 'APPROVED' ? 'REVIEW' : d.step}`)}</TkBadge>
              <TkBadge tone={d.status === 'APPROVED' ? 'green' : 'yellow'}>{t(`status.${d.status}`)}</TkBadge>
              {d.busyOp && (
                <TkBadge tone="blue"><Loader2 size={11} className="ga-spin" aria-hidden /> {t(`busyShort.${d.busyOp}`)}</TkBadge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Link href={`/v2/admin/exam-studio/${d.id}`} className={studioMiniBtn}>
                <FolderOpen size={13} aria-hidden /> {t('drafts.open')}
              </Link>
              {d.status === 'DRAFT' && (
                <button type="button" className={studioMiniBtn} disabled={d.busyOp != null} onClick={() => setDiscarding(d)}
                  aria-label={t('drafts.discardAria', { title: d.titleDe || `#${d.id}` })}>
                  <Trash2 size={13} aria-hidden /> {t('drafts.discard')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={discarding != null}
        onOpenChange={(o) => { if (!o) setDiscarding(null) }}
        title={t('drafts.discardTitle')}
        description={t('drafts.discardBody', { title: discarding?.titleDe || `#${discarding?.id ?? ''}` })}
        confirmLabel={t('drafts.discard')}
        cancelLabel={t('cancel')}
        loading={busy}
        onConfirm={discard}
      />
    </>
  )
}

function BlocksTab({ active }: { active: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [rows, setRows] = useState<StudioBlockSummary[] | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<number | null>(null)

  const load = useCallback(async () => {
    try { setRows(await listBlocks()); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
  }, [])
  useEffect(() => { if (active) void load() }, [active, load])

  if (error) return <ErrorBanner title={t('blocks.loadError')} message={error} onRetry={load} />
  if (!rows) return <LoadingState variant="skeleton" rows={4} label={t('loading')} />
  if (rows.length === 0) return <EmptyState icon="library_books" title={t('blocks.empty')} description={t('blocks.emptyHint')} />

  return (
    <>
      <ul className="flex flex-col divide-y divide-ga-line rounded-ga border border-ga-line bg-ga-card">
        {rows.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => setPreview(b.id)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-ga-surface">
              <span className="min-w-0 flex-1 basis-60">
                <span className="ga-ui block truncate text-ga-body font-semibold text-ga-ink">{b.titleDe || t('blocks.previewTitle', { id: b.id })}</span>
                <span className="ga-ui block text-ga-caption text-ga-muted">
                  {b.examFormat} · {b.cefrLevel} · {b.section} · Teil {b.teil}{b.theme ? ` · ${b.theme}` : ''}
                  {' · '}{t('blocks.reviewed', { by: b.reviewedBy ?? '—', at: fmtDate(b.reviewedAt) })}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5" aria-label={t('blocks.countsAria')}>
                {DIFFICULTY_ORDER.map((lv) => (
                  <TkBadge key={lv} tone={b.difficultyCounts[lv] ? 'navy' : 'neutral'}>
                    {DIFFICULTY_LABEL[lv]} {b.difficultyCounts[lv] ?? 0}
                  </TkBadge>
                ))}
              </span>
              <span className="ga-ui inline-flex items-center gap-1 text-ga-caption font-semibold text-ga-accent">
                <Eye size={13} aria-hidden /> {t('blocks.view')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <BlockPreviewModal blockId={preview} onClose={() => setPreview(null)} />
    </>
  )
}
