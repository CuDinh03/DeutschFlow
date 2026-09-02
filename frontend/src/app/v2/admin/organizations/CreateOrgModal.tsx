'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createOrganization, type CreateOrgInput } from '@/lib/adminOrgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Tạo trung tâm + Owner (B2B model §2.1 — admin pre-create OWNER).
 * Email Owner MỚI → backend tạo thẳng account OWNER với mật khẩu admin đặt (không còn mời self-register).
 * Email đã có → gắn làm OWNER. Backend: POST /admin/organizations (hasRole ADMIN).
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'

export function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('v2.adminOps.organizations.create')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [planCode, setPlanCode] = useState('PRO')
  const [seatLimit, setSeatLimit] = useState('')
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
    if (ownerEmail.trim() && ownerPassword && ownerPassword.length < 6) {
      setError(t('errPassword'))
      return
    }
    const body: CreateOrgInput = {
      name: name.trim(),
      slug: slug.trim(),
      planCode: planCode.trim() || undefined,
      seatLimit: seatLimit.trim() ? Number(seatLimit.trim()) : undefined,
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
