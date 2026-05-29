"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

const POLL_MS = 5 * 60 * 1_000;

export function useReviewDueCount(): number {
  const [dueCount, setDueCount] = useState(0);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get<{ dueCount: number }>("/srs/count");
      setDueCount(typeof data.dueCount === "number" ? Math.max(0, data.dueCount) : 0);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    void fetch();
    const id = window.setInterval(() => void fetch(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetch]);

  return dueCount;
}
