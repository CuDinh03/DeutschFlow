"use client";
/**
 * /payment/success — URL RETURN của cổng thanh toán (MoMo/Stripe giữ path này trong cấu hình
 * merchant), nên trang phải ở NGUYÊN gốc: nó là một trong số ít trang cố ý KHÔNG bị redirect sang
 * /v2 khi Đợt 3 xoá cây v1 (lý do đầy đủ trong `frontend/legacy-redirects.mjs`).
 *
 * Bản thân trang thì đưa người dùng vào bề mặt v2: `/student` cũ nay chỉ còn là redirect 308, đi
 * qua nó chỉ tốn thêm một vòng round-trip ngay sau khi trả tiền.
 *
 * Icon đợt B (09/11/2026): giao diện Galerie (`.ga-scope`, token `ga-*`, `GaGlyph`, `GaBtn`). Cố ý KHÔNG gắn
 * header/footer công khai: đây là trang chờ xác nhận rồi tự chuyển về Dashboard. Logic thanh toán giữ nguyên.
 */
import "@/styles/galerie.css";
import { useEffect, useState } from "react";
import { Clock, PartyPopper, Zap, Rocket, Home, Loader2 } from "lucide-react";
import { GaBtn } from "@/components/ui-v2/GaBtn";
import { GaGlyph } from "@/components/ui-v2/GaGlyph";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import api from "@/lib/api";
import { syncMomoOrder } from "@/lib/paymentApi";
import { MyPlanDto } from "@/contexts/PlanContext";
import { useLocale } from "next-intl";
import { useTracking } from "@/hooks/useTracking";
import type { ReadonlyURLSearchParams } from "next/navigation";

function extractMoMoOrderId(sp: ReadonlyURLSearchParams): string {
  for (const key of ["orderId", "orderID", "OrderID", "order_id"]) {
    const v = sp.get(key);
    if (v?.trim()) return v.trim();
  }
  return "";
}

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
  const orderId = extractMoMoOrderId(searchParams);
  const { trackFeatureAction } = useTracking();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<MyPlanDto | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const maxWaves = orderId ? 12 : 6;

    (async () => {
      for (let wave = 0; wave < maxWaves && !cancelled; wave++) {
        if (orderId && (wave === 0 || wave % 2 === 1)) {
          try {
            const sync = await syncMomoOrder(orderId);
            if (sync.status !== "SUCCESS" && sync.message) {
              setSyncNote((prev) => prev ?? sync.message);
            }
          } catch (e) {
            console.warn("syncMomoOrder failed", e);
          }
        }

        try {
          const res = await api.get<MyPlanDto>("/auth/me/plan");
          const currentPlan = res.data;
          if (
            currentPlan &&
            (currentPlan.tier === "PRO" || currentPlan.tier === "ULTRA" || currentPlan.tier === "PREMIUM")
          ) {
            setPlan(currentPlan);
            setLoading(false);
            trackFeatureAction("monetization", "checkout_completed", {
              plan: currentPlan.planCode,
              tier: currentPlan.tier,
              orderId,
            });
            setTimeout(() => {
              if (!cancelled) router.push("/v2/student/dashboard");
            }, 10000);
            return;
          }
        } catch (e) {
          console.warn("Polling plan failed", e);
        }

        await new Promise((r) => setTimeout(r, 1600));
      }

      if (!cancelled) {
        setLoading(false);
        setTimeout(() => {
          if (!cancelled) router.push("/v2/student/dashboard");
        }, 5000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, orderId]);

  if (loading) {
    return (
      <main role="status" className={`${PAGE} flex flex-col items-center justify-center px-4 text-center`}>
        <Loader2 size={40} className="ga-spin mb-6 text-ga-ink" aria-hidden />
        <p className="text-ga-body-lg text-ga-ink">Đang xác nhận kết quả giao dịch với MoMo...</p>
        <p className="mt-2 text-ga-small text-ga-muted">Vui lòng không đóng trình duyệt</p>
      </main>
    );
  }

  return (
    <main className={`${PAGE} flex flex-col items-center justify-center px-4 py-10`}>
      <div className="w-full max-w-md border border-ga-border bg-ga-card p-6 text-center sm:p-8">
        {/* Đã có gói: ô vàng (điểm nhấn duy nhất của màn). Chưa thấy gói: ô trung tính, không ăn mừng sớm. */}
        <GaGlyph
          icon={plan ? PartyPopper : Clock}
          tone={plan ? "yellow" : "plain"}
          size="lg"
          className="mx-auto mb-6"
        />

        <h1 className="mb-4 font-ga-display text-ga-h1-m font-medium text-ga-ink sm:text-ga-h1">
          {plan ? "Thanh toán thành công!" : "Đang hoàn tất kích hoạt gói"}
        </h1>

        {plan ? (
          <div className="mb-6 border border-ga-border bg-ga-surface p-5 text-left">
            <p className="mb-1 text-ga-eyebrow uppercase text-ga-muted">Gói cước của bạn</p>
            <p className="mb-4 flex items-center gap-2 font-ga-display text-ga-h2 font-medium text-ga-ink">
              {plan.tier === "ULTRA" ? <Zap size={20} aria-hidden /> : <Rocket size={20} aria-hidden />} {plan.tier}
            </p>
            <div className="space-y-2 text-ga-small text-ga-ink">
              <p><span className="text-ga-muted">Mở khóa:</span> Toàn bộ Personas, Mock Exam & Tính năng AI</p>
              <p><span className="text-ga-muted">Thời hạn:</span> Đến {fmtPlanInstant(plan.endsAtUtc, locale) ?? "Vô thời hạn"}</p>
            </div>
          </div>
        ) : (
          <div className="mb-6 space-y-3 text-ga-body text-ga-ink">
            <p>
              MoMo đã xử lý thanh toán. Hệ thống đang đồng bộ gói cước; nếu sau vài phút vẫn chưa thấy gói mới, hãy
              tải lại trang hoặc liên hệ hỗ trợ kèm mã đơn bên dưới.
            </p>
            {syncNote && <p className="bg-ga-warning-soft px-3 py-2 text-ga-small text-ga-ink">{syncNote}</p>}
          </div>
        )}

        {orderId && (
          <p className="mb-8 text-ga-caption text-ga-muted">
            Mã đơn hàng: <span className="break-all font-mono text-ga-ink">{orderId}</span>
          </p>
        )}

        <GaBtn
          id="btn-go-dashboard"
          type="button"
          variant="ink"
          size="lg"
          className="w-full"
          onClick={() => router.push("/v2/student/dashboard")}
        >
          <Home size={17} aria-hidden /> Bắt đầu học ngay
        </GaBtn>

        <p className="mt-6 text-ga-caption text-ga-muted">
          Tự động chuyển về Dashboard sau 10 giây...
        </p>
      </div>
    </main>
  );
}

/** Khung trang chung (đang xác nhận, đã xong, Suspense). */
const PAGE = "ga-scope min-h-screen bg-ga-bg font-ga-ui text-ga-ink";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className={`${PAGE} flex items-center justify-center`}>Đang tải...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
