'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { listOrganizations, type AdminOrg } from '@/lib/adminOrgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner, ConfirmDialog } from '@/components/ui-v2'

/**
 * Admin "Thêm người dùng" — chỉ ADMIN tạo được, và tạo được MỌI vai trò (quy tắc 2026-06-22):
 *   Học viên (STUDENT) · Giáo viên (TEACHER) · Quản lý (MANAGER) · Quản trị (ADMIN).
 * MANAGER/OWNER giờ là platform-role thật (không còn là TEACHER đội mũ org). OWNER không tạo ở đây —
 * chủ trung tâm được tạo qua luồng tạo tổ chức (giữ bất biến 1-OWNER).
 * Backend: POST /admin/users (gác hasRole('ADMIN')).
 */

type AccountKind = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'ADMIN'

const KINDS: { value: AccountKind; labelKey: string; hintKey: string }[] = [
  { value: 'STUDENT', labelKey: 'kind.studentLabel', hintKey: 'kind.studentHint' },
  { value: 'TEACHER', labelKey: 'kind.teacherLabel', hintKey: 'kind.teacherHint' },
  { value: 'MANAGER', labelKey: 'kind.managerLabel', hintKey: 'kind.managerHint' },
  { value: 'ADMIN', labelKey: 'kind.adminLabel', hintKey: 'kind.adminHint' },
]

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'

export function AdminCreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('v2.adminOps.users.create')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [kind, setKind] = useState<AccountKind>('STUDENT')
  const [orgId, setOrgId] = useState('')
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  /** Audit F-M11: tạo tài khoản ADMIN là trao toàn quyền — phải xác nhận, không bắn thẳng khi click. */
  const [confirmAdmin, setConfirmAdmin] = useState(false)

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

  /** Kiểm tra dữ liệu nhập; trả về true nếu hợp lệ. Tách ra để chạy TRƯỚC hộp xác nhận. */
  const validate = (): boolean => {
    setError('')
    if (!email.trim() || !displayName.trim() || password.length < 6) {
      setError(t('errRequired'))
      return false
    }
    if (needsOrg && !orgId) {
      setError(t('errOrgRequired'))
      return false
    }
    return true
  }

  const create = async () => {
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
      toast.success(t('created', { email: email.trim() }))
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
      setConfirmAdmin(false)
    }
  }

  const submit = () => {
    if (!validate()) return
    if (kind === 'ADMIN') {
      setConfirmAdmin(true)
      return
    }
    void create()
  }

  return (
    <>
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
          <label className="block">
            <GaCap>{t('email')}</GaCap>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="off"
              placeholder={t('emailPlaceholder')}
              className={INPUT_CLS}
            />
          </label>

          <label className="block">
            <GaCap>{t('displayName')}</GaCap>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('displayNamePlaceholder')}
              className={INPUT_CLS}
            />
          </label>

          <label className="block">
            <GaCap>{t('password')}</GaCap>
            {/* type="password": mật khẩu admin đặt cho người khác, hiện rõ trên màn hình là lộ ngay
                khi có người đứng cạnh hoặc khi đang chia sẻ màn hình (audit F-M11). */}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              className={INPUT_CLS}
            />
            <p className="ga-ui mt-1 text-[12px] text-ga-subtle">{t('passwordNote')}</p>
          </label>

          <div>
            <GaCap>{t('kindCap')}</GaCap>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={
                    'ga-ui min-h-[40px] rounded-ga border px-3 py-2 text-left text-[13px] font-semibold transition-colors lg:min-h-0 ' +
                    (kind === k.value
                      ? 'border-ga-accent bg-ga-accent-soft text-ga-accent'
                      : 'border-ga-line bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink')
                  }
                >
                  {t(k.labelKey)}
                </button>
              ))}
            </div>
            <p className="ga-ui mt-1.5 text-[12px] text-ga-subtle">
              {t(KINDS.find((k) => k.value === kind)!.hintKey)}
            </p>
          </div>

          {canOrg && (
            <label className="block">
              <GaCap>
                {t('org')} {needsOrg ? t('orgRequired') : t('orgOptional')}
              </GaCap>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={INPUT_CLS}>
                <option value="">{needsOrg ? t('orgChoose') : t('orgNone')}</option>
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

      <ConfirmDialog
        open={confirmAdmin}
        onOpenChange={setConfirmAdmin}
        title={t('confirmAdmin.title')}
        description={t('confirmAdmin.description', { email: email.trim() })}
        details={[t('confirmAdmin.detailScope'), t('confirmAdmin.detailAudit')]}
        confirmLabel={t('confirmAdmin.confirm')}
        cancelLabel={t('confirmAdmin.cancel')}
        loading={saving}
        onConfirm={() => void create()}
      />
    </>
  )
}
