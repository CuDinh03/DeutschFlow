"use client";
import { useState } from "react";
import { createMomoOrder } from "@/lib/paymentApi";

const plans = [
  {
    code: "FREE" as const,
    name: "Miễn Phí",
    priceVnd: 0,
    period: "",
    color: "from-slate-700 to-slate-800",
    badge: null,
    features: [
      "✅ 2 Persona (Emma & Anna)",
      "✅ Tối đa 20 thẻ ôn tập/ngày",
      "✅ Xem từ vựng A1-B1",
      "✅ Mini Quiz AI (2 tab)",
      "❌ Hội thoại AI phỏng vấn",
      "❌ Giọng AI chuyên nghiệp",
      "❌ Phân tích tiến độ nâng cao",
    ],
  },
  {
    code: "PRO" as const,
    name: "Pro",
    priceVnd: 299000,
    period: "/tháng",
    color: "from-violet-600 to-purple-700",
    badge: "Phổ biến nhất",
    features: [
      "✅ Tất cả 4 Persona (Lukas, Emma, Anna, Klaus)",
      "✅ Ôn tập không giới hạn",
      "✅ Hội thoại AI phỏng vấn",
      "✅ Giọng AI chuyên nghiệp",
      "✅ 6 tab AI Vocabulary Insights",
      "✅ Phân tích từ vựng (CEFR Chart)",
      "✅ Quick AI Toolbar",
    ],
  },
  {
    code: "ULTRA" as const,
    name: "Ultra",
    priceVnd: 699000,
    period: "/tháng",
    color: "from-amber-500 to-orange-600",
    badge: "Mạnh nhất",
    features: [
      "✅ Tất cả tính năng Pro",
      "✅ Mock Exam CEFR (A1–C1)",
      "✅ Persona tùy chỉnh",
      "✅ Đánh giá độ nghiêm ngặt nâng cao",
      "✅ Crash Course mode",
      "✅ Bộ thẻ từ vựng tùy chỉnh",
      "✅ Huy hiệu ULTRA GOLD trên Leaderboard",
    ],
  },
];

function formatVnd(amount: number) {
  if (amount === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (planCode: "PRO" | "ULTRA") => {
    setLoading(planCode);
    setError(null);
    try {
      const res = await createMomoOrder({ planCode, durationMonths: 1 });
      // Redirect sang trang thanh toán MoMo
      window.location.href = res.payUrl;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi. Vui lòng thử lại.");
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white px-4 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <span className="inline-block bg-violet-500/20 text-violet-300 text-xs font-semibold px-4 py-1 rounded-full mb-4 tracking-widest uppercase">
          Nâng cấp tài khoản
        </span>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-violet-200 to-purple-400 bg-clip-text text-transparent mb-4">
          Chọn gói học phù hợp
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Mở khoá toàn bộ sức mạnh AI của DeutschFlow để học tiếng Đức hiệu quả hơn gấp 10 lần.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-md mx-auto mb-8 bg-red-500/20 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Pricing cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.code}
            className={`relative rounded-2xl border ${
              plan.code === "PRO"
                ? "border-violet-500/60 shadow-lg shadow-violet-500/20"
                : "border-white/10"
            } bg-white/5 backdrop-blur-sm p-8 flex flex-col`}
          >
            {/* Badge */}
            {plan.badge && (
              <span
                className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.color} text-white text-xs font-bold px-4 py-1 rounded-full shadow-md`}
              >
                {plan.badge}
              </span>
            )}

            {/* Plan header */}
            <div className="mb-6">
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} mb-4 text-2xl`}
              >
                {plan.code === "FREE" ? "🎓" : plan.code === "PRO" ? "🚀" : "⚡"}
              </div>
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-3xl font-extrabold">
                  {plan.priceVnd === 0 ? "0đ" : formatVnd(plan.priceVnd)}
                </span>
                {plan.period && (
                  <span className="text-slate-400 text-sm mb-1">{plan.period}</span>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-8 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            {plan.code === "FREE" ? (
              <button
                disabled
                className="w-full py-3 rounded-xl bg-white/10 text-slate-400 font-semibold cursor-default text-sm"
              >
                Gói hiện tại
              </button>
            ) : (
              <button
                id={`btn-upgrade-${plan.code.toLowerCase()}`}
                onClick={() => handleUpgrade(plan.code)}
                disabled={loading === plan.code}
                className={`w-full py-3 rounded-xl bg-gradient-to-r ${plan.color} text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {loading === plan.code ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Đang kết nối MoMo...
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
                    Thanh toán qua MoMo
                  </>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="text-center mt-12 text-slate-500 text-sm space-y-2">
        <p>📞 Hỗ trợ hoàn tiền trong vòng 7 ngày nếu chưa hài lòng</p>
      </div>
    </main>
  );
}
