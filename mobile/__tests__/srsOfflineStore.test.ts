// Khoá hàng đợi ôn SRS offline (soát 02/09, F-12/C-3/Q-5): hợp đồng body MẢNG
// TRẦN với backend, race enqueue-giữa-lúc-sync, và clear() khi kết thúc phiên.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import api from '@/lib/api'
import { useSrsOfflineStore } from '@/stores/useSrsOfflineStore'

const post = api.post as unknown as jest.Mock

beforeEach(() => {
  post.mockReset()
  // Store là singleton module — dọn MMKV + state giữa các test bằng chính clear().
  useSrsOfflineStore.getState().clear()
})

describe('useSrsOfflineStore', () => {
  test('enqueue ghi MMKV và tăng pendingCount; loadCount đọc lại được', () => {
    useSrsOfflineStore.getState().enqueue('sg01_01', 5)
    useSrsOfflineStore.getState().enqueue('sg01_02', 2)

    expect(useSrsOfflineStore.getState().pendingCount).toBe(2)

    // Mô phỏng app mở lại: state mất, MMKV còn — loadCount phục hồi con số.
    useSrsOfflineStore.setState({ pendingCount: 0 })
    useSrsOfflineStore.getState().loadCount()
    expect(useSrsOfflineStore.getState().pendingCount).toBe(2)
  })

  test('sync gửi MẢNG TRẦN [{vocabId, quality}] — không bọc {reviews}, không field thừa (C-3)', async () => {
    post.mockResolvedValue({ data: undefined })
    useSrsOfflineStore.getState().enqueue('sg01_01', 5)

    await useSrsOfflineStore.getState().sync()

    // Hợp đồng backend SrsController.reviewBatch: @RequestBody List<ReviewRequest>.
    // Body bọc {reviews} từng bị 400 mọi lần và catch nuốt êm — queue kẹt vĩnh viễn.
    expect(post).toHaveBeenCalledWith('/srs/review/batch', [{ vocabId: 'sg01_01', quality: 5 }])
    expect(useSrsOfflineStore.getState().pendingCount).toBe(0)
  })

  test('enqueue chen vào GIỮA lúc sync không bị xoá oan khi sync thành công (Q-5)', async () => {
    let resolvePost: (v: unknown) => void = () => {}
    post.mockImplementation(() => new Promise((resolve) => { resolvePost = resolve }))

    useSrsOfflineStore.getState().enqueue('sg01_01', 5)
    const syncing = useSrsOfflineStore.getState().sync()

    // POST đang bay — người dùng chấm thêm một thẻ offline.
    useSrsOfflineStore.getState().enqueue('sg01_02', 3)

    resolvePost({ data: undefined })
    await syncing

    // Chỉ phần ĐÃ GỬI bị cắt; lượt chen giữa còn nguyên chờ lần sync sau.
    expect(useSrsOfflineStore.getState().pendingCount).toBe(1)
    useSrsOfflineStore.getState().loadCount()
    expect(useSrsOfflineStore.getState().pendingCount).toBe(1)
  })

  test('sync lỗi → queue GIỮ NGUYÊN (không mất lượt chấm), isSyncing hạ cờ', async () => {
    post.mockRejectedValue(new Error('offline'))
    useSrsOfflineStore.getState().enqueue('sg01_01', 5)

    await useSrsOfflineStore.getState().sync()

    expect(useSrsOfflineStore.getState().pendingCount).toBe(1)
    expect(useSrsOfflineStore.getState().isSyncing).toBe(false)
  })

  test('clear() xoá sạch MMKV + state (dọn phiên, F-24)', () => {
    useSrsOfflineStore.getState().enqueue('sg01_01', 5)
    useSrsOfflineStore.getState().clear()

    expect(useSrsOfflineStore.getState().pendingCount).toBe(0)
    useSrsOfflineStore.getState().loadCount()
    expect(useSrsOfflineStore.getState().pendingCount).toBe(0)
  })
})
