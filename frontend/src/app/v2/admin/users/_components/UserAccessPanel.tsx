'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { adminUsersApi, type AdminRole } from '@/lib/adminUsersApi'
import { GaBtn, GaCap, ConfirmDialog, ErrorBanner } from '@/components/ui-v2'

type GlobalRole = 'ADMIN' | 'TEACHER' | 'STUDENT'
const ROLES: GlobalRole[] = ['STUDENT', 'TEACHER', 'ADMIN']

export interface UserAccessPanelProps {
  userId: number
  userName: string
  email: string
  role: AdminRole
  isActive: boolean
  /** Gọi sau mỗi thay đổi thành công để trang nạp lại hồ sơ. */
  onChanged: () => void
}

/**
 * Quyền truy cập của một người dùng: vai trò hệ thống, khoá/mở khoá, đặt lại mật khẩu.
 * Tách từ UserDetailModal (09/11/2026) sang trang hồ sơ /v2/admin/users/[id].
 *
 * Mức xác nhận (đợt 1 admin — owner chốt 4 thao tác bắt buộc lý do, backend trả 400 nếu thiếu):
 * - đổi giữa các vai thường: một nút (neutral);
 * - cấp hoặc bỏ ADMIN: danger + lý do + gõ lại email người bị đổi;
 * - khoá tài khoản: danger + lý do (cắt mọi phiên đang chạy);
 * - mở khoá: KHÔNG hỏi lại — khôi phục quyền chứ không lấy đi (AC-ADMIN-16);
 * - đặt lại mật khẩu: caution + lý do (người dùng không nhận thông báo tự động).
 */
