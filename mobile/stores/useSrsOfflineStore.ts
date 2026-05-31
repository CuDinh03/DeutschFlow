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
    try {
      await api.post('/srs/review/batch', { reviews: queue })
      writeQueue([])
      set({ pendingCount: 0, isSyncing: false })
    } catch {
      set({ isSyncing: false })
    }
  },
}))
