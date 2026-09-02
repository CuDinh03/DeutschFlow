import { create } from 'zustand'
import { MMKV } from 'react-native-mmkv'
import api from '@/lib/api'

const storage = new MMKV({ id: 'srs-offline' })
const QUEUE_KEY = 'offline_srs_queue'

interface SrsReview {
  vocabId: string
  quality: number
  reviewedAt: string
}

interface SrsOfflineState {
  pendingCount: number
  isSyncing: boolean

  enqueue: (vocabId: string, quality: number) => void
  sync: () => Promise<void>
  loadCount: () => void
  /**
   * Xoá sạch hàng đợi (MMKV + state) khi phiên kết thúc — review chưa đồng bộ
   * không gắn userId, để lại là `sync()` lần sau POST chúng bằng token của
   * TÀI KHOẢN KẾ TIẾP trên cùng máy (soát 02/09, F-24).
   */
  clear: () => void
}

function readQueue(): SrsReview[] {
  try {
    const raw = storage.getString(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as SrsReview[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: SrsReview[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue))
}

export const useSrsOfflineStore = create<SrsOfflineState>((set, get) => ({
  pendingCount: 0,
  isSyncing: false,

  loadCount: () => {
    const queue = readQueue()
    set({ pendingCount: queue.length })
  },

  enqueue: (vocabId, quality) => {
    const queue = readQueue()
    queue.push({ vocabId, quality, reviewedAt: new Date().toISOString() })
    writeQueue(queue)
    set({ pendingCount: queue.length })
  },

  sync: async () => {
    const queue = readQueue()
    if (queue.length === 0 || get().isSyncing) return

    set({ isSyncing: true })
    // Chốt số lượng TRƯỚC await: enqueue chen vào giữa lúc POST đang bay không
    // được phép bị xoá oan khi POST thành công (soát 02/09, Q-5/F-12).
    const sentCount = queue.length
    try {
      // Hợp đồng backend SrsController.reviewBatch: @RequestBody List<ReviewRequest>
      // — MẢNG TRẦN {vocabId, quality}, KHÔNG bọc {reviews: []} (soát 02/09, C-3:
      // body bọc từng bị 400 mọi lần và catch nuốt êm — queue kẹt vĩnh viễn).
      await api.post(
        '/srs/review/batch',
        queue.slice(0, sentCount).map(({ vocabId, quality }) => ({ vocabId, quality })),
      )
      const remaining = readQueue().slice(sentCount)
      writeQueue(remaining)
      set({ pendingCount: remaining.length, isSyncing: false })
    } catch {
      set({ isSyncing: false })
    }
  },

  clear: () => {
    writeQueue([])
    set({ pendingCount: 0 })
  },
}))
