'use client'

import { useState } from 'react'
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
      setError('Nhập tên và slug tổ chức.')
      return
    }
    if (ownerEmail.trim() && ownerPassword && ownerPassword.length < 6) {
      setError('Mật khẩu Owner tối thiểu 6 ký tự.')
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
      toast.success(`Đã tạo trung tâm ${name.trim()}.`)
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
      title="Tạo trung tâm + Owner"
      description="Pre-create tổ chức và chủ sở hữu — chỉ admin"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            Hủy
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={submit}>
            Tạo trung tâm
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>Tên trung tâm</GaCap>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trung tâm ABC" className={INPUT_CLS} />
          </label>
          <label className="block">
            <GaCap>Slug</GaCap>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="abc-center" className={INPUT_CLS} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>Gói</GaCap>
            <input value={planCode} onChange={(e) => setPlanCode(e.target.value)} placeholder="PRO" className={INPUT_CLS} />
          </label>
          <label className="block">
            <GaCap>Giới hạn ghế (học viên)</GaCap>
            <input
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
              type="number"
              min={0}
              placeholder="0 = không giới hạn"
              className={INPUT_CLS}
            />
          </label>
        </div>

        <div className="border-t border-ga-line pt-3">
          <GaCap>Chủ sở hữu (Owner)</GaCap>
          <p className="ga-ui mb-2 mt-1 text-[12px] text-ga-subtle">
            Email mới → tạo thẳng account OWNER với mật khẩu dưới đây. Email đã có → gắn làm OWNER.
          </p>
          <div className="space-y-3">
            <label className="block">
              <GaCap>Email Owner</GaCap>
              <input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                type="email"
                autoComplete="off"
                placeholder="owner@trungtam.com"
                className={INPUT_CLS}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <GaCap>Tên Owner</GaCap>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nguyễn Văn A" className={INPUT_CLS} />
              </label>
              <label className="block">
                <GaCap>Mật khẩu Owner</GaCap>
                <input
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  type="text"
                  autoComplete="new-password"
                  placeholder="≥ 6 ký tự"
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
