"use client";

import { useCallback, useEffect, useState } from "react";
import { aiSpeakingApi, type AiSpeakingQuota } from "@/lib/aiSpeakingApi";
import { isAiSpeakingQuotaBlocked } from "@/lib/aiSpeakingQuota";

export function useAiSpeakingQuota() {
  const [quota, setQuota] = useState<AiSpeakingQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await aiSpeakingApi.getQuota();
      setQuota(res.data);
      return res.data;
    } catch {
      setQuota(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const quotaBlocked = isAiSpeakingQuotaBlocked(quota);

  return { quota, quotaBlocked, quotaLoading: loading, refreshQuota };
}
