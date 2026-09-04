'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Siren, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkModal, ConfirmDialog } from '@/components/ui-v2'
import {
  listMaintenanceWindows,
  createMaintenanceWindow,
  updateMaintenanceWindow,
  activateMaintenanceWindow,
  completeMaintenanceWindow,
  cancelMaintenanceWindow,
  emergencyMaintenance,
  type MaintenanceWindowDto,
} from '@/lib/adminMaintenanceApi'
import { useMaintenanceStore } from '@/stores/useMaintenanceStore'

// ─────────────────────────────────────────────────────────────────────────────
// Quản trị cửa sổ bảo trì (thiết kế plans/2026-09-03 §5.4/§7, backend PR #488).
// Mirror weekly-speaking (CRUD một file + TkModal) — nhưng MỌI chuyển trạng thái đi qua
// ConfirmDialog nêu hệ quả (chuẩn dự án): activate/emergency chặn người dùng NGAY.
// ─────────────────────────────────────────────────────────────────────────────

const field =
  'ga-ui block w-full border border-ga-line bg-ga-bg px-3.5 py-2.5 text-[14.5px] text-ga-ink outline-none focus:border-ga-accent'

interface FormState {
  title: string
  note: string
  startsAt: string // datetime-local (giờ máy admin)
  endsAt: string
  mode: 'FULL' | 'ANNOUNCE_ONLY'
  autoActivate: boolean
  autoComplete: boolean
  notifyUsers: boolean
}
const EMPTY: FormState = {
  title: '',
  note: '',
  startsAt: '',
  endsAt: '',
  mode: 'FULL',
  autoActivate: true,
  autoComplete: false,
  notifyUsers: true,
}

/** ISO UTC → giá trị input datetime-local (giờ máy admin). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local → ISO UTC (backend nhận Instant). */
function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

const STATUS_STYLE: Record<MaintenanceWindowDto['status'], CSSProperties> = {
  SCHEDULED: { background: 'var(--ga-yellow-soft, #FFF3BF)', color: '#8A6C00' },
  ACTIVE: { background: '#FAE6E2', color: '#A8241C' },
  COMPLETED: { background: '#E1F0E3', color: '#2E6E41' },
  CANCELLED: { background: 'var(--ga-side-active, #EFEBDD)', color: 'var(--ga-muted, #6A6149)' },
}

type PendingAction =
  | { kind: 'activate' | 'complete' | 'cancel'; window: MaintenanceWindowDto }
  | { kind: 'emergency' }

