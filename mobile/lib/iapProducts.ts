/**
 * Pure, native-free helpers for the Apple StoreKit paywall.
 *
 * Everything here is deterministic and unit-tested — no `expo-iap` / StoreKit import — so the
 * product catalog and the JWS-extraction logic can be verified without a device build.
 *
 * The product identifiers MUST match, exactly:
 *   • App Store Connect subscription product IDs, and
 *   • the backend `apple_products` seed (migration V189).
 * The backend resolves productId → plan on `/api/payments/apple/verify`; a mismatch means a real
 * purchase can never be activated.
 */

export type PlanCode = 'PRO' | 'ULTRA'

export interface AppleProductMeta {
  readonly productId: string
  readonly planCode: PlanCode
  readonly durationMonths: number
}

/** The four auto-renewable subscriptions seeded in the backend (V189). Order = display order. */
export const APPLE_PRODUCT_IDS = [
  'com.deutschflow.app.pro.monthly',
  'com.deutschflow.app.pro.yearly',
  'com.deutschflow.app.ultra.monthly',
  'com.deutschflow.app.ultra.yearly',
] as const

export type AppleProductId = (typeof APPLE_PRODUCT_IDS)[number]

export const APPLE_PRODUCT_META: Readonly<Record<AppleProductId, AppleProductMeta>> = {
  'com.deutschflow.app.pro.monthly': { productId: 'com.deutschflow.app.pro.monthly', planCode: 'PRO', durationMonths: 1 },
  'com.deutschflow.app.pro.yearly': { productId: 'com.deutschflow.app.pro.yearly', planCode: 'PRO', durationMonths: 12 },
  'com.deutschflow.app.ultra.monthly': { productId: 'com.deutschflow.app.ultra.monthly', planCode: 'ULTRA', durationMonths: 1 },
  'com.deutschflow.app.ultra.yearly': { productId: 'com.deutschflow.app.ultra.yearly', planCode: 'ULTRA', durationMonths: 12 },
}

/** Minimal structural shape of an expo-iap purchase — only the field we read. */
interface PurchaseLike {
  readonly purchaseToken?: string | null
}

/** Minimal structural shape of an expo-iap product — only the fields we read. */
interface ProductLike {
  readonly id: string
}

/**
 * StoreKit 2 signed-transaction JWS for a purchase. expo-iap exposes it as the unified
 * `purchaseToken` (iOS JWS / Android token). Returns null when absent or empty — callers must
 * treat null as "nothing to verify" rather than sending an empty body to the backend.
 */
export function extractJws(purchase: PurchaseLike | null | undefined): string | null {
  const token = purchase?.purchaseToken
  return typeof token === 'string' && token.length > 0 ? token : null
}

/** De-duplicated list of JWS tokens from restorable purchases, preserving input order. */
export function collectJwsTokens(purchases: ReadonlyArray<PurchaseLike> | null | undefined): string[] {
  if (!purchases) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of purchases) {
    const jws = extractJws(p)
    if (jws && !seen.has(jws)) {
      seen.add(jws)
      out.push(jws)
    }
  }
  return out
}

/** Known plan metadata for a product id, or null for an id we don't recognise. */
export function metaForProductId(productId: string): AppleProductMeta | null {
  return (APPLE_PRODUCT_META as Record<string, AppleProductMeta>)[productId] ?? null
}

/**
 * Order fetched StoreKit products by the catalog order above. StoreKit returns products in an
 * unspecified order; this keeps the paywall stable (PRO monthly → PRO yearly → ULTRA …). Unknown
 * ids sink to the end but are retained.
 */
export function sortByCatalogOrder<T extends ProductLike>(products: ReadonlyArray<T>): T[] {
  const rank = new Map<string, number>(APPLE_PRODUCT_IDS.map((id, i) => [id, i]))
  return [...products].sort((a, b) => (rank.get(a.id) ?? APPLE_PRODUCT_IDS.length) - (rank.get(b.id) ?? APPLE_PRODUCT_IDS.length))
}
