'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { forceOwner, listOrgMembers, type AdminOrg, type AdminOrgMember } from '@/lib/adminOrgApi'
import { ConfirmDialog, ErrorBanner, GaCap, GaTextarea } from '@/components/ui-v2'

/**
 * Chỉ định giám đốc — đường khôi phục quyền giám đốc của admin nền tảng (DEC-13 / A6).
 *
 * Khi giám đốc mất tài khoản hoặc nghỉ việc không bàn giao, trung tâm khoá cứng: mọi đường trong
 * tenant (chuyển quyền, gỡ, tự rời) đều cần chính giám đốc. Hộp thoại này gọi
 * POST /admin/organizations/{id}/force-owner: chọn MỘT nhân sự đang hoạt động (quản lý/giáo viên),
 * ghi lý do bắt buộc — backend hạ mọi giám đốc hiện tại xuống quản lý, đăng xuất hai bên, và ghi
 * vào sổ trung tâm với actor là admin. Vì thế hộp thoại là ConfirmDialog (nêu hệ quả trước) chứ
 * không phải form thường, và nút xác nhận bị khoá tới khi đủ dữ liệu.
 *
 * Sàn/trần lý do trùng backend (`ForceOwnerRequest`: 10–500) để không gửi một request chắc chắn 400.
 */
export const FORCE_OWNER_REASON_MIN = 10
export const FORCE_OWNER_REASON_MAX = 500

/** Vai nhân sự backend chấp nhận làm giám đốc (STAFF_ROLES phía OrgMembershipService). */
const STAFF_ROLES = new Set(['OWNER', 'MANAGER', 'TEACHER'])

const SELECT_CLS =
  'ga-ui mt-1 w-full min-w-0 rounded-ga-touch border border-ga-line bg-ga-card px-3 py-2 text-ga-small font-medium text-ga-ink outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50 min-h-11 lg:min-h-9'

export interface ForceOwnerDialogProps {
  org: AdminOrg
  onClose: () => void
  /** Gọi sau khi backend xác nhận — trang cha tải lại danh sách. */
  onDone: () => void
}

const displayName = (m: AdminOrgMember) => m.displayName || m.email

export function ForceOwnerDialog({ org, onClose, onDone }: ForceOwnerDialogProps) {
  const t = useTranslations('v2.adminOps.organizations.forceOwner')
  const [members, setMembers] = useState<AdminOrgMember[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [targetId, setTargetId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setMembers(null)
    setLoadError('')
    listOrgMembers(org.id)
      .then((list) => {
        if (!cancelled) setMembers(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMembers([])
          setLoadError(apiMessage(e))
        }
      })
    return () => {
      cancelled = true
    }
  }, [org.id])

  const staff = useMemo(
    () => (members ?? []).filter((m) => m.status === 'ACTIVE' && STAFF_ROLES.has(m.role)),
    [members],
  )
  const currentOwners = useMemo(() => staff.filter((m) => m.role === 'OWNER'), [staff])
  // Giám đốc hiện tại chỉ là ứng viên khi trung tâm đang có NHIỀU giám đốc (dữ liệu cũ) — chọn một
  // trong số họ làm giám đốc duy nhất là ca có thật. Một giám đốc duy nhất thì chọn lại chính họ là
  // no-op, không bày ra để khỏi gây nhầm.
  const candidates = useMemo(
    () => (currentOwners.length > 1 ? staff : staff.filter((m) => m.role !== 'OWNER')),
    [staff, currentOwners.length],
  )
  const target = candidates.find((m) => m.userId === targetId) ?? null

  const trimmedReason = reason.trim()
  const reasonValid =
    trimmedReason.length >= FORCE_OWNER_REASON_MIN && trimmedReason.length <= FORCE_OWNER_REASON_MAX
  const canConfirm = target !== null && reasonValid && !busy

  const submit = async () => {
    if (!target || !reasonValid) return
    setBusy(true)
    setError('')
    try {
      await forceOwner(org.id, { newOwnerUserId: target.userId, reason: trimmedReason })
      toast.success(t('done', { name: displayName(target), org: org.name }))
      onDone()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const details = [
    currentOwners.length === 0 ? t('detailRecover') : t('detailDemote', { count: currentOwners.length }),
    t('detailLogout'),
    t('detailLedger'),
  ]

  const placeholder =
    members === null ? t('loadingMembers') : candidates.length === 0 ? t('noCandidates') : t('memberPlaceholder')

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose()
      }}
      title={t('title', { org: org.name })}
      description={t('description')}
      details={details}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      confirmDisabled={!canConfirm}
      loading={busy}
      onConfirm={() => void submit()}
    >
      {(error || loadError) && <ErrorBanner message={error || loadError} />}

      <label className="block">
        <GaCap>{t('memberLabel')}</GaCap>
        <select
          value={targetId ?? ''}
          onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : null)}
          disabled={busy || members === null || candidates.length === 0}
          className={SELECT_CLS}
        >
          <option value="">{placeholder}</option>
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>
              {displayName(m)} · {t(`role.${m.role}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <GaCap>{t('reasonLabel')}</GaCap>
        <GaTextarea
          className="mt-1"
          rows={3}
          value={reason}
          maxLength={FORCE_OWNER_REASON_MAX}
          disabled={busy}
          invalid={reason.length > 0 && !reasonValid}
          placeholder={t('reasonPlaceholder')}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">
          {t('reasonHint', { count: trimmedReason.length, min: FORCE_OWNER_REASON_MIN, max: FORCE_OWNER_REASON_MAX })}
        </p>
      </label>
    </ConfirmDialog>
  )
}