export default function V2AdminMaintenancePage() {
  const t = useTranslations('v2.adminOps.maintenance')
  const tc = useTranslations('v2.common')
  const [windows, setWindows] = useState<MaintenanceWindowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingActive, setEditingActive] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listMaintenanceWindows(0, 50)
      setWindows(page.content ?? [])
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  // Trạng thái admin đổi xong thì banner/overlay của chính admin cũng cập nhật ngay.
  const refreshClientState = () => void useMaintenanceStore.getState().refresh()

  const active = windows.find((w) => w.status === 'ACTIVE') ?? null
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setEditingId(null)
    setEditingActive(false)
    setForm(EMPTY)
    setModal(true)
  }
  const openEdit = (w: MaintenanceWindowDto) => {
    setEditingId(w.id)
    setEditingActive(w.status === 'ACTIVE')
    setForm({
      title: w.title,
      note: w.note ?? '',
      startsAt: toLocalInput(w.startsAtUtc),
      endsAt: toLocalInput(w.endsAtUtc),
      mode: w.mode,
      autoActivate: w.autoActivate,
      autoComplete: w.autoComplete,
      notifyUsers: true,
    })
    setModal(true)
  }

  const submit = async () => {
    const startsAtUtc = fromLocalInput(form.startsAt)
    const endsAtUtc = fromLocalInput(form.endsAt)
    if (!editingActive) {
      if (!form.title.trim()) return toast.error(t('validation.titleRequired'))
      if (!startsAtUtc) return toast.error(t('validation.startsRequired'))
      if (endsAtUtc && endsAtUtc <= startsAtUtc) return toast.error(t('validation.endsAfterStarts'))
      if (form.autoComplete && !endsAtUtc) return toast.error(t('validation.autoCompleteNeedsEnd'))
    }
    setSaving(true)
    try {
      if (editingId == null) {
        const res = await createMaintenanceWindow({
          title: form.title.trim(),
          note: form.note.trim() || null,
          startsAtUtc: startsAtUtc as string,
          endsAtUtc,
          mode: form.mode,
          autoActivate: form.autoActivate,
          autoComplete: form.autoComplete,
          notifyUsers: form.notifyUsers,
        })
        toast.success(form.notifyUsers ? t('toast.createdNotified') : t('toast.created'))
        if (res.overlappingIds.length > 0) {
          toast.warning(t('toast.overlap', { ids: res.overlappingIds.join(', ') }))
        }
      } else if (editingActive) {
        // ACTIVE: backend chỉ nhận endsAtUtc (gia hạn) + note.
        await updateMaintenanceWindow(editingId, {
          endsAtUtc: endsAtUtc ?? undefined,
          note: form.note.trim() || null,
        })
        toast.success(t('toast.saved'))
      } else {
        await updateMaintenanceWindow(editingId, {
          title: form.title.trim(),
          note: form.note.trim() || null,
          startsAtUtc: startsAtUtc ?? undefined,
          endsAtUtc: endsAtUtc ?? undefined,
          mode: form.mode,
          autoActivate: form.autoActivate,
          autoComplete: form.autoComplete,
        })
        toast.success(t('toast.saved'))
      }
      setModal(false)
      refreshClientState()
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const runPending = async () => {
    if (!pending) return
    setActing(true)
    try {
      if (pending.kind === 'emergency') {
        await emergencyMaintenance({})
        toast.success(t('toast.emergencyOn'))
      } else if (pending.kind === 'activate') {
        await activateMaintenanceWindow(pending.window.id)
        toast.success(t('toast.activated'))
      } else if (pending.kind === 'complete') {
        await completeMaintenanceWindow(pending.window.id)
        toast.success(t('toast.completed'))
      } else {
        await cancelMaintenanceWindow(pending.window.id)
        toast.success(t('toast.cancelled'))
      }
      setPending(null)
      refreshClientState()
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setActing(false)
    }
  }

  const confirmCopy = (() => {
    if (!pending) return null
    if (pending.kind === 'emergency') {
      return {
        title: t('confirm.emergencyTitle'),
        description: t('confirm.emergencyDesc'),
        details: [t('confirm.emergencyDetail1'), t('confirm.emergencyDetail2'), t('confirm.emergencyDetail3')],
        confirmLabel: t('confirm.emergencyOk'),
        destructive: true,
      }
    }
    if (pending.kind === 'activate') {
      return {
        title: t('confirm.activateTitle'),
        description: t('confirm.activateDesc', { title: pending.window.title }),
        details: [t('confirm.activateDetail1'), t('confirm.activateDetail2')],
        confirmLabel: t('confirm.activateOk'),
        destructive: true,
      }
    }
    if (pending.kind === 'complete') {
      return {
        title: t('confirm.completeTitle'),
        description: t('confirm.completeDesc', { title: pending.window.title }),
        details: [t('confirm.completeDetail1')],
        confirmLabel: t('confirm.completeOk'),
        destructive: false,
      }
    }
    return {
      title: t('confirm.cancelTitle'),
      description: t('confirm.cancelDesc', { title: pending.window.title }),
      details: [
        pending.window.notifiedScheduleAtUtc ? t('confirm.cancelDetailNotified') : t('confirm.cancelDetailQuiet'),
      ],
      confirmLabel: t('confirm.cancelOk'),
      destructive: true,
    }
  })()

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex items-center gap-2">
            <GaBtn
              variant="ghost"
              size="sm"
              className="border-red-700 text-red-700 hover:bg-red-50"
              onClick={() => setPending({ kind: 'emergency' })}
            >
              <Siren size={15} /> {t('emergency')}
            </GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={openCreate}>
              <Plus size={15} /> {t('createNew')}
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {active && (
          <div
            className="mb-5 flex flex-wrap items-center gap-3 border px-4 py-3.5"
            style={{ background: '#FAE6E2', borderColor: '#E8C7C0' }}
          >
            <Wrench size={18} style={{ color: '#A8241C' }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold" style={{ color: '#7C1D16' }}>
                {t('activeBanner.title')}
              </p>
              <p className="ga-ui text-[12.5px]" style={{ color: '#A8241C' }}>
                {active.title}
                {' · '}
                {active.endsAtUtc ? t('activeBanner.until', { time: fmt(active.endsAtUtc) }) : t('activeBanner.noEnd')}
              </p>
            </div>
            <GaBtn variant="ghost" size="sm" onClick={() => openEdit(active)}>
              {t('actions.extend')}
            </GaBtn>
            <GaBtn variant="primary" size="sm" onClick={() => setPending({ kind: 'complete', window: active })}>
              {t('actions.complete')}
            </GaBtn>
          </div>
        )}

        <GaCap className="mb-3.5 block">{t('count', { count: windows.length })}</GaCap>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : windows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted">
            {t('empty')}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {windows.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-start gap-3.5 border border-ga-line bg-ga-card px-4 py-4 lg:flex-nowrap lg:px-[18px]"
                style={{ opacity: w.status === 'COMPLETED' || w.status === 'CANCELLED' ? 0.65 : 1 }}
              >
                <span className="px-2 py-1 text-[10.5px] font-bold" style={STATUS_STYLE[w.status]}>
                  {t(`status.${w.status}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-ga-ink">{w.title}</span>
                    <span className="ga-ui text-[11px] text-ga-subtle">{t(`mode.${w.mode}`)}</span>
                  </div>
                  <div className="ga-ui mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-ga-muted">
                    <span>{t('row.starts', { time: fmt(w.startsAtUtc) })}</span>
                    {w.endsAtUtc && <span>{t('row.ends', { time: fmt(w.endsAtUtc) })}</span>}
                    {w.notifiedScheduleAtUtc && <span>✓ {t('row.notified')}</span>}
                    {w.notifiedBeforeAtUtc && <span>✓ {t('row.reminded')}</span>}
                    <span className="text-ga-subtle">{w.createdBy}</span>
                  </div>
                  {w.note && <p className="mt-1 line-clamp-2 text-[12.5px] italic text-ga-subtle">{w.note}</p>}
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 lg:w-auto">
                  {w.status === 'SCHEDULED' && (
                    <>
                      <RowBtn onClick={() => openEdit(w)}>
                        <Pencil size={12} /> {t('actions.edit')}
                      </RowBtn>
                      <RowBtn tone="red" onClick={() => setPending({ kind: 'activate', window: w })}>
                        {t('actions.activate')}
                      </RowBtn>
                      <RowBtn tone="red" onClick={() => setPending({ kind: 'cancel', window: w })}>
                        {t('actions.cancel')}
                      </RowBtn>
                    </>
                  )}
                  {w.status === 'ACTIVE' && (
                    <>
                      <RowBtn onClick={() => openEdit(w)}>{t('actions.extend')}</RowBtn>
                      <RowBtn onClick={() => setPending({ kind: 'complete', window: w })}>
                        {t('actions.complete')}
                      </RowBtn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TkModal
        open={modal}
        onOpenChange={setModal}
        title={editingId == null ? t('form.titleCreate') : editingActive ? t('form.titleExtend') : t('form.titleEdit')}
        size="md"
        footer={
          <>
            <GaBtn variant="ghost" size="sm" onClick={() => setModal(false)}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn variant="yellow" size="sm" loading={saving} onClick={submit}>
              {editingId == null ? t('form.submitCreate') : t('form.submitSave')}
            </GaBtn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {!editingActive && (
            <div>
              <GaCap className="mb-2 block">{t('form.titleLabel')}</GaCap>
              <input
                className={field}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('form.titlePlaceholder')}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {!editingActive && (
              <div>
                <GaCap className="mb-2 block">{t('form.startsLabel')}</GaCap>
                <input
                  type="datetime-local"
                  className={field}
                  value={form.startsAt}
                  onChange={(e) => set('startsAt', e.target.value)}
                />
              </div>
            )}
            <div>
              <GaCap className="mb-2 block">
                {t('form.endsLabel')} <span className="font-normal text-ga-subtle">{t('form.endsOptional')}</span>
              </GaCap>
              <input
                type="datetime-local"
                className={field}
                value={form.endsAt}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </div>
          </div>
          <div>
            <GaCap className="mb-2 block">{t('form.noteLabel')}</GaCap>
            <textarea
              className={`${field} resize-none`}
              rows={2}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder={t('form.notePlaceholder')}
            />
          </div>
          {!editingActive && (
            <>
              <div>
                <GaCap className="mb-2 block">{t('form.modeLabel')}</GaCap>
                <select
                  className={field}
                  value={form.mode}
                  onChange={(e) => set('mode', e.target.value as FormState['mode'])}
                >
                  <option value="FULL">{t('form.modeFull')}</option>
                  <option value="ANNOUNCE_ONLY">{t('form.modeAnnounce')}</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoActivate}
                  onChange={(e) => set('autoActivate', e.target.checked)}
                  style={{ accentColor: 'var(--ga-accent)' }}
                />
                <span className="text-[13.5px] text-ga-ink">{t('form.autoActivate')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoComplete}
                  onChange={(e) => set('autoComplete', e.target.checked)}
                  style={{ accentColor: 'var(--ga-accent)' }}
                />
                <span className="text-[13.5px] text-ga-ink">{t('form.autoComplete')}</span>
              </label>
              {editingId == null && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.notifyUsers}
                    onChange={(e) => set('notifyUsers', e.target.checked)}
                    style={{ accentColor: 'var(--ga-accent)' }}
                  />
                  <span className="text-[13.5px] font-semibold text-ga-ink">{t('form.notifyUsers')}</span>
                </label>
              )}
            </>
          )}
        </div>
      </TkModal>

      {confirmCopy && (
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(o) => {
            if (!o) setPending(null)
          }}
          title={confirmCopy.title}
          description={confirmCopy.description}
          details={confirmCopy.details}
          confirmLabel={confirmCopy.confirmLabel}
          cancelLabel={tc('cancel')}
          destructive={confirmCopy.destructive}
          loading={acting}
          onConfirm={() => void runPending()}
        />
      )}
    </div>
  )
}

function RowBtn({
  children,
  onClick,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'red'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-3 text-[11px] font-semibold transition-colors lg:py-1.5 ${
        tone === 'red' ? 'text-ga-red hover:border-ga-red' : 'text-ga-muted hover:border-ga-accent hover:text-ga-accent'
      }`}
    >
      {children}
    </button>
  )
}
