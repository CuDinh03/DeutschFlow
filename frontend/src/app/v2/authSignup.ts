'use client'

import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { setTokens } from '@/lib/authSession'
import { useUserStore } from '@/stores/useUserStore'
import { useTracking } from '@/hooks/useTracking'

// ─────────────────────────────────────────────────────────────────────────────
// Nhánh "đăng ký thành công" DÙNG CHUNG cho /v2/register (đường cũ /auth/register, khi công tắc mã PIN
// tắt) và /v2/verify-email (đường mới /auth/register/verify). Hai endpoint trả CÙNG một AuthResponse,
// nên phần sau đó phải giống hệt nhau: tách ra một chỗ để hai trang không bao giờ lệch (thiết kế mã PIN
// 05/11 §7.1).
//
// Thứ tự: setTokens + setOrg + cookie locale → GET /auth/me → nạp danh tính vào store → điều hướng theo
// vai. Đăng ký tự phục vụ luôn là STUDENT → /v2/onboarding.
// ─────────────────────────────────────────────────────────────────────────────

export type RegisterPayload = {
  email: string
  phoneNumber: string
  password: string
  displayName: string
  locale: string
  /** Honeypot (chống bot): ô ẩn, người thật để trống. Backend từ chối khi khác rỗng. */
  website?: string
}

/** Phần form giữ lại khi chuyển sang ô nhập mã (để "Đổi email" quay về không mất). KHÔNG có mật khẩu. */
export type PendingSignupDraft = {
  first: string
  last: string
  email: string
  phone: string
  locale: string
  expiresInSeconds: number
  resendAfterSeconds: number
  sentAt: number
}

// sessionStorage chứ không ?email= trên URL: cùng lý do với /v2/forgot-password — không rải địa chỉ
// email vào lịch sử trình duyệt/referrer. sessionStorage sống qua F5 của cùng tab.
const DRAFT_KEY = 'df.pendingSignup'

export function savePendingSignup(draft: PendingSignupDraft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* private mode */ }
}

export function readPendingSignup(): PendingSignupDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as PendingSignupDraft) : null
  } catch {
    return null
  }
}

export function clearPendingSignup() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

type AuthData = {
  accessToken?: string | null
  refreshToken?: string | null
  role?: string | null
  orgRole?: string | null
  orgId?: number | null
}

export function useCompleteSignup() {
  const router = useRouter()
  const { trackEvent, identifyUser } = useTracking()
  const setOrg = useUserStore((s) => s.setOrg)
  const setUser = useUserStore((s) => s.setUser)

  /** @param onStudent gọi ngay trước khi rời trang khi vai là STUDENT (đánh dấu "đã đăng ký xong"). */
  return async (data: AuthData, locale: string, onStudent?: () => void) => {
    setTokens(data)
    setOrg({ orgId: data.orgId ?? null, orgRole: data.orgRole ?? null })
    if (['vi', 'en', 'de'].includes(locale)) {
      document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`
    }

    const { data: user } = await api.get('/auth/me')
    // Nạp danh tính vào store NGAY sau khi đăng ký — /v2/login đã làm (F-16). Store dùng zustand
    // persist, thiếu bước này nó giữ danh tính của PHIÊN TRƯỚC (QA 01/09: sidebar hiện tên một giáo
    // viên cũ cho học viên vừa đăng ký) — rò dữ liệu cá nhân trên máy dùng chung.
    setUser({
      // AuthResponse phơi id ở `userId` chứ không phải `id`.
      id: String(user.userId),
      email: user.email,
      roles: [String(user.role)],
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
    clearPendingSignup()
    switch (user.role) {
      case 'ADMIN':
        router.replace('/v2/admin/users')
        break
      case 'TEACHER':
        router.replace('/v2/teacher')
        break
      case 'STUDENT':
      default:
        // Khách chạy phễu onboarding TRƯỚC khi đăng ký để lại draft trong localStorage; trang
        // /v2/onboarding replay nó ở đây.
        onStudent?.()
        router.replace('/v2/onboarding')
        break
    }

    identifyUser(String(user.userId), {
      email: user.email, name: user.displayName, role: user.role, locale: user.locale,
      created_at: new Date().toISOString(),
    })
    trackEvent('register_success', { role: user.role, locale })
    // Taxonomy onb_v3 (spec §6.2/§6.3): bắn song song tên mới, tên cũ giữ cho dashboard hiện có.
    trackEvent('signup_succeeded', { method: 'email', role: user.role })
  }
}
