"use client";

import { useEffect, useCallback, useRef } from "react";
import { get, set, del } from "idb-keyval";
import api from "@/lib/api";
import { Network } from "@capacitor/network";

const QUEUE_KEY = "srs_offline_queue";

interface QueuedReview {
  vocabId: string;
  quality: number;
  queuedAt: number;
}

/**
 * Persists SRS review results to IndexedDB while offline, then flushes them
 * to POST /api/srs/review/batch as soon as connectivity is restored.
 *
 * Usage:
 *   const { enqueue, pending } = useOfflineSrsQueue();
 *   await enqueue({ vocabId: "123", quality: 4 });
 */
export function useOfflineSrsQueue() {
  const isFlushing = useRef(false);

  const readQueue = useCallback(async (): Promise<QueuedReview[]> => {
    const stored = await get<QueuedReview[]>(QUEUE_KEY);
    return stored ?? [];
  }, []);

  const flush = useCallback(async () => {
    if (isFlushing.current) return;
    isFlushing.current = true;
    try {
      const queue = await readQueue();
      if (queue.length === 0) return;

      await api.post("/srs/review/batch", queue.map(({ vocabId, quality }) => ({ vocabId, quality })));
      await del(QUEUE_KEY);
    } catch {
      // Stay queued — will retry on next online event
    } finally {
      isFlushing.current = false;
    }
  }, [readQueue]);

  const enqueue = useCallback(
    async (review: { vocabId: string; quality: number }): Promise<boolean> => {
      const status = await Network.getStatus();
      if (status.connected) {
        try {
          await api.post("/srs/review", review);
          return true;
        } catch {
          // Fall through to queue on server error too
        }
      }
      const current = await readQueue();
      await set(QUEUE_KEY, [...current, { ...review, queuedAt: Date.now() }]);
      return false;
    },
    [readQueue]
  );

  // Listen for online events and flush
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    Network.addListener("networkStatusChange", (status) => {
      if (status.connected) flush();
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    // Flush on mount in case we just came back online
    Network.getStatus().then((s) => {
      if (s.connected) flush();
    });

    return () => {
      removeListener?.();
    };
  }, [flush]);

  return { enqueue, flush, readQueue };
}
