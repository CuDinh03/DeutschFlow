// Dọn trạng thái per-THIẾT BỊ của tài khoản vừa rời máy.
//
// Vì sao tách khỏi useAuthStore.logout: có HAI đường kết thúc phiên, và đường
// phổ biến hơn lại không đi qua logout().
//   1. Người dùng bấm "Đăng xuất"  → useAuthStore.logout()
//   2. Refresh token hết hạn/hỏng → interceptor 401 trong lib/api.ts
// Trước khi có hàm này chỉ đường (1) dọn dẹp, nên người bỏ app quá hạn refresh
// token vẫn bị nhắc học 20:00 hằng đêm (lịch nằm trong OS, gỡ không được qua
// app vì cờ `df_starter_reminder_on` cũng còn), và tài khoản kế tiếp đăng nhập
// trên máy đó thừa hưởng mục tiêu phút/ngày, cờ tour, checklist tuần đầu của
// người trước (QA 2026-08-20, F-3/F-4).
//
// Cố ý KHÔNG đụng df_ai_consent_v1 — consent chia sẻ dữ liệu với AI là quyết
// định ở mức thiết bị, có màn riêng trong Hồ sơ để thu hồi.

import { useTourStore } from '@/stores/useTourStore'
import { useStarterStore } from '@/stores/useStarterStore'
import { clearDailyGoalMinutes } from './dailyGoal'
import { clearOnboardingDraft } from './onboardingDraft'
import { disableStudyReminder } from './studyReminder'

/**
 * Best-effort, không bao giờ throw.
 *
 * allSettled chứ không phải all: một bước dọn hỏng không được phép chặn phần
 * kết thúc phiên chạy sau nó, kẻo người dùng kẹt trạng thái "đã đăng nhập" với
 * token vừa bị xoá và mọi request sau đó 401.
 */
export async function clearDeviceSessionState(): Promise<void> {
  await Promise.allSettled([
    useTourStore.getState().reset(),
    useStarterStore.getState().reset(),
    clearDailyGoalMinutes(),
    clearOnboardingDraft(),
    disableStudyReminder(),
  ])
}
