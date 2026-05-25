"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import api, { httpStatus } from "@/lib/api";
import { getAccessToken, getRefreshToken, clearTokens } from "@/lib/authSession";
import { toastApiError } from "@/lib/toastApiError";
import posthog from "posthog-js";

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

export type RoadmapMeta = {
  roadmapVersion?: string | null;
  roadmapType?: string | null;
  entryNodeCode?: string | null;
  currentLevel?: string | null;
  targetLevel?: string | null;
  currentNodeCode?: string | null;
  completedNodes?: number | null;
  totalNodes?: number | null;
  progressPercent?: number | null;
  progressModel?: string | null;
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
 * Shared `/auth/me` + `/roadmap/me/meta` + `/student/dashboard` fetch for practice routes using {@link StudentShell}.
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
  const [practiceFloorLevel] = useState("A1");
  const [roadmapMeta, setRoadmapMeta] = useState<RoadmapMeta | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dùng để theo dõi xem streak có vừa được cộng không
  const prevStreakRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const startedAt = Date.now();
    const accessToken = getAccessToken();
    const refreshToken = typeof window !== "undefined" ? window.localStorage.getItem("refreshToken") : null;
    console.log("[DF_TRACE][useStudentPracticeSession.load:start]", {
      ts: startedAt,
      accessTokenExists: Boolean(accessToken),
      refreshTokenExists: Boolean(refreshToken),
      requireStudent,
      skipOnboardingCheck,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      stack: new Error().stack,
    });
    if (!accessToken) {
      console.log("[DF_TRACE][useStudentPracticeSession.load:redirect-login:no-access-token]", {
        ts: Date.now(),
        elapsedMs: Date.now() - startedAt,
      });
      router.replace("/login");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      console.log("[DF_TRACE][useStudentPracticeSession.load:dispatch:/auth/me]", {
        ts: Date.now(),
        url: "/auth/me",
        accessTokenExists: Boolean(accessToken),
        refreshTokenExists: Boolean(refreshToken),
      });
      const meRes = await api.get<PracticeSessionUser>("/auth/me");
      const userData = meRes.data;
      console.log("[DF_TRACE][useStudentPracticeSession.load:auth-me:success]", {
        ts: Date.now(),
        elapsedMs: Date.now() - startedAt,
        userData,
      });
      
      if (requireStudent && userData.role !== "STUDENT") {
        console.log("[DF_TRACE][useStudentPracticeSession.load:redirect-role]", {
          ts: Date.now(),
          role: userData.role,
          elapsedMs: Date.now() - startedAt,
        });
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

      const [roadmapMetaRes, dashRes] = await Promise.all([
        api.get<RoadmapMeta>("/roadmap/me/meta").catch(() => null),
        api.get<{ streakDays?: number }>("/student/dashboard").catch(() => null),
      ]);

      const roadmapMetaData = roadmapMetaRes?.data ?? null;
      const tl = roadmapMetaData?.targetLevel ?? userData.learningTargetLevel ?? "A1";
      setMe(userData);
      setRoadmapMeta(roadmapMetaData);
      setTargetLevel(pickCefrBand(tl));
      const newStreak = Number(dashRes?.data?.streakDays ?? 0);
      
      // Track retention/habit milestone nếu streak tăng
      if (prevStreakRef.current !== null && newStreak > prevStreakRef.current) {
        if (posthog.__loaded) posthog.capture('streak_extended', { streakDays: newStreak });
      }
      prevStreakRef.current = newStreak;

      setStreakDays(newStreak);
    } catch (err: unknown) {
      const st = httpStatus(err);
      console.log("[DF_TRACE][useStudentPracticeSession.load:error]", {
        ts: Date.now(),
        elapsedMs: Date.now() - startedAt,
        status: st,
        message: (err as { message?: string })?.message,
        stack: err instanceof Error ? err.stack : null,
      });
      if (st === 401 || st === 403) {
        console.log("[DF_TRACE][useStudentPracticeSession.load:auth-invalid]", {
          ts: Date.now(),
          status: st,
          accessTokenExists: Boolean(getAccessToken()),
          refreshTokenExists: Boolean(getRefreshToken()),
        });
        clearTokens();
        toastApiError(err, { locale });
        console.log("[DF_TRACE][useStudentPracticeSession.load:redirect-login:auth-error]", {
          ts: Date.now(),
          elapsedMs: Date.now() - startedAt,
        });
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
      console.log("[DF_TRACE][useStudentPracticeSession.load:finally]", {
        ts: Date.now(),
        elapsedMs: Date.now() - startedAt,
      });
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

  return { me, loading, loadError, targetLevel, practiceFloorLevel, roadmapMeta, streakDays, initials, reload: load };
}
