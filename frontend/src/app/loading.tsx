import '@/styles/galerie.css'
import { BrandPageLoader } from '@/components/ui-v2/BrandPageLoader'

/**
 * Màn chờ chuyển trang gốc (Next.js App Router `loading.tsx`).
 * Dùng biểu tượng chữ D vát cạnh chính thức xoay quỹ đạo thay cho màn hình trắng tinh.
 */
export default function GlobalRouteLoading() {
  return <BrandPageLoader label="myDeutschFlow" />
}
