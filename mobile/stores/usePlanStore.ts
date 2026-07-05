import { create } from 'zustand'
import api from '@/lib/api'
import { PRO_UNLOCKED_FREE } from '@/lib/paywall'

export interface MyPlan {
  planCode: string
  tier: 'FREE' | 'PRO' | 'ULTRA'
  endsAtUtc?: string | null
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
