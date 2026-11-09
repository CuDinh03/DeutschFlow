'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  applyFilterPatch,
  parseFilters,
  serializeFilters,
  type FilterSpec,
  type FilterValues,
} from '@/lib/urlFilters'

/**
 * Đọc/ghi bộ lọc của trang trên query string (xem `lib/urlFilters.ts`).
 *
 * - Ghi bằng `router.replace` (không chồng lịch sử mỗi lần gõ) và `scroll: false`.
 * - Đổi bất kỳ field nào khác `page` → về trang mặc định.
 * - Trang dùng hook này PHẢI bọc component trong `<Suspense>` (yêu cầu của `useSearchParams`
 *   trong App Router khi build tĩnh).
 * - Ô tìm kiếm tự debounce ở phía trang (giữ chữ đang gõ trong state cục bộ, `set` sau ~300ms).
 */
export function useUrlFilters<S extends FilterSpec>(spec: S, pageKey = 'page') {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const values = useMemo(() => parseFilters(spec, searchParams), [spec, searchParams])

  const write = useCallback(
    (next: Partial<FilterValues<S>>) => {
      const qs = serializeFilters(spec, next, searchParams).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [spec, searchParams, router, pathname],
  )

  const set = useCallback(
    (patch: Partial<FilterValues<S>>) => write(applyFilterPatch(spec, values, patch, pageKey)),
    [spec, values, pageKey, write],
  )

  const reset = useCallback(() => {
    const defaults: Record<string, string | number> = {}
    for (const key of Object.keys(spec)) defaults[key] = spec[key].default
    write(defaults as Partial<FilterValues<S>>)
  }, [spec, write])

  return { values, set, reset }
}
