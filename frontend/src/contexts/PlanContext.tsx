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

/** Gói có ví token AI được cộng mỗi ngày (backend `QuotaService.isWalletPlan`). */
const WALLET_PLAN_CODES = new Set(["PRO", "ULTRA"]);

/**
 * Người dùng có LƯỢT AI TỰ HỒI ngày mai hay không — quyết định owner 10/11/2026: gói trả tiền mà
 * ví về 0 giữa kỳ thì VẪN giữ gói, chỉ chức năng AI tạm dừng tới lần cộng ví hôm sau. Khi `true`,
 * thông điệp hết hạn mức nói "ngày mai bạn có lượt mới" và KHÔNG mời nâng cấp (họ đã mua rồi).
 *
 *   - đang dùng thử còn hạn ({@link isTrialActive}) → true;
 *   - `isTrial` mà hạn dùng thử đã qua/thiếu/hỏng → false (plan trên máy có thể trễ so với backend);
 *   - gói ví (planCode/tier PRO|ULTRA) và `endsAtUtc` còn ở tương lai hoặc null (không kỳ hạn) → true;
 *   - FREE/DEFAULT, gói đã quá `endsAtUtc`, plan null → false (giữ lời mời nâng cấp như cũ).
 *
 * Giả định: `/auth/me/plan` không có cờ "đã trả tiền" riêng — `planCode` PRO/ULTRA không phải trial
 * được coi là gói trả tiền/được cấp (kể cả `source` ORG: ví cá nhân của họ cũng được cộng mỗi ngày).
 * Hàm thuần; `now` truyền vào để test bảng.
 */
export function hasRenewingAiAllowance(plan: MyPlanDto | null | undefined, now: number = Date.now()): boolean {
  if (!plan) return false;
  if (plan.isTrial === true) return isTrialActive(plan, now);
  const code = (plan.planCode ?? "").trim().toUpperCase();
  const tier = (plan.tier ?? "").trim().toUpperCase();
  if (!WALLET_PLAN_CODES.has(code) && !WALLET_PLAN_CODES.has(tier)) return false;
  if (plan.endsAtUtc == null) return true;
  const ends = Date.parse(plan.endsAtUtc);
  return !Number.isNaN(ends) && ends > now;
}

/**
 * Có nên dùng câu "ngày mai có lượt mới" cho MỘT lỗi hết hạn mức cụ thể không. Ngoài
 * {@link hasRenewingAiAllowance}, loại các mã KHÔNG phải ví cá nhân: `ORG_BUDGET_*` (ngân sách
 * trung tâm — chờ tới mai không giải quyết được gì) và `RATE_LIMITED` (thao tác quá nhanh).
 * `errorCode` là `extensions.code` của problem+json; thiếu mã → coi như hết ví cá nhân.
 */
export function showsRenewingQuotaCopy(
  plan: MyPlanDto | null | undefined,
  errorCode?: string | null,
  now: number = Date.now(),
): boolean {
  if (errorCode === "ORG_BUDGET_EXHAUSTED" || errorCode === "ORG_BUDGET_NOT_CONFIGURED" || errorCode === "RATE_LIMITED") {
    return false;
  }
  return hasRenewingAiAllowance(plan, now);
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
  /** Hết lượt AI thì nói "ngày mai có lượt mới" thay cho lời mời nâng cấp (10/11/2026). */
  const renewingAiAllowance = hasRenewingAiAllowance(plan);
  return { isPro, isUltra, isFree, trialActive, hideUpsell, renewingAiAllowance, loading };
}
