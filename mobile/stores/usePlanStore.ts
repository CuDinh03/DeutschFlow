import { create } from 'zustand'
import api from '@/lib/api'

export interface MyPlan {
  planCode: string
  tier: 'FREE' | 'PRO' | 'ULTRA'
  endsAtUtc?: string | null
}

interface PlanState {
  plan: MyPlan | null
  isPro: boolean
  isUltra: boolean
  fetchPlan: () => Promise<void>
}

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  isPro: false,
  isUltra: false,

  fetchPlan: async () => {
    try {
      const res = await api.get<MyPlan>('/auth/me/plan')
      const tier = res.data.tier ?? 'FREE'
      set({
        plan: res.data,
        isPro: tier === 'PRO' || tier === 'ULTRA',
        isUltra: tier === 'ULTRA',
      })
    } catch {
      set({ plan: null, isPro: false, isUltra: false })
    }
  },
}))
