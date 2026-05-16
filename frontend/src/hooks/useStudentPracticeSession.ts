"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import api, { httpStatus } from "@/lib/api";
import { getAccessToken, clearTokens } from "@/lib/authSession";
import { toastApiError } from "@/lib/toastApiError";

export type PracticeSessionUser = {
  displayName: string;
  role: string;
  userId?: number;
  email?: string | null;
  phoneNumber?: string | null;
  locale?: string;
  learningTargetLevel?: string | null;
  industry?: string | null;
};

type PlanMe = {
  plan?: {
    targetLevel?: string | null;
    currentLevel?: string | null;
  };
};

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function pickCefrBand(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const u = (c ?? "").trim().toUpperCase();
    if (CEFR_ORDER.includes(u as (typeof CEFR_ORDER)[number])) return u;
  }
  return "A1";
}

/**
 * Shared `/auth/me` + `/plan/me` + `/student/dashboard` fetch for practice routes using {@link StudentShell}.
 */
export function useStudentPracticeSession(options?: {
  requireStudent?: boolean;
  /** Set true on /onboarding page to avoid redirect loop */
  skipOnboardingCheck?: boolean;
}) {
  const requireStudent = options?.requireStudent ?? true;
  const skipOnboardingCheck = options?.skipOnboardingCheck ?? false;
  const router = useRouter();
  const locale = useLocale();
  const [me, setMe] = useState<PracticeSessionUser | null>(null);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [practiceFloorLevel, setPracticeFloorLevel] = useState("A1");
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const meRes = await api.get<PracticeSessionUser>("/auth/me");
      const userData = meRes.data;
      console.log("useStudentPracticeSession userData:", userData, typeof userData);
      
      if (requireStudent && userData.role !== "STUDENT") {
        console.log("Redirecting to role:", userData.role);
        router.replace(`/${String(userData.role).toLowerCase()}`);
        return;
      }

      // Onboarding guard — redirect students who haven't completed onboarding
      if (requireStudent && !skipOnboardingCheck) {
        const statusRes = await api.get<{ hasPlan: boolean }>("/onboarding/status").catch(() => null);
        if (statusRes?.data?.hasPlan === false) {
          router.replace("/onboarding");
          return;
        }
      }

      const [planRes, dashRes] = await Promise.all([
        api.get<PlanMe>("/plan/me").catch(() => null),
        api.get<{ streakDays?: number }>("/student/dashboard").catch(() => null),
      ]);

      const plan = planRes?.data?.plan;
      const tl = plan?.targetLevel ?? userData.learningTargetLevel ?? "A1";
      const cur = plan?.currentLevel ?? tl;
      setMe(userData);
      setTargetLevel(pickCefrBand(tl));
      setPracticeFloorLevel(pickCefrBand(cur, tl, userData.learningTargetLevel));
      setStreakDays(Number(dashRes?.data?.streakDays ?? 0));
    } catch (err: unknown) {
      const st = httpStatus(err);
      if (st === 401 || st === 403) {
        clearTokens();
        toastApiError(err, { locale });
        router.replace("/login");
        return;
      }
      // Network error / timeout / server down — expose error so UI can show retry
      const isTimeout = (err as { code?: string })?.code === "ECONNABORTED" || st === 0;
      setLoadError(
        isTimeout
          ? "Không kết nối được server. Vui lòng kiểm tra kết nối và thử lại."
          : `Lỗi server (${st || "unknown"}). Vui lòng thử lại.`
      );
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [locale, requireStudent, skipOnboardingCheck, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const initials = useMemo(
    () =>
      (me?.displayName ?? "U")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
    [me?.displayName],
  );

  return { me, loading, loadError, targetLevel, practiceFloorLevel, streakDays, initials, reload: load };
}
