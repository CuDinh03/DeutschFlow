"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import api from "@/lib/api";
import { clearTokens, getAccessToken, logout } from "@/lib/authSession";
import { StudentShell } from "@/components/layouts/StudentShell";
import { BadgePercent } from "lucide-react";

type MeUser = {
  displayName: string;
  role: string;
};

type MyPlanDto = {
  planCode: string;
  tier: string;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
};

function fmtPlanInstant(iso: string | null | undefined, locale: string): string | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(locale.replace("_", "-"), { dateStyle: "medium", timeStyle: "short" });
}

function tierLabelKey(tier: string): "myPlanTierBASIC" | "myPlanTierPREMIUM" | "myPlanTierULTRA" {
  switch ((tier ?? "").toUpperCase()) {
    case "PREMIUM":
      return "myPlanTierPREMIUM";
    case "ULTRA":
      return "myPlanTierULTRA";
    default:
      return "myPlanTierBASIC";
  }
}

export default function StudentMyPlanPage() {
  const t = useTranslations("student");
  const locale = useLocale();
  const router = useRouter();

  const [me, setMe] = useState<MeUser | null>(null);
  const [targetLevel, setTargetLevel] = useState("A1");
  const [streakDays, setStreakDays] = useState(0);
  const [plan, setPlan] = useState<MyPlanDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const meRes = await api.get<MeUser>("/auth/me");
      if (meRes.data.role !== "STUDENT") {
        router.replace(`/${String(meRes.data.role).toLowerCase()}`);
        return;
      }
      setMe(meRes.data);

      const [planRes, dashRes, learningPlanRes] = await Promise.all([
        api.get<MyPlanDto>("/auth/me/plan"),
        api.get<{ streakDays?: number }>("/student/dashboard").catch(() => null),
        api.get<{ plan?: { targetLevel?: string } }>("/plan/me").catch(() => null),
      ]);

      setPlan(planRes.data);
      setTargetLevel(learningPlanRes?.data?.plan?.targetLevel ?? "A1");
      setStreakDays(Number(dashRes?.data?.streakDays ?? 0));
    } catch {
      setErr(String(t("myPlanLoadError")));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const initials = useMemo(() => {
    if (!me) return "?";
    return me.displayName
      .split(" ")
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [me]);

  const tierTitle = plan ? t(tierLabelKey(plan.tier)) : "";

  const handleLogout = () => {
    clearTokens();
    router.push("/");
  };

  if (loading && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <p className="text-[#64748B]">{t("loading")}</p>
      </div>
    );
  }

  if (!me) return null;

  return (
    <StudentShell
      activeSection="myPlan"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t("myPlanTitle")}
      headerSubtitle={t("myPlanSubtitle")}
    >
      <div className="max-w-lg mx-auto space-y-6">
        {err && (
          <div className="rounded-[14px] border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm flex flex-wrap gap-3 items-center justify-between">
            <span>{err}</span>
            <button type="button" onClick={() => load()} className="font-semibold underline decoration-red-800/40 hover:text-red-900">
              {t("retry")}
            </button>
          </div>
        )}

        {!loading && plan && (
          <div className="rounded-[20px] border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] shadow-[0_4px_20px_rgba(0,48,94,0.08)] p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFCE00]/25 border border-[#FFCE00]/50 flex items-center justify-center">
              <BadgePercent className="w-7 h-7 text-[#00305E]" strokeWidth={2} />
            </div>
            <p className="text-xs uppercase tracking-wider font-bold text-[#64748B]">{t("myPlanBadgeLabel")}</p>
            <p className="text-3xl font-extrabold text-[#00305E] tracking-tight">{tierTitle}</p>
            <div className="text-xs text-[#475569] space-y-1 text-left mx-auto max-w-sm border-t border-[#E2E8F0] pt-3 mt-1">
              <p>
                <span className="font-semibold text-[#64748B]">{t("myPlanPeriodStart")}</span>{" "}
                {fmtPlanInstant(plan.startsAtUtc, locale) ?? "—"}
              </p>
              <p>
                <span className="font-semibold text-[#64748B]">{t("myPlanPeriodEnd")}</span>{" "}
                {fmtPlanInstant(plan.endsAtUtc, locale) ?? t("myPlanPeriodOpenEnded")}
              </p>
            </div>
            <p className="text-sm text-[#64748B] leading-relaxed">{t("myPlanFootnoteNoUsage")}</p>
          </div>
        )}

        {!loading && !plan && !err && <p className="text-[#64748B] text-sm">{t("loading")}</p>}
      </div>
    </StudentShell>
  );
}
