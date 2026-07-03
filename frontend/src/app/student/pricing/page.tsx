"use client";

import { useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useTracking } from "@/hooks/useTracking";

// v1.0: PRO only (ULTRA deferred). Web self-serve payment (SePay "gói N ngày") ships in v1.1;
// until then the PRO card shows a "coming soon" CTA instead of the removed MoMo/Stripe buttons.
type PlanCode = "FREE" | "PRO";

const PLAN_PRICES: Record<PlanCode, number> = {
  FREE: 0,
  PRO: 299000,
};

const PLAN_COLORS: Record<PlanCode, string> = {
  FREE: "from-slate-700 to-slate-800",
  PRO: "from-violet-600 to-purple-700",
};

const PLAN_ICONS: Record<PlanCode, string> = {
  FREE: "🎓",
  PRO: "🚀",
};

const PLAN_CODES: PlanCode[] = ["FREE", "PRO"];

function formatVnd(amount: number, freeLabel: string) {
  if (amount === 0) return freeLabel;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function PricingContent() {
  const t = useTranslations("pricing");
  const { trackFeatureAction } = useTracking();

  useEffect(() => {
    trackFeatureAction("monetization", "paywall_viewed");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const period: Record<PlanCode, string> = {
    FREE: "",
    PRO: t("perMonth"),
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white px-4 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <span className="inline-block bg-violet-500/20 text-violet-300 text-xs font-semibold px-4 py-1 rounded-full mb-4 tracking-widest uppercase">
          {t("badge")}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-violet-200 to-purple-400 bg-clip-text text-transparent mb-4">
          {t("title")}
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">{t("subtitle")}</p>
      </div>

      {/* Pricing cards */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLAN_CODES.map((code) => {
          const badge = t.raw(`plans.${code}.badge` as never) as string | null;
          const name = t(`plans.${code}.name` as never);
          const features = t.raw(`plans.${code}.features` as never) as string[];
          const price = PLAN_PRICES[code];
          const color = PLAN_COLORS[code];

          return (
            <div
              key={code}
              className={`relative rounded-2xl border ${
                code === "PRO"
                  ? "border-violet-500/60 shadow-lg shadow-violet-500/20"
                  : "border-white/10"
              } bg-white/5 backdrop-blur-sm p-8 flex flex-col`}
            >
              {/* Badge */}
              {badge && (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r ${color} text-white text-xs font-bold px-4 py-1 rounded-full shadow-md`}
                >
                  {badge}
                </span>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${color} mb-4 text-2xl`}
                >
                  {PLAN_ICONS[code]}
                </div>
                <h2 className="text-xl font-bold">{name}</h2>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-extrabold">
                    {formatVnd(price, t("free"))}
                  </span>
                  {period[code] && (
                    <span className="text-slate-400 text-sm mb-1">
                      {period[code]}
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-8 flex-1">
                {features.map((f, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-300 flex items-start gap-2"
                  >
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {code === "FREE" ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/10 text-slate-400 font-semibold cursor-default text-sm"
                >
                  {t("currentPlan")}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    disabled
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${color} text-white font-bold text-sm shadow-md opacity-70 cursor-default`}
                  >
                    {t("comingSoon")}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    {t("comingSoonNote")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust badge */}
      <div className="text-center mt-12 text-slate-500 text-sm space-y-2">
        <p>{t("refund")}</p>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingContent />
    </Suspense>
  );
}
