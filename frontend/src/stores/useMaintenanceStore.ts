import { create } from 'zustand'
import {
  probeSystemStatus,
  type MaintenanceInfo,
  type MaintenanceWindowPublic,
} from '@/lib/systemStatus'

/**
 * Trạng thái bảo trì phía client — nhân bản pattern `useAuthRecoveryStore` +
 * `AuthRecoveryDialog`: interceptor (không phải React) bắn tín hiệu vào store,
 * `MaintenanceOverlay` mount toàn cục ở root layout render theo store.
 *
 * `signal()` là đường vào từ interceptor: đặt trạng thái active NGAY (người dùng thấy
 * màn bảo trì tức thì thay vì lỗi rời rạc) rồi xác nhận lại bằng probe — probe nói OK
 * (báo động giả: một 503 lạc) thì tự hạ màn.
 */
type MaintenanceStore = {
  /** Đang chặn — overlay hiện. */
  active: boolean
  info: MaintenanceInfo | null
  /** Lịch sắp tới (banner đếm ngược) — cập nhật từ mọi lần probe. */
  upcoming: MaintenanceWindowPublic | null
  /** Đồng hồ lệch: serverTimeUtc − Date.now() tại thời điểm probe (ms). */
  clockSkewMs: number
  signal: (info: MaintenanceInfo) => void
  /** Probe xác nhận/refresh; trả về true nếu hệ thống đã OK (đã tự hạ màn). */
  refresh: () => Promise<boolean>
  clear: () => void
}

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  active: false,
  info: null,
  upcoming: null,
  clockSkewMs: 0,

  signal: (info) => {
    if (!get().active) {
      set({ active: true, info })
    }
    // Xác nhận + làm giàu info (endsAt/serverTime) — fire and forget.
    void get().refresh()
  },

  refresh: async () => {
    const result = await probeSystemStatus()
    if (result.kind === 'ok') {
      const skew = Date.parse(result.payload.serverTimeUtc) - Date.now()
      set({
        active: false,
        info: null,
        upcoming: result.payload.upcoming,
        clockSkewMs: Number.isFinite(skew) ? skew : 0,
      })
      return true
    }
    if (result.kind === 'maintenance') {
      const skew = result.info.serverTimeUtc ? Date.parse(result.info.serverTimeUtc) - Date.now() : get().clockSkewMs
      set({
        active: true,
        info: result.info,
        upcoming: result.upcoming ?? get().upcoming,
        clockSkewMs: Number.isFinite(skew) ? skew : get().clockSkewMs,
      })
      return false
    }
    // 'unknown' — mất mạng phía user hoặc probe chưa trả lời được: GIỮ NGUYÊN trạng thái
    // hiện tại (đang chặn thì tiếp tục chặn tới lần poll sau; đang mở thì không chặn oan).
    return !get().active
  },

  clear: () => set({ active: false, info: null }),
}))
