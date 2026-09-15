'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarX, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  updateOrganization,
  type AdminOrgDetail,
  type AdminPlanOption,
  type UpdateOrgInput,
} from '@/lib/adminOrgApi'
import { ConfirmDialog, ErrorBanner, GaBtn, GaCap, GaCard, GaInput } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import {
  buildLicenceUpdate,
  clampInt,
  formFromOrg,
  isSeatDrop,
  type LicenceFormState,
  type PoolMode,
} from './orgLicence'

/**
 * T-03 — "Sửa gói & giấy phép" của một trung tâm (owner chốt F1/F7/F3 10/09/2026: pilot nhập tay,
 * hết phải curl). Gọi PATCH /admin/organizations/{id} với ĐÚNG các trường đổi (xem orgLicence.ts).
 *
 * - Gói: chọn từ /admin/plans (mã gõ tay sai = FK từ chối 409 sau khi đã bấm Lưu).
 * - Ghế: 0 = không giới hạn, nhãn nói rõ. Hạ ghế dưới sĩ số ⇒ ConfirmDialog DEC-16 (giữ người cũ,
 *   chặn thêm mới) rồi mới lưu.
 * - AI nhân sự: không giới hạn / N token·tháng. Hạn mức 0 hiện cảnh báo vì đó chính là ca 429
 *   ORG_BUDGET_NOT_CONFIGURED mà trung tâm mới rơi vào.
 * - Hạn giấy phép: ô ngày, xoá được (⇒ vô thời hạn). Hết hạn ⇒ chỉ-đọc ngay, 7 ngày sau cắt gói.
 *
 * Trạng thái ACTIVE/SUSPENDED KHÔNG nằm ở form này — đó là thao tác có hệ quả tức thì, có thẻ
 * riêng (OrgStatusCard) với hộp thoại nêu hệ quả.
 */
export interface LicenceFormProps {
  org: AdminOrgDetail
  plans: AdminPlanOption[]
  /** Gọi sau khi backend xác nhận — trang cha tải lại hồ sơ. */
  onSaved: () => void
}

const SELECT_CLS =
  'ga-ui mt-1 w-full min-w-0 rounded-ga-touch border border-ga-line bg-ga-card px-3 py-2 text-ga-small font-medium text-ga-ink outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50 min-h-11 lg:min-h-9'

