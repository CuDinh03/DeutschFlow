import { create } from 'zustand'
import { probeSystemStatus, type MaintenanceInfo, type MaintenanceWindowPublic } from '@/lib/maintenance'

/**
 * Trạng thái bảo trì phía client (mobile, thiết kế §8). Interceptor axios bắn
 * `signal()` khi gặp 503 MAINTENANCE → màn chặn hiện NGAY, rồi probe xác nhận;
 * probe nói OK (503 lạc) thì tự hạ màn. Đây là "bộ não", còn `MaintenanceOverlay`
 * chỉ render theo store — cùng pattern web (useMaintenanceStore + overlay).
 *
 * KHÔNG điều hướng ở đây (không router.replace) — footgun crash root layout đã
 * ghi tại app/_layout.tsx: overlay là một lớp phủ absolute, không phải một route.
 */
type MaintenanceStore = {
  active: boolean
  info: MaintenanceInfo | null
  upcoming: MaintenanceWindowPublic | null
  /** serverTimeUtc − Date.now() lúc probe (ms) — countdown bù lệch đồng hồ máy. */
  clockSkewMs: number
  signal: (info: MaintenanceInfo) => void
  /** Probe xác nhận/refresh; trả true nếu hệ thống đã OK (đã tự hạ màn). */
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
    // 'unknown' — mất mạng phía user / probe chưa trả lời: GIỮ NGUYÊN trạng thái.
    return !get().active
  },

  clear: () => set({ active: false, info: null }),
}))
