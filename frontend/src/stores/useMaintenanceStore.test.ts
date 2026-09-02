import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProbeResult } from '@/lib/systemStatus'

// Store là bộ não trạng thái bảo trì phía client: signal (tín hiệu interceptor) đặt màn
// NGAY rồi probe xác nhận; refresh chuyển trạng thái theo probe; 'unknown' GIỮ NGUYÊN
// (mất mạng phía user không được coi là bảo trì, và cũng không được mở màn oan).

const probe = vi.hoisted(() => ({ fn: vi.fn<() => Promise<ProbeResult>>() }))

vi.mock('@/lib/systemStatus', () => ({
  probeSystemStatus: probe.fn,
}))

import { useMaintenanceStore } from './useMaintenanceStore'

beforeEach(() => {
  probe.fn.mockReset()
  useMaintenanceStore.setState({ active: false, info: null, upcoming: null, clockSkewMs: 0 })
})

describe('useMaintenanceStore', () => {
  it('signal: bật màn NGAY với info từ 503, rồi probe làm giàu (endsAt + serverTime → clockSkew)', async () => {
    probe.fn.mockResolvedValue({
      kind: 'maintenance',
      info: { windowId: 12, title: 'Nâng cấp CSDL', endsAtUtc: '2026-09-10T16:30:00Z', serverTimeUtc: new Date().toISOString() },
      upcoming: null,
    })

    useMaintenanceStore.getState().signal({ windowId: 12, title: 'Nâng cấp CSDL' })
    expect(useMaintenanceStore.getState().active).toBe(true) // không chờ probe

    await vi.waitFor(() => {
      expect(useMaintenanceStore.getState().info?.endsAtUtc).toBe('2026-09-10T16:30:00Z')
    })
  })

  it('refresh trả OK → hạ màn + trả true + cập nhật upcoming cho banner', async () => {
    useMaintenanceStore.setState({ active: true, info: { title: 'x' } })
    probe.fn.mockResolvedValue({
      kind: 'ok',
      payload: {
        status: 'OK',
        serverTimeUtc: new Date().toISOString(),
        active: null,
        upcoming: { id: 9, title: 'Bảo trì tối', mode: 'FULL', startsAtUtc: '2026-09-10T16:00:00Z', endsAtUtc: null },
      },
    })

    const recovered = await useMaintenanceStore.getState().refresh()
    expect(recovered).toBe(true)
    const s = useMaintenanceStore.getState()
    expect(s.active).toBe(false)
    expect(s.upcoming?.id).toBe(9)
  })

  it("probe 'unknown' (mất mạng phía user) GIỮ NGUYÊN trạng thái — đang chặn thì tiếp tục, đang mở thì không chặn oan", async () => {
    probe.fn.mockResolvedValue({ kind: 'unknown' })

    expect(await useMaintenanceStore.getState().refresh()).toBe(true) // đang mở → không phải "recovered from block"
    expect(useMaintenanceStore.getState().active).toBe(false)

    useMaintenanceStore.setState({ active: true, info: { title: 'x' } })
    expect(await useMaintenanceStore.getState().refresh()).toBe(false)
    expect(useMaintenanceStore.getState().active).toBe(true)
  })

  it('signal khi ĐANG active không ghi đè info hiển thị (chỉ probe refresh)', async () => {
    probe.fn.mockResolvedValue({ kind: 'unknown' })
    useMaintenanceStore.setState({ active: true, info: { title: 'Giữ nguyên' } })

    useMaintenanceStore.getState().signal({ title: 'Tín hiệu mới nghèo thông tin' })
    expect(useMaintenanceStore.getState().info?.title).toBe('Giữ nguyên')
  })
})
