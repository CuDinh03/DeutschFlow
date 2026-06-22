'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { listOrganizations, type AdminOrg } from '@/lib/adminOrgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Admin "Thêm người dùng" — chỉ ADMIN tạo được, và tạo được MỌI vai trò (quy tắc 2026-06-22):
 *   Học viên (STUDENT) · Giáo viên (TEACHER) · Quản lý (MANAGER) · Quản trị (ADMIN).
 * MANAGER/OWNER giờ là platform-role thật (không còn là TEACHER đội mũ org). OWNER không tạo ở đây —
 * chủ trung tâm được tạo qua luồng tạo tổ chức (giữ bất biến 1-OWNER).
 * Backend: POST /admin/users (gác hasRole('ADMIN')).
 */

type AccountKind = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'ADMIN'

const KINDS: { value: AccountKind; label: string; hint: string }[] = [
  { value: 'STUDENT', label: 'Học viên', hint: 'Tài khoản học viên thường.' },
  { value: 'TEACHER', label: 'Giáo viên', hint: 'Giáo viên; có thể gán vào một trung tâm.' },
  { value: 'MANAGER', label: 'Quản lý trung tâm', hint: 'Nhân sự quản lý — bắt buộc chọn tổ chức.' },
  { value: 'ADMIN', label: 'Quản trị (admin)', hint: 'Quản trị toàn hệ thống.' },
]

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'

export function AdminCreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [kind, setKind] = useState<AccountKind>('STUDENT')
  const [orgId, setOrgId] = useState('')
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canOrg = kind === 'TEACHER' || kind === 'MANAGER' // org dropdown shown
  const needsOrg = kind === 'MANAGER' // org required

  useEffect(() => {
    if (!canOrg) return
    let cancelled = false
    listOrganizations(0, 200)
      .then((p) => !cancelled && setOrgs(p.content ?? []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [canOrg])

  const submit = async () => {
    setError('')
    if (!email.trim() || !displayName.trim() || password.length < 6) {
      setError('Nhập email, tên hiển thị và mật khẩu ít nhất 6 ký tự.')
      return
    }
    if (needsOrg && !orgId) {
      setError('Tài khoản quản lý phải thuộc một tổ chức.')
      return
    }

    // AccountKind maps 1:1 to the platform role now (STUDENT/TEACHER/MANAGER/ADMIN). The backend
    // derives the org-membership role from the platform role, so we only send orgId.
    const payload: Record<string, unknown> = {
      email: email.trim(),
      displayName: displayName.trim(),
      password,
      role: kind,
      locale: 'vi',
    }
    if (canOrg && orgId) {
      payload.orgId = Number(orgId)
    }

    setSaving(true)
    try {
      await api.post('/admin/users', payload)
      toast.success(`Đã tạo tài khoản ${email.trim()}.`)
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
      title="Thêm người dùng"
      description="Tạo tài khoản mới — chỉ admin"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            Hủy
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={submit}>
            Tạo tài khoản
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
            placeholder="ten@trungtam.com"
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
          <p className="ga-ui mt-1 text-[12px] text-ga-subtle">Người dùng đăng nhập bằng mật khẩu này (có thể đổi sau).</p>
        </label>

        <div>
          <GaCap>Loại tài khoản</GaCap>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={
                  'ga-ui rounded-ga border px-3 py-2 text-left text-[13px] font-semibold transition-colors ' +
                  (kind === k.value
                    ? 'border-ga-accent bg-ga-accent-soft text-ga-accent'
                    : 'border-ga-line bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink')
                }
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">{KINDS.find((k) => k.value === kind)?.hint}</p>
        </div>

        {canOrg && (
          <label className="block">
            <GaCap>Tổ chức {needsOrg ? '(bắt buộc)' : '(tuỳ chọn)'}</GaCap>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={INPUT_CLS}>
              <option value="">{needsOrg ? '— Chọn tổ chức —' : '— Không gán —'}</option>
              {orgs.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </TkModal>
  )
}
