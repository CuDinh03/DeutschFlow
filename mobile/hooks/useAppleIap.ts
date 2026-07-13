import { useCallback, useEffect, useRef, useState } from 'react'
import { getAvailablePurchases, useIAP, type ProductSubscription } from 'expo-iap'
import { usePlanStore } from '@/stores/usePlanStore'
import { APPLE_PRODUCT_IDS, collectJwsTokens, extractJws, sortByCatalogOrder } from '@/lib/iapProducts'
import { fetchAppleAccountToken, syncApplePurchases, verifyApplePurchase } from '@/lib/iapApi'

export type IapPhase = 'idle' | 'loading' | 'purchasing' | 'restoring'

export interface AppleIap {
  /** StoreKit connection is live and products can be fetched/purchased. */
  connected: boolean
  /** Fetched subscription products, ordered by the catalog (PRO monthly → … → ULTRA yearly). */
  products: ProductSubscription[]
  phase: IapPhase
  /** SKU currently being purchased, for per-button spinners. */
  activeSku: string | null
  /** User-facing error (Vietnamese). Null when there is nothing to show. */
  error: string | null
  /** Set after a successful verify/sync so the screen can show a confirmation. */
  succeeded: boolean
  buy: (sku: string) => Promise<void>
  restore: () => Promise<void>
}

const SKUS: string[] = [...APPLE_PRODUCT_IDS]

/** True when a StoreKit error represents the user backing out — not a real failure to surface loudly. */
function isCancellation(code: unknown): boolean {
  return typeof code === 'string' && /cancel/i.test(code)
}

/**
 * Drives the iOS StoreKit 2 subscription flow and reconciles it with the backend.
 *
 * Purchase: `requestPurchase` → StoreKit → `onPurchaseSuccess` delivers the signed transaction →
 * we verify it server-side (`/verify`), finish the transaction, then re-fetch the canonical plan.
 * Restore: read the device's current entitlements and `/sync` them.
 *
 * Server verification is the source of truth; `finishTransaction` runs only AFTER the backend has
 * accepted the JWS, so a network failure leaves the transaction unfinished and StoreKit re-delivers
 * it on the next connection rather than silently dropping a paid purchase.
 */
export function useAppleIap(enabled: boolean): AppleIap {
  const [phase, setPhase] = useState<IapPhase>('idle')
  const [activeSku, setActiveSku] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const fetchPlan = usePlanStore((s) => s.fetchPlan)

  // Guard async callbacks from running after unmount.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const {
    connected,
    // expo-iap keeps auto-renewable subscriptions in `subscriptions`, NOT `products` — the latter
    // only ever holds `type: 'in-app'` results. Reading `products` here left the paywall permanently
    // empty ("Chưa tải được gói nào") even with a fully-active Paid Apps Agreement.
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const jws = extractJws(purchase)
      if (!jws) {
        if (mounted.current) {
          setError('Không đọc được biên nhận giao dịch. Vui lòng thử khôi phục.')
          setPhase('idle')
          setActiveSku(null)
        }
        return
      }
      try {
        await verifyApplePurchase(jws)
        // Only finish once the server has recorded the entitlement.
        await finishTransaction({ purchase, isConsumable: false })
        await fetchPlan()
        if (mounted.current) setSucceeded(true)
      } catch {
        if (mounted.current) {
          setError('Kích hoạt gói chưa thành công. Giao dịch đã được ghi nhận — hãy thử “Khôi phục”.')
        }
      } finally {
        if (mounted.current) {
          setPhase('idle')
          setActiveSku(null)
        }
      }
    },
    onPurchaseError: (err) => {
      if (!mounted.current) return
      setPhase('idle')
      setActiveSku(null)
      if (!isCancellation((err as { code?: unknown })?.code)) {
        setError('Giao dịch không hoàn tất. Vui lòng thử lại.')
      }
    },
    onError: () => {
      if (mounted.current) setError('Không kết nối được App Store. Vui lòng thử lại sau.')
    },
  })

  // Load the product list once the store connection is ready.
  useEffect(() => {
    if (!enabled || !connected) return
    setPhase('loading')
    fetchProducts({ skus: SKUS, type: 'subs' })
      .catch(() => {
        if (mounted.current) setError('Không tải được danh sách gói.')
      })
      .finally(() => {
        if (mounted.current) setPhase('idle')
      })
  }, [enabled, connected, fetchProducts])

  const buy = useCallback(
    async (sku: string) => {
      if (!connected) {
        setError('Chưa kết nối App Store. Vui lòng thử lại sau giây lát.')
        return
      }
      setError(null)
      setSucceeded(false)
      setPhase('purchasing')
      setActiveSku(sku)
      try {
        const appAccountToken = await fetchAppleAccountToken()
        // Delivery is asynchronous via onPurchaseSuccess/onPurchaseError — those reset the phase.
        await requestPurchase({ request: { apple: { sku, appAccountToken } }, type: 'subs' })
      } catch {
        if (mounted.current) {
          setError('Không mở được cửa sổ thanh toán. Vui lòng thử lại.')
          setPhase('idle')
          setActiveSku(null)
        }
      }
    },
    [connected, requestPurchase],
  )

  const restore = useCallback(async () => {
    setError(null)
    setSucceeded(false)
    setPhase('restoring')
    try {
      const purchases = await getAvailablePurchases()
      const tokens = collectJwsTokens(purchases)
      if (tokens.length === 0) {
        if (mounted.current) setError('Không tìm thấy giao dịch nào để khôi phục.')
        return
      }
      const result = await syncApplePurchases(tokens)
      await fetchPlan()
      if (mounted.current) {
        if (result) setSucceeded(true)
        else setError('Không có gói đang hoạt động để khôi phục.')
      }
    } catch {
      if (mounted.current) setError('Khôi phục chưa thành công. Vui lòng thử lại.')
    } finally {
      if (mounted.current) setPhase('idle')
    }
  }, [fetchPlan])

  return {
    connected,
    products: sortByCatalogOrder(subscriptions),
    phase,
    activeSku,
    error,
    succeeded,
    buy,
    restore,
  }
}
