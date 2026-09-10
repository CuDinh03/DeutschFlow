'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createOrganization, type CreateOrgInput } from '@/lib/adminOrgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'
import { PASSWORD_MIN } from '@/lib/passwordPolicy';
import { clampInt, type PoolMode } from './orgLicence'

/**
 * Tạo trung tâm + Owner (B2B model §2.1 — admin pre-create OWNER).
 * Email Owner MỚI → backend tạo thẳng account OWNER với mật khẩu admin đặt (không còn mời self-register).
 * Email đã có → gắn làm OWNER. Backend: POST /admin/organizations (hasRole ADMIN).
 *
 * T-03 (10/09/2026): thêm "Hạn mức AI nhân sự". Trung tâm tạo với pool=0 & unlimited=false là
 * nhân sự bị 429 ORG_BUDGET_NOT_CONFIGURED ngay lần dùng AI đầu (fail-safe). Mặc định KHÔNG GIỚI
 * HẠN — khớp cả hai trung tâm thật trên prod (pool_unlimited=true); admin muốn đo đếm thì chọn
 * hạn mức và nhập số, ô số 0 hiện cảnh báo đỏ.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'
/** Ô số nằm cùng hàng với radio — không cần lề trên. */
const INLINE_INPUT_CLS = INPUT_CLS.replace('mt-1 ', '') + ' disabled:opacity-50'

export function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('v2.adminOps.organizations.create')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [planCode, setPlanCode] = useState('PRO')
  const [seatLimit, setSeatLimit] = useState('')
  const [poolMode, setPoolMode] = useState<PoolMode>('unlimited')
  const [pool, setPool] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!name.trim() || !slug.trim()) {
      setError(t('errNameSlug'))
      return
    }
    if (ownerEmail.trim() && ownerPassword && ownerPassword.length < PASSWORD_MIN) {
      setError(t('errPassword'))
      return
    }
    const body: CreateOrgInput = {
      name: name.trim(),
      slug: slug.trim(),
      planCode: planCode.trim() || undefined,
      seatLimit: seatLimit.trim() ? clampInt(seatLimit) : undefined,
      poolUnlimited: poolMode === 'unlimited',
      monthlyTokenPool: poolMode === 'metered' ? clampInt(pool) : undefined,
      ownerEmail: ownerEmail.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
      ownerPassword: ownerPassword || undefined,
    }
    setSaving(true)
    try {
      await createOrganization(body)
      toast.success(t('created', { name: name.trim() }))
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('title')}
      description={t('description')}
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            {t('cancel')}
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={submit}>
            {t('submit')}
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>{t('name')}</GaCap>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} className={INPUT_CLS} />
          </label>
          <label className="block">
            <GaCap>{t('slug')}</GaCap>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('slugPlaceholder')} className={INPUT_CLS} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>{t('plan')}</GaCap>
            <input value={planCode} onChange={(e) => setPlanCode(e.target.value)} placeholder={t('planPlaceholder')} className={INPUT_CLS} />
          </label>
          <label className="block">
            <GaCap>{t('seatLimit')}</GaCap>
            <input
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
              type="number"
              min={0}
              placeholder={t('seatLimitPlaceholder')}
              className={INPUT_CLS}
            />
          </label>
        </div>

        <fieldset>
          <legend>
            <GaCap>{t('aiPool')}</GaCap>
          </legend>
          <p className="ga-ui mb-2 mt-1 text-ga-caption text-ga-subtle">{t('aiPoolHint')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-ga border border-ga-line px-3 py-2">
              <input
                type="radio"
                name="createPoolMode"
                value="unlimited"
                checked={poolMode === 'unlimited'}
                onChange={() => setPoolMode('unlimited')}
                aria-label={t('aiUnlimited')}
                className="h-4 w-4 accent-ga-accent"
              />
              <span className="ga-ui text-ga-small font-semibold text-ga-ink">{t('aiUnlimited')}</span>
            </label>
            <label className="flex items-center gap-2 rounded-ga border border-ga-line px-3 py-2">
              <input
                type="radio"
                name="createPoolMode"
                value="metered"
                checked={poolMode === 'metered'}
                onChange={() => setPoolMode('metered')}
                aria-label={t('aiMetered')}
                className="h-4 w-4 accent-ga-accent"
              />
              <span className="ga-ui shrink-0 text-ga-small font-semibold text-ga-ink">{t('aiMetered')}</span>
              <input
                value={pool}
                onChange={(e) => setPool(e.target.value)}
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                disabled={poolMode !== 'metered'}
                placeholder={t('aiPoolPlaceholder')}
                aria-label={`${t('aiMetered')} — ${t('aiPoolPlaceholder')}`}
                className={INLINE_INPUT_CLS}
              />
            </label>
          </div>
          {poolMode === 'metered' && clampInt(pool) === 0 && (
            <p className="ga-ui mt-2 text-ga-caption font-semibold text-ga-red" role="status">
              {t('aiUnsetWarning')}
            </p>
          )}
        </fieldset>

        <div className="border-t border-ga-line pt-3">
          <GaCap>{t('ownerCap')}</GaCap>
          <p className="ga-ui mb-2 mt-1 text-[12px] text-ga-subtle">{t('ownerNote')}</p>
          <div className="space-y-3">
            <label className="block">
              <GaCap>{t('ownerEmail')}</GaCap>
              <input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                type="email"
                autoComplete="off"
                placeholder={t('ownerEmailPlaceholder')}
                className={INPUT_CLS}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <GaCap>{t('ownerName')}</GaCap>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t('ownerNamePlaceholder')} className={INPUT_CLS} />
              </label>
              <label className="block">
                <GaCap>{t('ownerPassword')}</GaCap>
                {/* type="password": mật khẩu admin đặt cho người khác, hiện rõ trên màn hình là lộ
                    ngay khi có người đứng cạnh hoặc khi đang chia sẻ màn hình (audit F-M11). */}
                <input
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('ownerPasswordPlaceholder')}
                  className={INPUT_CLS}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </TkModal>
  )
}
