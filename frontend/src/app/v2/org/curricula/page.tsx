'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listCurricula,
  createCurriculum,
  createSampleCurriculum,
  deleteCurriculum,
  createVersion,
  getVersionDetail,
  publishVersion,
  archiveVersion,
  deleteVersion,
  addLektion,
  type OrgCurriculumSummary,
  type CurriculumVersionDetail,
  type CurriculumVersionSummary,
} from '@/lib/orgCurriculumApi'
import {
  GaPageHdr, GaBtn, GaCap, TkBadge, TkModal, LoadingState, ErrorBanner, EmptyState, ConfirmDialog,
} from '@/components/ui-v2'
import { LektionEditor } from './LektionEditor'
import { AssignModal } from './AssignModal'
import { ImportModal } from './ImportModal'

/**
 * Giáo trình trung tâm (PR-1, P03) — OWNER/MANAGER soạn/nhập bộ giáo trình, quản lý phiên bản
 * DRAFT→PUBLISHED→ARCHIVED, gán phiên bản PUBLISHED cho lớp. PUBLISHED bất biến — sửa = bản nháp
 * mới. MỌI thao tác xóa/công bố đi qua ConfirmDialog nêu hệ quả (plan §2.11).
 */

const STATUS_TONE: Record<string, 'neutral' | 'yellow' | 'green' | 'navy'> = {
  DRAFT: 'yellow',
  PUBLISHED: 'green',
  ARCHIVED: 'navy',
}

