"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import api from "@/lib/api";
import { MyPlanDto } from "@/contexts/PlanContext";
import { useLocale } from "next-intl";

function fmtPlanInstant(iso: string | null | undefined, locale: string): string | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(locale.replace("_", "-"), { dateStyle: "medium", timeStyle: "short" });
}

function PaymentSuccessContent() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<MyPlanDto | null>(null);

  useEffect(() => {
    let attempts = 0;
    let timerId: NodeJS.Timeout;

    const checkPlan = async () => {
      try {
        const res = await api.get<MyPlanDto>("/auth/me/plan");
        const currentPlan = res.data;
        if (currentPlan && (currentPlan.tier === "PRO" || currentPlan.tier === "ULTRA" || currentPlan.tier === "PREMIUM")) {
          setPlan(currentPlan);
          setLoading(false);
          // Tự động chuyển về dashboard sau 10 giây khi đã có kết quả
          setTimeout(() => router.push("/student"), 10000);
          return;
        }
      } catch (e) {
        console.warn("Polling plan failed", e);
      }

      attempts++;
      if (attempts < 5) {
        timerId = setTimeout(checkPlan, 1500);
      } else {
        setLoading(false);
        // Tự động chuyển về dashboard sau 5 giây nếu polling thất bại
        setTimeout(() => router.push("/student"), 5000);
      }
    };

    checkPlan();

    return () => clearTimeout(timerId);
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex flex-col items-center justify-center text-white px-4">
        <svg className="animate-spin h-10 w-10 text-violet-500 mb-6" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-slate-300 text-lg animate-pulse">Đang xác nhận kết quả giao dịch với MoMo...</p>
        <p className="text-slate-500 text-sm mt-2">Vui lòng không đóng trình duyệt</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex flex-col items-center justify-center text-white px-4">
      <div className="text-center max-w-md bg-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="text-7xl mb-6 animate-bounce">🎉</div>

        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-violet-300 via-white to-purple-300 bg-clip-text text-transparent mb-4">
          Thanh toán thành công!
        </h1>

        {plan ? (
          <div className="bg-white/10 rounded-2xl p-6 mb-6 text-left border border-white/5">
            <p className="text-sm text-slate-400 mb-1">Gói cước của bạn</p>
            <p className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
              {plan.tier === "ULTRA" ? "⚡" : "🚀"} {plan.tier}
            </p>
            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Mở khóa:</span> Toàn bộ Personas, Mock Exam & Tính năng AI</p>
              <p><span className="text-slate-500">Thời hạn:</span> Đến {fmtPlanInstant(plan.endsAtUtc, locale) ?? "Vô thời hạn"}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-300 text-lg mb-6">
            Giao dịch đã hoàn tất. Nếu gói cước chưa cập nhật, vui lòng thử tải lại trang sau ít phút.
          </p>
        )}

        {orderId && (
          <p className="text-xs text-slate-500 mb-8">
            Mã đơn hàng: <span className="font-mono text-slate-400">{orderId}</span>
          </p>
        )}

        <button
          id="btn-go-dashboard"
          onClick={() => router.push("/student")}
          className="w-full inline-flex justify-center items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:opacity-90 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-violet-500/30 transition-all active:scale-95"
        >
          🏠 Bắt đầu học ngay
        </button>

        <p className="text-slate-600 text-xs mt-6">
          Tự động chuyển về Dashboard sau 10 giây...
        </p>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Đang tải...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
