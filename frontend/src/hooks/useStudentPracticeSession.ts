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
export function useStudentPracticeSession(options?: { requireStudent?: boolean }) {
  const requireStudent = options?.requireStudent ?? true;
  const router = useRouter();
  const locale = useLocale();
  const [me, setMe] = useState<PracticeSessionUser | null>(null);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [practiceFloorLevel, setPracticeFloorLevel] = useState("A1");
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      const meRes = await api.get<PracticeSessionUser>("/auth/me");
      const userData = meRes.data;
      if (requireStudent && userData.role !== "STUDENT") {
        router.replace(`/${String(userData.role).toLowerCase()}`);
        return;
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
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [locale, requireStudent, router]);

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

  return { me, loading, targetLevel, practiceFloorLevel, streakDays, initials, reload: load };
}
