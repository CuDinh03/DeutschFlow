"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/authSession";

/**
 * Hình dạng `GET /auth/me/plan` (MyPlanResponse). Bốn trường đầu có từ trước; `isTrial` /
 * `trialEndsAt` là phần mở rộng thuần bổ sung của GĐ 2 (#413) — client bỏ qua chúng suốt
 * từ đó nên paywall web chưa bao giờ biết người dùng đang dùng thử.
 */
export type MyPlanDto = {
  planCode: string;
  tier: string;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  source?: string | null;
};

/**
 * Đang trong thời gian dùng thử = `isTrial` VÀ hạn dùng thử còn ở tương lai.
 * Quyết định owner 28/08 (Q1): suốt thời gian này client ẨN mọi lời mời nâng cấp chủ động.
 * Đừng suy ra trial từ `tier`/`planCode`: người đã trả tiền cũng là PRO và họ KHÔNG được ẩn
 * paywall gia hạn. Hàm thuần để test bảng; `now` truyền vào cho test khỏi phụ thuộc đồng hồ.
 */
export function isTrialActive(plan: MyPlanDto | null | undefined, now: number = Date.now()): boolean {
  if (!plan || plan.isTrial !== true || !plan.trialEndsAt) return false;
  const ends = Date.parse(plan.trialEndsAt);
  if (Number.isNaN(ends)) return false;
  return ends > now;
}

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
  const pathname = usePathname();

  const fetchPlan = useCallback(async () => {
    if (!getAccessToken()) {
      setPlan(null);
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

  // Provider nằm ở layout /v2 nên sống xuyên suốt đăng nhập → dashboard. Lần mount đầu
  // (trang login, chưa có token) trả null; khi đường dẫn đổi mà đã có token và chưa có plan
  // thì nạp — không thì người vừa đăng nhập mang plan=null tới tận lần F5 kế tiếp.
  useEffect(() => {
    if (plan === null || !getAccessToken()) void fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, fetchPlan]);

  return (
    <PlanContext.Provider value={{ plan, loading, refreshPlan: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

export function usePlanHelpers() {
  const { plan, loading } = useContext(PlanContext);
  const isPro = plan?.planCode === "PRO" || plan?.planCode === "ULTRA";
  const isUltra = plan?.planCode === "ULTRA";
  const isFree = !isPro;
  const trialActive = isTrialActive(plan);
  /** Ẩn mọi lời mời nâng cấp chủ động: đã trả tiền HOẶC đang dùng thử (Q1 28/08). */
  const hideUpsell = isPro || trialActive;
  return { isPro, isUltra, isFree, trialActive, hideUpsell, loading };
}
