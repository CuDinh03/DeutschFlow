"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";

  useEffect(() => {
    // Tự động chuyển về dashboard sau 5 giây
    const timer = setTimeout(() => {
      router.push("/student");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center text-white px-4">
      <div className="text-center max-w-md">
        {/* Confetti-style emoji burst */}
        <div className="text-7xl mb-6 animate-bounce">🎉</div>

        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-violet-300 via-white to-purple-300 bg-clip-text text-transparent mb-4">
          Thanh toán thành công!
        </h1>

        <p className="text-slate-300 text-lg mb-2">
          Chúc mừng! Gói của bạn đã được kích hoạt.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Hãy bắt đầu hành trình chinh phục tiếng Đức ngay hôm nay 🇩🇪
        </p>

        {orderId && (
          <p className="text-xs text-slate-600 mb-6">
            Mã đơn hàng: <span className="font-mono text-slate-500">{orderId}</span>
          </p>
        )}

        {/* Nút quay lại Dashboard */}
        <button
          id="btn-go-dashboard"
          onClick={() => router.push("/student")}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-violet-500/30 transition-all active:scale-95"
        >
          🏠 Về Dashboard
        </button>

        <p className="text-slate-600 text-xs mt-4">
          Tự động chuyển về Dashboard sau 5 giây...
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
