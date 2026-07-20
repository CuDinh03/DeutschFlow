import { Suspense } from 'react'
import ClientPage from './client-page'

/**
 * /v2/org/accept — nhận lời mời tham gia trung tâm (bản Galerie 2.0 của /org/accept).
 *
 * VÌ SAO NẰM TRONG ROUTE GROUP `(public)` chứ không phải `src/app/v2/org/accept/`:
 * `src/app/v2/org/layout.tsx` bọc mọi thứ dưới nó bằng `<GaShell role="org">` — sidebar + top bar
 * của console trung tâm. Trang này là trang CÔNG KHAI: người được mời đến từ link trong email,
 * CHƯA đăng nhập và thường CHƯA có tài khoản, nên không được phép thấy vỏ console (nav trỏ vào các
 * trang cần quyền, top bar không có danh tính để hiển thị). Route group là cách duy nhất của App
 * Router để một segment thoát khỏi layout cha mà vẫn giữ nguyên URL: `(public)` không xuất hiện
 * trong đường dẫn → URL vẫn đúng là /v2/org/accept, nhưng layout áp dụng chỉ còn app/layout.tsx +
 * v2/layout.tsx (`.ga-scope`), KHÔNG có v2/org/layout.tsx.
 *
 * <Suspense> là BẮT BUỘC: client component bên dưới đọc `useSearchParams()` để lấy `?token=`.
 * Thiếu nó thì bước prerender của `next build` gãy.
 *
 * Fallback chỉ là một khối nền trống (không phải GaAuthShell): vỏ Galerie chỉ được dựng ở MỘT nơi
 * — client-page.tsx — nên fallback chỉ cần giữ đúng màu nền để không chớp trắng trước khi hydrate.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ga-bg" />}>
      <ClientPage />
    </Suspense>
  )
}
