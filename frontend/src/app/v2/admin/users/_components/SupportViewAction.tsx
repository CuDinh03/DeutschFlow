'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Eye } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { adminUsersApi, type AdminRole, type SupportSessionRow } from '@/lib/adminUsersApi'
import { useFmt } from '@/lib/i18n/useFmt'
import { GaBtn, ConfirmDialog } from '@/components/ui-v2'

/** Trang tab hỗ trợ — mã bàn giao đi trong fragment (#) nên không bao giờ tới máy chủ/log/Referer. */
export const SUPPORT_SESSION_PAGE = '/v2/support-session'

export interface SupportViewActionProps {
  userId: number
  userName: string
  role: AdminRole
  isActive: boolean
}

/**
 * "Xem như người dùng" (phiên hỗ trợ chỉ-đọc, V370) trên hồ sơ người dùng của admin: lý do ≥ 15 ký tự →
 * POST /admin/users/{id}/support-session → mở tab MỚI với `noopener,noreferrer` (tab mới không chép
 * sessionStorage của tab admin và không biết tab mở nó). Ẩn với đích ADMIN và tài khoản đang khoá (backend
 * cũng chặn: 403 / 409). Phiên đang mở của người này hiện kèm nút "Kết thúc".
 */
export function SupportViewAction({ userId, userName, role, isActive }: SupportViewActionProps) {
  const t = useTranslations('v2.adminOps.users.detail.supportView')
  const fmt = useFmt()
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [active, setActive] = useState<SupportSessionRow | null>(null)

  const eligible = role !== 'ADMIN' && isActive

  const loadActive = useCallback(async () => {
    try {
      const res = await adminUsersApi.supportSessions(userId)
      setActive((res.data?.items ?? []).find((s) => s.active) ?? null)
    } catch {
      setActive(null)
    }
  }, [userId])

  useEffect(() => {
    if (eligible) void loadActive()
  }, [eligible, loadActive])

  if (!eligible) return null

  const start = async (reason: string) => {
    setStarting(true)
    try {
      const res = await adminUsersApi.startSupportSession(userId, reason)
      window.open(
        `${SUPPORT_SESSION_PAGE}#code=${encodeURIComponent(res.data.handoffCode)}`,
        '_blank',
        'noopener,noreferrer',
      )
      setOpen(false)
      toast.success(t('started'))
      void loadActive()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setStarting(false)
    }
  }

  const end = async () => {
    if (!active) return
    setEnding(true)
    try {
      await adminUsersApi.endSupportSession(active.id)
      toast.success(t('ended'))
      await loadActive()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="support-view-action">
      {active && (
        <span className="ga-ui inline-flex items-center gap-2 text-ga-caption text-ga-muted" role="status">
          {t('activeUntil', { time: fmt.time(active.expiresAt) })}
          <GaBtn variant="ghost" size="sm" onClick={() => void end()} disabled={ending} data-testid="support-view-end">
            {t('end')}
          </GaBtn>
        </span>
      )}
      <GaBtn variant="ghost" onClick={() => setOpen(true)} data-testid="support-view-start">
        <Eye size={14} aria-hidden /> {t('button')}
      </GaBtn>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="caution"
        requireReason
        minReasonLength={15}
        maxReasonLength={500}
        reasonLabel={t('confirm.reasonLabel')}
        title={t('confirm.title')}
        description={t('confirm.description', { name: userName })}
        details={[t('confirm.detailLimits'), t('confirm.detailBlocked'), t('confirm.detailAudit')]}
        confirmLabel={t('confirm.confirm')}
        cancelLabel={t('confirm.cancel')}
        loading={starting}
        onConfirm={({ reason }) => void start(reason ?? '')}
      />
    </div>
  )
}
