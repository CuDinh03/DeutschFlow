"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";

export type MyPlanDto = {
  planCode: string;
  tier: string;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
};

interface PlanContextType {
  plan: MyPlanDto | null;
  loading: boolean;
  refreshPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType>({
  plan: null,
  loading: true,
  refreshPlan: async () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<MyPlanDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await api.get<MyPlanDto>("/auth/me/plan");
      setPlan(res.data);
    } catch (e) {
      console.warn("Failed to fetch plan:", e);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return (
    <PlanContext.Provider value={{ plan, loading, refreshPlan: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