export function UserAccessPanel({ userId, userName, email, role, isActive, onChanged }: UserAccessPanelProps) {
  const t = useTranslations('v2.adminOps.users.detail')
  const [error, setError] = useState('')

  const [currentRole, setCurrentRole] = useState<AdminRole>(role)
  const [roleValue, setRoleValue] = useState<AdminRole>(role)
  const [confirmRole, setConfirmRole] = useState(false)
  const [savingRole, setSavingRole] = useState(false)
  // OWNER/MANAGER là danh tính quản trị trung tâm — đổi qua console tổ chức, không đổi ở đây.
  const isOrgAdmin = currentRole === 'OWNER' || currentRole === 'MANAGER'
  const touchesAdmin = roleValue === 'ADMIN' || currentRole === 'ADMIN'

  const [active, setActive] = useState(isActive)
  const [confirmLock, setConfirmLock] = useState(false)
  const [savingActive, setSavingActive] = useState(false)

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const applyRole = async (reason?: string) => {
    setSavingRole(true)
    setError('')
    try {
      await adminUsersApi.setRole(userId, roleValue, reason)
      setCurrentRole(roleValue)
      toast.success(t('roleChanged', { role: roleValue }))
      onChanged()
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRoleValue(currentRole)
    } finally {
      setSavingRole(false)
      setConfirmRole(false)
    }
  }

  const applyActive = async (next: boolean, reason?: string) => {
    setSavingActive(true)
    setError('')
    try {
      await adminUsersApi.setActive(userId, next, reason)
      setActive(next)
      toast.success(next ? t('unlocked') : t('locked'))
      onChanged()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSavingActive(false)
      setConfirmLock(false)
    }
  }

  const applyPassword = async (reason: string) => {
    setSavingPw(true)
    setError('')
    try {
      await adminUsersApi.setPassword(userId, newPw, reason)
      setNewPw('')
      toast.success(t('pwDone'))
      onChanged()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSavingPw(false)
      setConfirmPw(false)
    }
  }

  const inputCls =
    'ga-ui min-w-0 flex-1 rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle'

  return (
    <section className="space-y-5" data-testid="user-access-panel">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-2 border-b border-ga-line pb-5">
        <GaCap>{t('roleCap')}</GaCap>
        <p className="ga-ui text-ga-small text-ga-muted">
          {t('roleCurrent')} <span className="font-semibold text-ga-ink">{currentRole}</span>
        </p>
        {isOrgAdmin ? (
          <p className="ga-ui text-ga-caption text-ga-subtle">{t('roleOrgAdminNote')}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value as GlobalRole)}
                aria-label={t('roleCap')}
                className={`${inputCls} font-semibold`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <GaBtn
                variant="primary"
                loading={savingRole}
                disabled={roleValue === currentRole}
                onClick={() => roleValue !== currentRole && setConfirmRole(true)}
              >
                {t('roleChange')}
              </GaBtn>
            </div>
            <p className="ga-ui text-ga-caption text-ga-subtle">{t('roleNote')}</p>
          </>
        )}
      </div>

      <div className="space-y-2 border-b border-ga-line pb-5">
        <GaCap>{t('statusCap')}</GaCap>
        <p className="ga-ui text-ga-small text-ga-muted">
          {t('roleCurrent')}{' '}
          <span className={active ? 'font-semibold text-ga-green' : 'font-semibold text-ga-red'}>
            {active ? t('statusActive') : t('statusLocked')}
          </span>
        </p>
        <GaBtn
          variant={active ? 'ghost' : 'primary'}
          loading={savingActive}
          onClick={() => (active ? setConfirmLock(true) : void applyActive(true))}
        >
          {active ? t('lockAccount') : t('unlockAccount')}
        </GaBtn>
        <p className="ga-ui text-ga-caption text-ga-subtle">{t('statusNote')}</p>
      </div>

      <div className="space-y-2">
        <GaCap>{t('pwCap')}</GaCap>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            placeholder={t('pwPlaceholder')}
            aria-label={t('pwCap')}
            className={inputCls}
          />
          <GaBtn
            variant="primary"
            loading={savingPw}
            disabled={newPw.length < 8}
            onClick={() => newPw.length >= 8 && setConfirmPw(true)}
          >
            {t('pwReset')}
          </GaBtn>
        </div>
        <p className="ga-ui text-ga-caption text-ga-subtle">{t('pwNote')}</p>
      </div>

      <ConfirmDialog
        open={confirmRole}
        onOpenChange={setConfirmRole}
        tone={touchesAdmin ? 'danger' : 'neutral'}
        requireReason={touchesAdmin}
        confirmPhrase={touchesAdmin ? email : undefined}
        confirmPhraseLabel={touchesAdmin ? t('confirmRole.phraseLabel', { email }) : undefined}
        title={t('confirmRole.title')}
        description={t('confirmRole.description', { name: userName, from: currentRole, to: roleValue })}
        details={
          roleValue === 'ADMIN'
            ? [t('confirmRole.detailAdmin'), t('confirmRole.detailSessions'), t('confirmRole.detailAudit')]
            : [t('confirmRole.detailSessions'), t('confirmRole.detailAudit')]
        }
        confirmLabel={t('confirmRole.confirm')}
        cancelLabel={t('confirmRole.cancel')}
        loading={savingRole}
        onConfirm={({ reason }) => void applyRole(reason)}
      />

      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        tone="danger"
        requireReason
        title={t('confirmLock.title')}
        description={t('confirmLock.description', { name: userName })}
        details={[t('confirmLock.detailBlocked'), t('confirmLock.detailSessions'), t('confirmLock.detailReversible')]}
        confirmLabel={t('confirmLock.confirm')}
        cancelLabel={t('confirmLock.cancel')}
        loading={savingActive}
        onConfirm={({ reason }) => void applyActive(false, reason)}
      />

      <ConfirmDialog
        open={confirmPw}
        onOpenChange={setConfirmPw}
        tone="caution"
        requireReason
        title={t('confirmPw.title')}
        description={t('confirmPw.description', { name: userName })}
        details={[t('confirmPw.detailSessions'), t('confirmPw.detailNoNotice'), t('confirmPw.detailAudit')]}
        confirmLabel={t('confirmPw.confirm')}
        cancelLabel={t('confirmPw.cancel')}
        loading={savingPw}
        onConfirm={({ reason }) => reason && void applyPassword(reason)}
      />
    </section>
  )
}
