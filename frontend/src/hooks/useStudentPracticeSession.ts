"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import api, { httpStatus } from "@/lib/api";
import { getAccessToken, clearTokens, tokenCacheReady } from "@/lib/authSession";
import { toastApiError } from "@/lib/toastApiError";
import { homeFor } from "@/lib/roleRouting";
import posthog from "posthog-js";

// Bề mặt đăng nhập DUY NHẤT (xem middleware.ts + next.config redirect /login → /v2/login).
// Trỏ thẳng vào đây thay vì "/login" để khỏi tốn một chặng redirect, và để hook không còn phụ
// thuộc vào sự tồn tại của cây v1 khi cây đó bị xoá.
const LOGIN_ROUTE = "/v2/login";

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
  // Hook này dùng chung cho CẢ HAI cây UI (v1 legacy và /v2 Galerie), mà mỗi cây có một funnel
  // onboarding riêng. Phải giữ người dùng ở đúng cây họ đang đứng: nếu cứng nhắc đá về "/onboarding"
  // thì một trang /v2/student/* (grammar/practice, mock-exam/run) sẽ ném học viên chưa có lộ trình
  // ngược vào cây v1 — đúng thứ đợt xoá v1 đang gỡ bỏ.
  const pathname = usePathname();
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
    // On iOS cold launch, wait for native token cache to be ready before checking.
    // On web this resolves immediately (no-op).
    await tokenCacheReady;
    const accessToken = getAccessToken();
    if (!accessToken) {
      router.replace(LOGIN_ROUTE);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const meRes = await api.get<PracticeSessionUser>("/auth/me");
      const userData = meRes.data;

      if (requireStudent && userData.role !== "STUDENT") {
        // Trước đây: `/${role.toLowerCase()}` — vừa ném người dùng vào cây v1 (/teacher, /admin),
        // vừa dựng ra hai route KHÔNG TỒN TẠI cho vai trò OWNER/MANAGER (/owner, /manager → 404).
        // `homeFor()` là bản đồ vai trò→trang chủ duy nhất, biết OWNER/MANAGER và trả về path /v2 —
        // trùng đúng với `v2RoleHome()` mà middleware dùng để đá sai-vai-trò, nên hai lớp không đá
        // ngược nhau. Hai trang /v2/student/* (grammar/practice, mock-exam/run) dùng hook này.
        router.replace(homeFor(userData.role));
        return;
      }

      // Onboarding guard — redirect students who haven't completed onboarding
      if (requireStudent && !skipOnboardingCheck) {
        const statusRes = await api.get<{ hasPlan: boolean }>("/onboarding/status").catch(() => null);
        if (statusRes?.data?.hasPlan === false) {
          router.replace(pathname?.startsWith("/v2/") ? "/v2/onboarding" : "/onboarding");
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
      if (st === 401 || st === 403) {
        clearTokens();
        toastApiError(err, { locale });
        router.replace(LOGIN_ROUTE);
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
  }, [locale, requireStudent, skipOnboardingCheck, router, pathname]);

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
