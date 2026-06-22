'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createOrgTeacher } from '@/lib/orgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Org-admin (OWNER/MANAGER) thêm giáo viên — PRE-CREATE account (B2B model §2.1, Phase 1).
 * Tạo thẳng account TEACHER + membership với mật khẩu org-admin đặt (không qua mời self-register).
 * Danh tính person-owned & portable: giáo viên rời TT chỉ đóng membership, account vẫn sống.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'

export function CreateTeacherModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!email.trim() || !displayName.trim() || password.length < 6) {
      setError('Nhập email, tên hiển thị và mật khẩu ít nhất 6 ký tự.')
      return
    }
    setSaving(true)
    try {
      await createOrgTeacher({ email: email.trim(), displayName: displayName.trim(), password })
      toast.success(`Đã thêm giáo viên ${email.trim()}.`)
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
      title="Thêm giáo viên"
      description="Tạo thẳng tài khoản giáo viên cho trung tâm"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            Hủy
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={submit}>
            Thêm giáo viên
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <div className="space-y-4">
        <label className="block">
          <GaCap>Email</GaCap>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="off"
            placeholder="giaovien@trungtam.com"
            className={INPUT_CLS}
          />
        </label>
        <label className="block">
          <GaCap>Tên hiển thị</GaCap>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nguyễn Văn A" className={INPUT_CLS} />
        </label>
        <label className="block">
          <GaCap>Mật khẩu</GaCap>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="text"
            autoComplete="new-password"
            placeholder="≥ 6 ký tự"
            className={INPUT_CLS}
          />
          <p className="ga-ui mt-1 text-[12px] text-ga-subtle">
            Giáo viên đăng nhập bằng mật khẩu này. Tài khoản thuộc về giáo viên — rời trung tâm vẫn còn.
          </p>
        </label>
      </div>
    </TkModal>
  )
}
