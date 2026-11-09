'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye } from 'lucide-react'
import api from '@/lib/api'
import { getSupportSession, isSupportMode, startSupportSession } from '@/lib/authSession'
import { homeFor } from '@/lib/roleRouting'
import { hardReplace } from '@/lib/hardNavigate'
import { stopPostHogForSupport } from '@/lib/posthogClient'
import { GaBtn } from '@/components/ui-v2'
import { closeSupportTab } from '@/components/ui-v2/SupportSessionBanner'
import { readHandoffCode } from './supportHandoff'

type RedeemResponse = {
  accessToken: string
  session: {
    id: number
    expiresAt: string
    targetUserId: number
    role: string
    orgId: number | null
    orgRole: string | null
    targetName: string | null
    targetEmail: string
  }
}

type View = 'redeeming' | 'failed' | 'missing' | 'ended'

/**
 * Tab mới của "Xem như người dùng" (phiên hỗ trợ chỉ-đọc, V370). Mở bằng `window.open(..., 'noopener')` nên
 * sessionStorage trống. Trình tự:
 *  1. đọc `#code=` rồi xoá NGAY khỏi thanh địa chỉ/lịch sử (history.replaceState);
 *  2. bỏ access token kế thừa trong sessionStorage (KHÔNG gọi clearTokens — hàm đó xoá cookie phiên admin);
 *  3. POST /auth/support-session/redeem (kèm cookie refresh_token HttpOnly của admin — withCredentials);
 *  4. lưu phiên hỗ trợ + cookie auth_support rồi về trang chủ của vai trò người dùng.
 * `?ended=1` (đóng tab bị trình duyệt chặn) → màn "phiên đã kết thúc".
 */
export default function SupportSessionPage() {
  const t = useTranslations('v2.supportSession')
  const router = useRouter()
  const [view, setView] = useState<View>('redeeming')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const code = readHandoffCode(window.location.hash)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    const ended = new URLSearchParams(window.location.search).get('ended') === '1'
    if (!code) {
      setView(ended || getSupportSession()?.ended ? 'ended' : 'missing')
      return
    }
    if (!isSupportMode()) {
      // Token đăng nhập kế thừa (nếu có) không được dùng cho request redeem.
      sessionStorage.removeItem('accessToken')
    }

    void (async () => {
      try {
        const { data } = await api.post<RedeemResponse>('/auth/support-session/redeem', { code }, { withCredentials: true })
        const s = data.session
        startSupportSession(data.accessToken, {
          id: s.id,
          expiresAt: s.expiresAt,
          role: s.role,
          orgRole: s.orgRole ?? '',
          targetName: s.targetName || s.targetEmail,
          targetEmail: s.targetEmail,
        })
        stopPostHogForSupport()
        // Tải lại TOÀN TRANG (không router.replace): mọi thứ đã khởi động trước khi tab vào chế độ hỗ trợ
        // (PostHog, listener…) phải chết theo trang này — review #805.
        hardReplace(homeFor(s.role, { orgRole: s.orgRole }))
      } catch {
        setView('failed')
      }
    })()
  }, [router])

  const title =
    view === 'redeeming' ? t('redeeming') : view === 'ended' ? t('ended') : view === 'missing' ? t('missingCode') : t('redeemFailed')
  const body = view === 'failed' || view === 'missing' ? t('redeemFailedBody') : view === 'ended' ? t('endedBody') : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-ga-bg px-4 py-10 text-ga-ink">
      <div
        className="w-full max-w-md space-y-4 rounded-ga border border-ga-line bg-ga-card p-6"
        role={view === 'redeeming' ? 'status' : 'alert'}
        data-testid="support-session-page"
        data-view={view}
      >
        <div className="flex items-center gap-2">
          <Eye size={18} aria-hidden />
          <h1 className="text-ga-h3">{title}</h1>
        </div>
        {body && <p className="text-ga-small text-ga-muted">{body}</p>}
        {view !== 'redeeming' && (
          <GaBtn variant="ink" onClick={closeSupportTab}>
            {t('close')}
          </GaBtn>
        )}
      </div>
    </main>
  )
}
