import { get, set } from 'idb-keyval';
import api from '@/lib/api';

const DUE_CARDS_KEY = 'offline_due_cards';
const PENDING_REVIEWS_KEY = 'offline_pending_reviews';

export interface PendingReview {
  vocabId: string;
  quality: number;
  timestamp: number;
}

export const offlineSync = {
  // --- Due Cards ---
  saveDueCards: async (cards: any[]) => {
    try {
      await set(DUE_CARDS_KEY, cards);
    } catch (e) {
      console.warn('Failed to save due cards to IndexedDB', e);
    }
  },

  getDueCards: async (): Promise<any[]> => {
    try {
      const cards = await get(DUE_CARDS_KEY);
      return Array.isArray(cards) ? cards : [];
    } catch (e) {
      console.warn('Failed to get due cards from IndexedDB', e);
      return [];
    }
  },

  // --- Pending Reviews ---
  savePendingReview: async (vocabId: string, quality: number) => {
    try {
      const pending: PendingReview[] = (await get(PENDING_REVIEWS_KEY)) || [];
      pending.push({ vocabId, quality, timestamp: Date.now() });
      await set(PENDING_REVIEWS_KEY, pending);
    } catch (e) {
      console.warn('Failed to save pending review', e);
    }
  },

  getPendingReviews: async (): Promise<PendingReview[]> => {
    try {
      const pending = await get(PENDING_REVIEWS_KEY);
      return Array.isArray(pending) ? pending : [];
    } catch (e) {
      console.warn('Failed to get pending reviews', e);
      return [];
    }
  },

  clearPendingReviews: async () => {
    try {
      await set(PENDING_REVIEWS_KEY, []);
    } catch (e) {
      console.warn('Failed to clear pending reviews', e);
    }
  },

  // --- Auto Sync ---
  syncPendingReviews: async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;

    const pending = await offlineSync.getPendingReviews();
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} pending reviews...`);
    
    const successfulIds: string[] = [];
    
    for (const review of pending) {
      try {
        await api.post("/srs/review", { vocabId: review.vocabId, quality: review.quality });
        successfulIds.push(review.vocabId);
      } catch (err) {
        console.error(`Failed to sync review for ${review.vocabId}`, err);
      }
    }

    // Keep only the ones that failed to sync
    const remaining = pending.filter(p => !successfulIds.includes(p.vocabId));
    await set(PENDING_REVIEWS_KEY, remaining);
    
    if (successfulIds.length > 0) {
      console.log(`Successfully synced ${successfulIds.length} reviews`);
    }
  }
};
