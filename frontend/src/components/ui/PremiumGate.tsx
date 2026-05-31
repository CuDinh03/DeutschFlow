"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { usePlanHelpers } from "@/contexts/PlanContext";
import { useTracking } from "@/hooks/useTracking";

interface PremiumGateProps {
  /** Minimum plan required to access the content */
  requires: "PRO" | "ULTRA";
  /** Content to render when the user has access (optional for banner variant) */
  children?: ReactNode;
  /** Optional custom title for the lock overlay */
  title?: string;
  /** Optional custom description for the lock overlay */
  description?: string;
  /** Render as an inline banner instead of a full overlay */
  variant?: "overlay" | "banner";
  className?: string;
}

const PLAN_LABEL: Record<"PRO" | "ULTRA", string> = {
  PRO: "PRO",
  ULTRA: "ULTRA",
};

export function PremiumGate({
  requires,
  children,
  title,
  description,
  variant = "overlay",
  className,
}: PremiumGateProps) {
  const router = useRouter();
  const { isPro, isUltra, loading } = usePlanHelpers();
  const { trackFeatureAction } = useTracking();

  const hasAccess = requires === "ULTRA" ? isUltra : isPro;

  useEffect(() => {
    if (!loading && !hasAccess) {
      trackFeatureAction("monetization", "paywall_gate_viewed", { requires, variant });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasAccess]);

  if (loading) return null;
  if (hasAccess) return children ? <>{children}</> : null;

  const label = PLAN_LABEL[requires];
  const defaultTitle = `Tính năng ${label}`;
  const defaultDesc =
    requires === "ULTRA"
      ? "Nâng cấp ULTRA để mở khóa toàn bộ tính năng cao cấp."
      : "Nâng cấp PRO để truy cập tính năng này và đẩy nhanh quá trình học.";

  if (variant === "banner") {
    return (
      <div
        className={`rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3 ${className ?? ""}`}
        role="alert"
      >
        <Lock className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-100">{title ?? defaultTitle}</p>
          <p className="text-xs text-amber-200/80 leading-relaxed mt-0.5">{description ?? defaultDesc}</p>
          <button
            onClick={() => router.push("/student/pricing")}
            className="mt-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline underline-offset-2"
          >
            Nâng cấp {label} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#0A0A0A]/80 backdrop-blur-[1px] p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 mb-3">
          <Sparkles className="text-amber-400" size={22} />
        </div>
        <p className="text-sm font-bold text-white mb-1">{title ?? defaultTitle}</p>
        <p className="text-xs text-white/60 max-w-[240px] leading-relaxed mb-4">
          {description ?? defaultDesc}
        </p>
        <button
          onClick={() => router.push("/student/pricing")}
          className="rounded-full bg-amber-400 hover:bg-amber-300 text-[#121212] text-xs font-bold px-5 py-2 transition-colors"
        >
          Nâng cấp {label}
        </button>
      </div>
    </div>
  );
}
