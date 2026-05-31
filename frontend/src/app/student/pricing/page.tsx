"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createMomoOrder, createStripeSession } from "@/lib/paymentApi";
import { useTracking } from "@/hooks/useTracking";

type PlanCode = "FREE" | "PRO" | "ULTRA";
type LoadingKey = `momo-${"PRO" | "ULTRA"}` | `stripe-${"PRO" | "ULTRA"}`;

const PLAN_PRICES: Record<PlanCode, number> = {
  FREE: 0,
  PRO: 299000,
  ULTRA: 699000,
};

const PLAN_COLORS: Record<PlanCode, string> = {
  FREE: "from-slate-700 to-slate-800",
  PRO: "from-violet-600 to-purple-700",
  ULTRA: "from-amber-500 to-orange-600",
};

const PLAN_ICONS: Record<PlanCode, string> = {
  FREE: "🎓",
  PRO: "🚀",
  ULTRA: "⚡",
};

const PLAN_CODES: PlanCode[] = ["FREE", "PRO", "ULTRA"];

function formatVnd(amount: number, freeLabel: string) {
  if (amount === 0) return freeLabel;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

function PricingContent() {
  const t = useTranslations("pricing");
  const [loading, setLoading] = useState<LoadingKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<"success" | "cancel" | null>(null);
  const { trackFeatureAction } = useTracking();
  const checkoutStartedRef = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const stripe = searchParams.get("stripe");
    if (stripe === "success" || stripe === "cancel") {
      setStripeStatus(stripe);
    }
  }, [searchParams]);

  useEffect(() => {
    trackFeatureAction("monetization", "paywall_viewed");
    return () => {
      if (!checkoutStartedRef.current) {
        trackFeatureAction("monetization", "checkout_abandoned");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMomoCheckout = async (planCode: "PRO" | "ULTRA") => {
    const key: LoadingKey = `momo-${planCode}`;
    checkoutStartedRef.current = true;
    trackFeatureAction("monetization", "checkout_started", { plan: planCode, method: "momo" });
    setLoading(key);
    setError(null);
    try {
      const durationMonths = planCode === "ULTRA" ? 2 : 1;
      const res = await createMomoOrder({ planCode, durationMonths });
      window.location.href = res.payUrl;
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t("errors.generic" as never) ?? "Error"
      );
      setLoading(null);
    }
  };

  const handleStripeCheckout = async (planCode: "PRO" | "ULTRA") => {
    const key: LoadingKey = `stripe-${planCode}`;
    checkoutStartedRef.current = true;
    trackFeatureAction("monetization", "checkout_started", { plan: planCode, method: "stripe" });
    setLoading(key);
    setError(null);
    try {
      const res = await createStripeSession({ planCode });
      window.location.href = res.url;
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t("errors.generic" as never) ?? "Error"
      );
      setLoading(null);
    }
  };

  const period: Record<PlanCode, string> = {
    FREE: "",
    PRO: t("perMonth"),
    ULTRA: t("per2Months"),
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

      {/* Stripe return banners */}
      {stripeStatus === "success" && (
        <div className="max-w-md mx-auto mb-8 bg-green-500/20 border border-green-500/40 rounded-xl p-4 text-green-300 text-sm text-center">
          ✅ {t("stripeSuccess")}
        </div>
      )}
      {stripeStatus === "cancel" && (
        <div className="max-w-md mx-auto mb-8 bg-amber-500/20 border border-amber-500/40 rounded-xl p-4 text-amber-300 text-sm text-center">
          ℹ️ {t("stripeCancel")}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="max-w-md mx-auto mb-8 bg-red-500/20 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Pricing cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
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

              {/* CTA Buttons */}
              {code === "FREE" ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/10 text-slate-400 font-semibold cursor-default text-sm"
                >
                  {t("currentPlan")}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* MoMo button */}
                  <button
                    id={`btn-upgrade-momo-${code.toLowerCase()}`}
                    onClick={() => handleMomoCheckout(code)}
                    disabled={loading !== null}
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${color} text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                  >
                    {loading === `momo-${code}` ? (
                      <>
                        <Spinner />
                        {t("connectingMomo")}
                      </>
                    ) : (
                      <>
                        <img
                          src="/icons/momo.svg"
                          alt="MoMo"
                          className="w-5 h-5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        {t("payMomo")}
                      </>
                    )}
                  </button>

                  {/* Stripe button */}
                  <button
                    id={`btn-upgrade-stripe-${code.toLowerCase()}`}
                    onClick={() => handleStripeCheckout(code)}
                    disabled={loading !== null}
                    className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/15 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading === `stripe-${code}` ? (
                      <>
                        <Spinner />
                        {t("connectingStripe")}
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v2H2V7zm0 4h20v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6zm3 3a1 1 0 000 2h3a1 1 0 000-2H5z" />
                        </svg>
                        {t("payStripe")}
                      </>
                    )}
                  </button>
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
