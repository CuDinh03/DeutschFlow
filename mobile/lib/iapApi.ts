/**
 * Thin client for the backend Apple IAP endpoints (`/api/payments/apple/*`).
 *
 * The server-side flow is already implemented and unit-tested (AppleIapService: StoreKit 2 JWS
 * verification, cross-account + replay protection, entitlement activation). This module only carries
 * the signed transactions the device produces to those endpoints and returns the typed results.
 *
 * Canonical entitlement state is NOT inferred from these responses — after verify/sync the caller
 * re-fetches the plan from `/auth/me/plan` (see usePlanStore.fetchPlan).
 */
import api from '@/lib/api'
import type { PlanCode } from '@/lib/iapProducts'

/** Mirror of AppleIapController.AppleProductResponse. */
export interface AppleProduct {
  productId: string
  planCode: PlanCode
  durationMonths: number
}

/** Mirror of AppleIapService.AppleActivationResult. */
export interface AppleActivationResult {
  planCode: string
  endsAt: string
}

/** Active product catalog for building the paywall (backend source of truth). */
export async function fetchAppleProductCatalog(): Promise<AppleProduct[]> {
  const res = await api.get<AppleProduct[]>('/payments/apple/products')
  return res.data ?? []
}

/**
 * The user's stable appAccountToken — attached at purchase time so Apple's signed transaction can be
 * bound to this account server-side (blocks cross-account replay).
 */
export async function fetchAppleAccountToken(): Promise<string> {
  const res = await api.get<{ appAccountToken: string }>('/payments/apple/account-token')
  return res.data.appAccountToken
}

/** Verify a single StoreKit 2 purchase (JWS) and activate the subscription. */
export async function verifyApplePurchase(jws: string): Promise<AppleActivationResult> {
  const res = await api.post<AppleActivationResult>('/payments/apple/verify', { jws })
  return res.data
}

/**
 * Restore: reconcile every entitlement the device currently holds. Returns null when the user has no
 * active Apple entitlement (backend replies 204 No Content).
 */
export async function syncApplePurchases(jws: string[]): Promise<AppleActivationResult | null> {
  const res = await api.post<AppleActivationResult | ''>('/payments/apple/sync', { jws })
  return res.status === 204 || !res.data ? null : (res.data as AppleActivationResult)
}
