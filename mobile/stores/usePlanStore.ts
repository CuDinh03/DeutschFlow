import { create } from 'zustand'
import api from '@/lib/api'
import { PRO_UNLOCKED_FREE } from '@/lib/paywall'

/** Ai trả tiền cho gói đang chạy — hợp đồng /auth/me/plan (MyPlanResponse.source). */
export type PlanSource = 'ORG' | 'APPLE' | 'WEB'

export interface MyPlan {
  planCode: string
  tier: 'FREE' | 'PRO' | 'ULTRA'
  endsAtUtc?: string | null
  // F-20 (soát 02/09): backend trả sẵn từ /auth/me/plan nhưng mobile từng bỏ qua
  // — người dùng thử 7 ngày hiện như PRO thật, không đếm ngược, hết hạn chỉ biết
  // qua lỗi quota.
  isTrial?: boolean
  trialEndsAt?: string | null
  /**
   * V-06: gói do TRUNG TÂM cấp (`ORG`) thì học viên không mua gì ở Apple — mời họ "huỷ gói" hay
   * "yêu cầu hoàn tiền" là mời vào ngõ cụt, và tệ hơn: huỷ được thì mất quyền trung tâm đã trả.
   * Bản app cũ / phản hồi thiếu trường → undefined, khi đó cứ xử như trước (xem {@link isOrgPlan}).
   */
  source?: PlanSource
  /** Tên trung tâm cấp gói; chỉ có nghĩa khi `source === 'ORG'`. */
  orgName?: string | null
}

/**
 * Gói này có phải do trung tâm cấp không? Chỉ `true` khi backend nói ĐÚNG 'ORG' — thiếu trường
 * (backend cũ) thì trả false để hành vi giữ nguyên như trước V-06, không âm thầm khoá mất
 * đường huỷ gói của người thật sự tự mua.
 */
export const isOrgPlan = (plan: Pick<MyPlan, 'source'> | null | undefined): boolean =>
  plan?.source === 'ORG'

/** Dòng thay cho cụm nút huỷ/hoàn tiền khi gói do trung tâm cấp. */
export const orgPlanNotice = (plan: Pick<MyPlan, 'orgName'> | null | undefined): string =>
  `Gói học do ${plan?.orgName?.trim() || 'trung tâm của bạn'} cấp`

/** Các mục của cụm "Gói đăng ký" trong màn Hồ sơ. */
export type PlanActionRow = 'upgrade' | 'manage' | 'refund'

/**
 * Mục nào được hiện với gói đang chạy.
 *
 * Gói ORG bỏ "Nâng cấp / đổi gói" (gói không phải của học viên) và "Yêu cầu hoàn tiền" (họ không
 * trả đồng nào cho gói này) — nhưng GIỮ "Quản lý & huỷ gói".
 *
 * Vì sao PHẢI giữ (soát 09/09): người tự mua gói Apple rồi vào trung tâm KHÔNG mất đăng ký Apple —
 * backend chỉ chuyển dòng ấy sang PAUSED và vẫn nhận thông báo gia hạn của Apple
 * (SubscriptionActivationService.extendOrActivateApple, nhánh "Gia hạn khi đang tạm dừng"). Tức
 * Apple VẪN TRỪ TIỀN họ. Giấu luôn mục này là bịt đường duy nhất trong app dẫn tới trang quản lý
 * đăng ký của Apple — người dùng bị tính tiền mà không có lối ra.
 */
export const planActionRows = (plan: Pick<MyPlan, 'source'> | null | undefined): PlanActionRow[] =>
  isOrgPlan(plan) ? ['manage'] : ['upgrade', 'manage', 'refund']

/** Số ngày dùng thử còn lại (làm tròn lên); null khi thiếu mốc/không hợp lệ. */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: Date): number | null {
  if (!trialEndsAt) return null
  const end = new Date(trialEndsAt).getTime()
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000))
}

interface PlanState {
  plan: MyPlan | null
  isPro: boolean
  isUltra: boolean
  /**
   * Whether PRO-gated *features* are unlocked. Use this for feature gates (Speaking voice, Mock Exam,
   * Weekly Challenge, advanced personas). It is `true` for real PRO/ULTRA accounts AND whenever the
   * iOS free build is live ({@link PRO_UNLOCKED_FREE}). Keep {@link isPro} for commercial *labels*
   * only (the FREE/PRO pill), which stay hidden on iOS v1.0.
   */
  hasProAccess: boolean
  fetchPlan: () => Promise<void>
}

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  isPro: false,
  isUltra: false,
  hasProAccess: PRO_UNLOCKED_FREE,

  fetchPlan: async () => {
    try {
      const res = await api.get<MyPlan>('/auth/me/plan')
      const tier = res.data.tier ?? 'FREE'
      const isPro = tier === 'PRO' || tier === 'ULTRA'
      set({
        plan: res.data,
        isPro,
        isUltra: tier === 'ULTRA',
        hasProAccess: PRO_UNLOCKED_FREE || isPro,
      })
    } catch {
      set({ plan: null, isPro: false, isUltra: false, hasProAccess: PRO_UNLOCKED_FREE })
    }
  },
}))
