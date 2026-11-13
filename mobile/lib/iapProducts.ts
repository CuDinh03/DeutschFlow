/**
 * Pure, native-free helpers for the Apple StoreKit paywall.
 *
 * Everything here is deterministic and unit-tested — no `expo-iap` / StoreKit import — so the
 * product catalog and the JWS-extraction logic can be verified without a device build.
 *
 * The product identifiers MUST match, exactly:
 *   • App Store Connect subscription product IDs, and
 *   • the backend `apple_products` seed (migration V387; V189 seeded the retired com.deutschflow.app.* ids).
 * The backend resolves productId → plan on `/api/payments/apple/verify`; a mismatch means a real
 * purchase can never be activated.
 */

export type PlanCode = 'PRO' | 'ULTRA'

export interface AppleProductMeta {
  readonly productId: string
  readonly planCode: PlanCode
  readonly durationMonths: number
  /** Tên gói hiển thị trên paywall (không lấy tiêu đề StoreKit để các kênh gọi tên giống nhau). */
  readonly label: string
  /** Nhãn nhỏ cạnh tên gói — chỉ gói chính có. */
  readonly badge?: string
  /** Một dòng giải thích dưới giá. Không ghi số tiền: giá luôn lấy từ StoreKit (displayPrice). */
  readonly note?: string
}

/**
 * Bộ sản phẩm owner chốt 14/11/2026 (QĐ-QG-18..20): Pro tháng 249.000đ (chim mồi), Pro 2 tháng 399.000đ
 * (gói chính, đặt giữa), Tăng tốc 2 tháng 599.000đ (mã ULTRA, 400.000 token/ngày). Cả ba là thuê bao tự
 * gia hạn cùng một nhóm trên App Store Connect; khớp migration V387. Thứ tự = thứ tự hiển thị.
 */
export const APPLE_PRODUCT_IDS = [
  'com.cudinh.mydeutschflow.pro.monthly',
  'com.cudinh.mydeutschflow.pro.twomonths',
  'com.cudinh.mydeutschflow.boost.twomonths',
] as const

export type AppleProductId = (typeof APPLE_PRODUCT_IDS)[number]

export const APPLE_PRODUCT_META: Readonly<Record<AppleProductId, AppleProductMeta>> = {
  'com.cudinh.mydeutschflow.pro.monthly': {
    productId: 'com.cudinh.mydeutschflow.pro.monthly',
    planCode: 'PRO',
    durationMonths: 1,
    label: 'Pro tháng',
  },
  'com.cudinh.mydeutschflow.pro.twomonths': {
    productId: 'com.cudinh.mydeutschflow.pro.twomonths',
    planCode: 'PRO',
    durationMonths: 2,
    label: 'Pro 2 tháng',
    badge: 'Gói chính',
    note: 'Cùng quyền với Pro tháng, rẻ hơn mua gói tháng hai lần. Hợp với một đợt ôn thi.',
  },
  'com.cudinh.mydeutschflow.boost.twomonths': {
    productId: 'com.cudinh.mydeutschflow.boost.twomonths',
    planCode: 'ULTRA',
    durationMonths: 2,
    label: 'Tăng tốc 2 tháng',
    note: 'Quyền như Pro, hạn mức AI mỗi ngày gấp đôi. Dành cho người luyện hơn 4–5 phiên nói mỗi ngày.',
  },
}

/** Nhãn kỳ thanh toán đặt sau giá, ví dụ "/2 tháng". */
export function periodLabel(durationMonths: number | null | undefined): string {
  if (!durationMonths || durationMonths < 1) return ''
  if (durationMonths === 1) return '/tháng'
  if (durationMonths === 12) return '/năm'
  return `/${durationMonths} tháng`
}

/** Tên gói cho người dùng từ `tier`/`planCode` của backend: ULTRA bán dưới tên "Tăng tốc" (14/11/2026). */
export function planDisplayName(tier: string | null | undefined): string {
  switch ((tier ?? '').toUpperCase()) {
    case 'ULTRA':
      return 'Tăng tốc'
    case 'PRO':
      return 'Pro'
    case '':
    case 'FREE':
    case 'DEFAULT':
      return 'Miễn phí'
    default:
      return tier as string
  }
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
 * unspecified order; this keeps the paywall stable (Pro tháng → Pro 2 tháng → Tăng tốc). Unknown
 * ids sink to the end but are retained.
 */
export function sortByCatalogOrder<T extends ProductLike>(products: ReadonlyArray<T>): T[] {
  const rank = new Map<string, number>(APPLE_PRODUCT_IDS.map((id, i) => [id, i]))
  return [...products].sort((a, b) => (rank.get(a.id) ?? APPLE_PRODUCT_IDS.length) - (rank.get(b.id) ?? APPLE_PRODUCT_IDS.length))
}