export function LicenceForm({ org, plans, onSaved }: LicenceFormProps) {
  const t = useTranslations('v2.adminOps.organizations.licence')
  const fmt = useFmt()
  const [form, setForm] = useState<LicenceFormState>(() => formFromOrg(org))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [seatDropBody, setSeatDropBody] = useState<UpdateOrgInput | null>(null)

  // Đồng bộ lại form khi HỒ SƠ đổi thật (sau khi lưu, hoặc admin khác sửa). So theo ảnh chụp chứ
  // không theo identity của `org`: trang cha poll định kỳ, mỗi lần poll là một object mới — reset
  // theo identity sẽ xoá sạch những gì admin đang gõ dở.
  const snapshot = JSON.stringify(formFromOrg(org))
  useEffect(() => {
    setForm(JSON.parse(snapshot) as LicenceFormState)
  }, [snapshot])

  const body = useMemo(() => buildLicenceUpdate(org, form), [org, form])
  const used = org.studentCount ?? 0
  const seats = clampInt(form.seatLimit)
  const pool = clampInt(form.monthlyTokenPool)

  // Gói hiện tại có thể không còn trong danh sách (ngừng bán / gói lạ từ SQL tay) — vẫn phải bày ra
  // để ô chọn không âm thầm nhảy sang gói khác khi admin chỉ định sửa ghế.
  const planOptions = useMemo(() => {
    const active = plans.filter((p) => p.isActive || p.code === form.planCode)
    const current = form.planCode
    if (current && !active.some((p) => p.code === current)) {
      return [...active, { code: current, name: current, isActive: false }]
    }
    return active
  }, [plans, form.planCode])

  const patch = (partial: Partial<LicenceFormState>) => setForm((f) => ({ ...f, ...partial }))

  const save = async (b: UpdateOrgInput) => {
    setSaving(true)
    setError('')
    try {
      await updateOrganization(org.id, b)
      toast.success(t('saved', { org: org.name }))
      onSaved()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const submit = () => {
    if (!body || saving) return
    if (isSeatDrop(org, body)) {
      setSeatDropBody(body)
      return
    }
    void save(body)
  }

  const confirmSeatDrop = async () => {
    if (!seatDropBody) return
    await save(seatDropBody)
    setSeatDropBody(null)
  }

  return (
    <GaCard className="p-4 lg:p-6" data-testid="licence-form">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <GaCap>{t('title')}</GaCap>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('description')}</p>
        </div>
      </div>

      {error && <ErrorBanner className="mt-4" message={error} />}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <GaCap>{t('plan')}</GaCap>
          <select
            value={form.planCode}
            onChange={(e) => patch({ planCode: e.target.value })}
            disabled={saving}
            className={SELECT_CLS}
            data-testid="licence-plan"
          >
            <option value="">{t('planNone')}</option>
            {planOptions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name === p.code ? p.code : `${p.code} · ${p.name}`}
              </option>
            ))}
          </select>
          <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">{t('planHint')}</p>
        </label>

        <label className="block">
          <GaCap>{t('seatLimit')}</GaCap>
          <GaInput
            className="mt-1"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.seatLimit}
            disabled={saving}
            onChange={(e) => patch({ seatLimit: e.target.value })}
            onBlur={() => patch({ seatLimit: String(seats) })}
            data-testid="licence-seats"
          />
          <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">
            {seats === 0 ? t('seatUnlimited', { used: fmt.num(used) }) : t('seatHint', { used: fmt.num(used) })}
          </p>
          {seats > 0 && seats < used && (
            <p className="ga-ui mt-1 text-ga-caption font-semibold text-ga-red" role="status">
              {t('seatBelowUsed', { used: fmt.num(used) })}
            </p>
          )}
        </label>
      </div>

      <fieldset className="mt-5" disabled={saving}>
        <legend>
          <GaCap>{t('aiPool')}</GaCap>
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PoolChoice
            mode="unlimited"
            current={form.poolMode}
            label={t('aiUnlimited')}
            hint={t('aiUnlimitedHint')}
            onSelect={(m) => patch({ poolMode: m })}
          />
          <PoolChoice
            mode="metered"
            current={form.poolMode}
            label={t('aiMetered')}
            hint={t('aiMeteredHint')}
            onSelect={(m) => patch({ poolMode: m })}
          >
            <div className="mt-2 flex items-center gap-2">
              <GaInput
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={form.monthlyTokenPool}
                disabled={form.poolMode !== 'metered'}
                onChange={(e) => patch({ monthlyTokenPool: e.target.value })}
                onBlur={() => patch({ monthlyTokenPool: String(pool) })}
                aria-label={`${t('aiMetered')} — ${t('aiTokensSuffix')}`}
                data-testid="licence-pool"
              />
              <span className="ga-ui shrink-0 text-ga-caption text-ga-muted">{t('aiTokensSuffix')}</span>
            </div>
            {form.poolMode === 'metered' && pool === 0 && (
              <p className="ga-ui mt-2 text-ga-caption font-semibold text-ga-red" role="status">
                {t('aiUnsetWarning')}
              </p>
            )}
          </PoolChoice>
        </div>
      </fieldset>

      <div className="mt-5">
        <GaCap>{t('validUntil')}</GaCap>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <GaInput
            className="sm:max-w-[220px]"
            type="date"
            value={form.validUntil}
            disabled={saving}
            onChange={(e) => patch({ validUntil: e.target.value })}
            aria-label={t('validUntil')}
            data-testid="licence-valid-until"
          />
          {form.validUntil !== '' && (
            <GaBtn variant="ghost" size="sm" disabled={saving} onClick={() => patch({ validUntil: '' })}>
              <CalendarX size={14} aria-hidden />
              {t('clearValidUntil')}
            </GaBtn>
          )}
        </div>
        <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">
          {form.validUntil === '' ? t('perpetualHint') : t('validUntilHint')}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-ga-line pt-4">
        {!body && !saving && <span className="ga-ui text-ga-caption text-ga-subtle">{t('noChanges')}</span>}
        <GaBtn variant="primary" loading={saving} disabled={!body || saving} onClick={submit} data-testid="licence-save">
          <Save size={15} aria-hidden />
          {t('save')}
        </GaBtn>
      </div>

      {seatDropBody && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o && !saving) setSeatDropBody(null)
          }}
          title={t('seatDrop.title')}
          description={t('seatDrop.description', {
            from: fmt.num(org.seatLimit),
            to: fmt.num(seatDropBody.seatLimit ?? 0),
            used: fmt.num(used),
          })}
          details={[t('seatDrop.detailKeep'), t('seatDrop.detailBlock'), t('seatDrop.detailLedger')]}
          confirmLabel={t('seatDrop.confirm')}
          cancelLabel={t('seatDrop.cancel')}
          destructive={false}
          loading={saving}
          onConfirm={() => void confirmSeatDrop()}
        />
      )}
    </GaCard>
  )
}

function PoolChoice({
  mode,
  current,
  label,
  hint,
  onSelect,
  children,
}: {
  mode: PoolMode
  current: PoolMode
  label: string
  hint: string
  onSelect: (mode: PoolMode) => void
  children?: React.ReactNode
}) {
  const selected = current === mode
  const hintId = `pool-mode-${mode}-hint`
  return (
    <div
      className={
        selected
          ? 'rounded-ga border border-ga-accent bg-ga-accent-soft px-3 py-3'
          : 'rounded-ga border border-ga-line bg-ga-card px-3 py-3'
      }
    >
      <label className="flex cursor-pointer items-start gap-2">
        {/* aria-label = riêng nhãn; gợi ý đi qua describedby để tên truy cập không dính cả câu giải thích. */}
        <input
          type="radio"
          name="poolMode"
          value={mode}
          checked={selected}
          onChange={() => onSelect(mode)}
          aria-label={label}
          aria-describedby={hintId}
          className="mt-1 h-4 w-4 shrink-0 accent-ga-accent"
        />
        <span className="min-w-0">
          <span className="ga-ui block text-ga-small font-semibold text-ga-ink">{label}</span>
          <span id={hintId} className="ga-ui block text-ga-caption text-ga-muted">
            {hint}
          </span>
        </span>
      </label>
      {children}
    </div>
  )
}