export default function OrgCurriculaPage() {
  const t = useTranslations('v2.org.curricula')

  const [curricula, setCurricula] = useState<OrgCurriculumSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CurriculumVersionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCefr, setNewCefr] = useState('A1')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const [confirmDeleteCurriculum, setConfirmDeleteCurriculum] = useState<OrgCurriculumSummary | null>(null)
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<CurriculumVersionDetail | null>(null)
  const [confirmPublish, setConfirmPublish] = useState<CurriculumVersionDetail | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<CurriculumVersionDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCurricula(await listCurricula())
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const loadDetail = useCallback(async (versionId: number) => {
    setSelectedVersionId(versionId)
    setDetailLoading(true)
    try {
      setDetail(await getVersionDetail(versionId))
    } catch (e) {
      toast.error(apiMessage(e))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await load()
    if (selectedVersionId !== null) await loadDetail(selectedVersionId)
  }, [load, loadDetail, selectedVersionId])

  const submitCreate = async (): Promise<void> => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await createCurriculum({ name: newName.trim(), cefrLevel: newCefr })
      toast.success(t('createdToast'))
      setShowCreate(false)
      setNewName('')
      await load()
      const draft = created.versions[0]
      if (draft) await loadDetail(draft.id)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const createSample = async (): Promise<void> => {
    setBusy(true)
    try {
      await createSampleCurriculum()
      toast.success(t('sampleToast'))
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /** Bọc hành động ghi: chạy, toast kết quả, tải lại list + detail. */
  const run = async (action: () => Promise<unknown>, successKey: string): Promise<boolean> => {
    setBusy(true)
    try {
      await action()
      toast.success(t(successKey))
      await refreshAll()
      return true
    } catch (e) {
      toast.error(apiMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const newDraft = async (curriculumId: number): Promise<void> => {
    setBusy(true)
    try {
      const draft = await createVersion(curriculumId)
      toast.success(t('draftCreatedToast'))
      await load()
      await loadDetail(draft.id)
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const isDraft = detail?.status === 'DRAFT'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 lg:px-10">
        <div className="mb-5 flex flex-wrap gap-2">
          <GaBtn onClick={() => setShowCreate(true)}>{t('newBtn')}</GaBtn>
          <GaBtn variant="ghost" onClick={() => setShowImport(true)}>{t('importBtn')}</GaBtn>
          <GaBtn variant="ghost" loading={busy} onClick={() => void createSample()}>{t('sampleBtn')}</GaBtn>
        </div>

        {loading && <LoadingState variant="skeleton" rows={4} />}
        {!loading && error && <ErrorBanner message={error} onRetry={() => void load()} />}

        {!loading && !error && (
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            {/* Danh sách bộ giáo trình + phiên bản */}
            <div className="flex flex-col gap-3">
              {curricula.length === 0 && <EmptyState title={t('emptyList')} description={t('listHint')} />}
              {curricula.map((c) => (
                <div key={c.id} className="border border-ga-line bg-ga-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-ga-ink">{c.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {c.cefrLevel && <TkBadge tone="neutral">{c.cefrLevel}</TkBadge>}
                        {c.sample && <TkBadge tone="yellow">{t('sampleBadge')}</TkBadge>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] text-ga-muted underline-offset-2 hover:text-red-700 hover:underline"
                      onClick={() => setConfirmDeleteCurriculum(c)}
                    >
                      {t('deleteCurriculumBtn')}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {c.versions.map((v) => (
                      <VersionRow
                        key={v.id}
                        v={v}
                        active={v.id === selectedVersionId}
                        onSelect={() => void loadDetail(v.id)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Chi tiết phiên bản đang chọn */}
            <div className="min-w-0">
              {detailLoading && <LoadingState variant="skeleton" rows={5} />}
              {!detailLoading && !detail && (
                <EmptyState title={t('detailEmpty')} description={t('detailEmptyHint')} />
              )}
              {!detailLoading && detail && (
                <div className="flex flex-col gap-4">
                  <div className="border border-ga-line bg-ga-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <GaCap>{t('versionLabel', { no: detail.versionNo })}</GaCap>
                        <div className="truncate text-[17px] font-bold text-ga-ink">{detail.curriculumName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <TkBadge tone={STATUS_TONE[detail.status] ?? 'neutral'}>
                            {t(`status${detail.status}`)}
                          </TkBadge>
                          <span className="text-[12px] text-ga-muted">
                            {t('lektionCount', { count: detail.lektionen.length })}
                            {' · '}
                            {t('linkedCount', { count: detail.linkedClassCount })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {isDraft && (
                          <>
                            <GaBtn size="sm" loading={busy} onClick={() => setConfirmPublish(detail)}>
                              {t('publishBtn')}
                            </GaBtn>
                            <GaBtn size="sm" variant="ghost" disabled={busy}
                              onClick={() => setConfirmDeleteVersion(detail)}>
                              {t('deleteVersionBtn')}
                            </GaBtn>
                          </>
                        )}
                        {detail.status === 'PUBLISHED' && (
                          <>
                            <GaBtn size="sm" loading={busy} onClick={() => setShowAssign(true)}>
                              {t('assignBtn')}
                            </GaBtn>
                            <GaBtn size="sm" variant="ghost" disabled={busy}
                              onClick={() => void newDraft(detail.curriculumId)}>
                              {t('newDraftBtn')}
                            </GaBtn>
                            <GaBtn size="sm" variant="ghost" disabled={busy}
                              onClick={() => setConfirmArchive(detail)}>
                              {t('archiveBtn')}
                            </GaBtn>
                          </>
                        )}
                        {detail.status === 'ARCHIVED' && (
                          <GaBtn size="sm" variant="ghost" disabled={busy}
                            onClick={() => void newDraft(detail.curriculumId)}>
                            {t('newDraftBtn')}
                          </GaBtn>
                        )}
                      </div>
                    </div>
                    {!isDraft && (
                      <p className="mt-2 text-[12px] leading-relaxed text-ga-muted">{t('frozenNote')}</p>
                    )}
                  </div>

                  {detail.lektionen.map((lektion) => (
                    <LektionEditor
                      key={lektion.id}
                      lektion={lektion}
                      readonly={!isDraft}
                      onChanged={() => void refreshAll()}
                    />
                  ))}

                  {isDraft && (
                    <AddLektion
                      onAdd={async (title) => {
                        await run(() => addLektion(detail.id, { title }), 'lektionAddedToast')
                      }}
                      t={t}
                      busy={busy}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tạo bộ mới */}
      <TkModal open={showCreate} onOpenChange={setShowCreate} title={t('createTitle')} size="sm">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">{t('createName')}</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('createNamePlaceholder')}
              className="border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">{t('createCefr')}</span>
            <select
              value={newCefr}
              onChange={(e) => setNewCefr(e.target.value)}
              className="border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
            >
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <GaBtn variant="ghost" onClick={() => setShowCreate(false)}>{t('cancel')}</GaBtn>
            <GaBtn loading={creating} disabled={!newName.trim()} onClick={() => void submitCreate()}>
              {t('createSubmit')}
            </GaBtn>
          </div>
        </div>
      </TkModal>

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { setShowImport(false); void load() }}
      />

      {detail && (
        <AssignModal
          open={showAssign}
          version={detail}
          onClose={() => setShowAssign(false)}
          onChanged={() => void refreshAll()}
        />
      )}

      {/* §2.11: mọi thao tác xóa/không đảo ngược đi qua ConfirmDialog nêu hệ quả */}
      {confirmDeleteCurriculum && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmDeleteCurriculum(null) }}
          title={t('confirmDeleteCurriculumTitle')}
          description={t('confirmDeleteCurriculumDesc', { name: confirmDeleteCurriculum.name })}
          details={[
            t('confirmDeleteCurriculumDetailVersions', { count: confirmDeleteCurriculum.versions.length }),
            t('confirmDeleteCurriculumDetailLinks'),
          ]}
          confirmLabel={t('confirmDeleteCurriculumOk')}
          cancelLabel={t('cancel')}
          loading={busy}
          onConfirm={() => {
            const target = confirmDeleteCurriculum
            void run(() => deleteCurriculum(target.id), 'deletedToast').then((ok) => {
              if (ok) {
                setConfirmDeleteCurriculum(null)
                if (target.versions.some((v) => v.id === selectedVersionId)) {
                  setSelectedVersionId(null)
                  setDetail(null)
                }
              }
            })
          }}
        />
      )}

      {confirmDeleteVersion && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmDeleteVersion(null) }}
          title={t('confirmDeleteVersionTitle')}
          description={t('confirmDeleteVersionDesc', { no: confirmDeleteVersion.versionNo, name: confirmDeleteVersion.curriculumName })}
          details={[t('confirmDeleteVersionDetail', { count: confirmDeleteVersion.lektionen.length })]}
          confirmLabel={t('confirmDeleteVersionOk')}
          cancelLabel={t('cancel')}
          loading={busy}
          onConfirm={() => {
            const target = confirmDeleteVersion
            void run(() => deleteVersion(target.id), 'versionDeletedToast').then((ok) => {
              if (ok) {
                setConfirmDeleteVersion(null)
                setSelectedVersionId(null)
                setDetail(null)
              }
            })
          }}
        />
      )}

      {confirmPublish && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmPublish(null) }}
          title={t('confirmPublishTitle')}
          description={t('confirmPublishDesc', { name: confirmPublish.curriculumName, no: confirmPublish.versionNo })}
          details={[t('confirmPublishDetailFrozen'), t('confirmPublishDetailAssign')]}
          confirmLabel={t('confirmPublishOk')}
          cancelLabel={t('cancel')}
          destructive={false}
          loading={busy}
          onConfirm={() => {
            const target = confirmPublish
            void run(() => publishVersion(target.id), 'publishToast').then((ok) => {
              if (ok) setConfirmPublish(null)
            })
          }}
        />
      )}

      {confirmArchive && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmArchive(null) }}
          title={t('confirmArchiveTitle')}
          description={t('confirmArchiveDesc', { name: confirmArchive.curriculumName, no: confirmArchive.versionNo })}
          details={[t('confirmArchiveDetail')]}
          confirmLabel={t('confirmArchiveOk')}
          cancelLabel={t('cancel')}
          destructive={false}
          loading={busy}
          onConfirm={() => {
            const target = confirmArchive
            void run(() => archiveVersion(target.id), 'archiveToast').then((ok) => {
              if (ok) setConfirmArchive(null)
            })
          }}
        />
      )}
    </div>
  )
}

type Translate = (key: string, values?: Record<string, string | number>) => string

function VersionRow({ v, active, onSelect, t }: {
  v: CurriculumVersionSummary
  active: boolean
  onSelect: () => void
  t: Translate
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
        active ? 'border-ga-accent bg-ga-side-active text-ga-ink' : 'border-ga-line bg-ga-bg text-ga-ink hover:bg-ga-side-active'
      }`}
    >
      <span className="font-semibold">{t('versionLabel', { no: v.versionNo })}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-ga-muted">{t('lektionCount', { count: v.lektionCount })}</span>
        <TkBadge tone={STATUS_TONE[v.status] ?? 'neutral'}>{t(`status${v.status}`)}</TkBadge>
      </span>
    </button>
  )
}

function AddLektion({ onAdd, t, busy }: {
  onAdd: (title: string) => Promise<void>
  t: Translate
  busy: boolean
}) {
  const [title, setTitle] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2 border border-dashed border-ga-line bg-ga-card p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('addLektionPlaceholder')}
        className="min-w-0 flex-1 border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            void onAdd(title.trim()).then(() => setTitle(''))
          }
        }}
      />
      <GaBtn size="sm" loading={busy} disabled={!title.trim()}
        onClick={() => void onAdd(title.trim()).then(() => setTitle(''))}>
        {t('addLektionBtn')}
      </GaBtn>
    </div>
  )
}
