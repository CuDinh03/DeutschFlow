import { Suspense } from 'react'
import { CompanionSelect } from '@/components/features/ai-speaking/CompanionSelect'

// Chọn nhân vật + chế độ (hội thoại / phỏng vấn / luyện tập) → tạo phiên → vào engine
// /v2/student/speaking/live. Đây là bản v2 của trang v1 `/speaking`: TÁI DÙNG nguyên
// <CompanionSelect> (logic tạo phiên, quota, paywall giữ nguyên 1:1), chỉ tiêm route v2 +
// đổi vỏ (layout="shell" vì đã nằm trong <main> của GaShell, không tự dựng thêm 100vh).
// Suspense là BẮT BUỘC: CompanionSelect dùng useSearchParams (?topic/?cefr/?mode/?return),
// thiếu Suspense sẽ vỡ ở bước prerender khi build.
export default function V2StudentSpeakingSetupPage() {
  return (
    <Suspense>
      <CompanionSelect
        layout="shell"
        chatHref="/v2/student/speaking/live"
        pricingHref="/v2/payment"
        homeHref="/v2/student/speaking"
      />
    </Suspense>
  )
}
