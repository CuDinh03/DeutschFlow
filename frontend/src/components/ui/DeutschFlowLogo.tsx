"use client";

/**
 * DeutschFlowLogo — Bauhaus-inspired logo component
 *
 * Variants:
 *   horizontal  — icon + "myDeutschFlow" side by side (default, sidebar & login)
 *   vertical    — icon stacked above text (splash / onboarding)
 *   icon-only   — compact D-shape icon (loading spinner replacement)
 *
 * Usage:
 *   <DeutschFlowLogo />                        // horizontal, size=200
 *   <DeutschFlowLogo variant="icon-only" />    // loading state
 *   <DeutschFlowLogo variant="icon-only" spin /> // spinning loader
 */

import { motion } from "framer-motion";

type LogoVariant = "horizontal" | "vertical" | "icon-only";

interface DeutschFlowLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  /** Play draw-in animation (only on first render) */
  animated?: boolean;
  /** Spin the icon — used for loading states */
  spin?: boolean;
}

// ─── Icon (the D-shape mark) ────────────────────────────────────────────────

function DFIcon({
  size,
  animated,
  spin,
}: {
  size: number;
  animated: boolean;
  spin?: boolean;
}) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      animate={spin ? { rotate: 360 } : {}}
      transition={
        spin
          ? { duration: 1.2, repeat: Infinity, ease: "linear" }
          : {}
      }
    >
      {/* D-shape outline */}
      <motion.path
        d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="miter"
        initial={animated ? { pathLength: 0 } : { pathLength: 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      {/* Red triangle — flow arrow */}
      <motion.polygon
        points="52,38 74,50 52,62"
        fill="#DA291C"
        initial={animated ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
      />
      {/* Yellow square — Bauhaus element */}
      <motion.rect
        x="24"
        y="45"
        width="9"
        height="9"
        fill="#FFCD00"
        initial={animated ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
      />
    </motion.svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DeutschFlowLogo({
  variant = "horizontal",
  size = 200,
  className = "",
  animated = true,
  spin = false,
}: DeutschFlowLogoProps) {
  // ── Icon-only ──────────────────────────────────────────────────────────────
  if (variant === "icon-only") {
    return (
      <span className={className}>
        <DFIcon size={size * 0.4} animated={animated} spin={spin} />
      </span>
    );
  }

  // ── Vertical ───────────────────────────────────────────────────────────────
  if (variant === "vertical") {
    const iconSize = size * 0.55;
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <DFIcon size={iconSize} animated={animated} />
        <motion.div
          className="flex flex-col items-center"
          initial={animated ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 300,
              fontSize: size * 0.085,
              color: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            my
          </span>
          <div className="flex items-baseline gap-0">
            <span
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                fontSize: size * 0.13,
                color: "inherit",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Deutsch
            </span>
            <span
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 700,
                fontSize: size * 0.13,
                color: "var(--brand-red, #DA291C)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Flow
            </span>
          </div>
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 400,
              fontSize: size * 0.042,
              color: "inherit",
              opacity: 0.65,
              letterSpacing: "0.18em",
              marginTop: 4,
              textTransform: "uppercase",
            }}
          >
            German Language Learning
          </span>
        </motion.div>
      </div>
    );
  }

  // ── Horizontal (default) ──────────────────────────────────────────────────
  const iconSize = size * 0.38;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <DFIcon size={iconSize} animated={animated} />
      <motion.div
        className="flex flex-col"
        initial={animated ? { opacity: 0, x: -12 } : { opacity: 1, x: 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
      >
        <div className="flex items-baseline leading-none">
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 300,
              fontSize: size * 0.1,
              color: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            my
          </span>
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 700,
              fontSize: size * 0.13,
              color: "inherit",
              letterSpacing: "-0.02em",
            }}
          >
            Deutsch
          </span>
          <span
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 700,
              fontSize: size * 0.13,
              color: "var(--brand-red, #DA291C)",
              letterSpacing: "-0.02em",
            }}
          >
            Flow
          </span>
        </div>
        <span
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 400,
            fontSize: size * 0.042,
            color: "inherit",
            opacity: 0.65,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          German Language Learning
        </span>
      </motion.div>
    </div>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
/**
 * Full-page animated splash shown briefly when the app first loads.
 * Auto-dismisses via onComplete callback after ~2.5 s.
 */
export function DeutschFlowSplash({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: 2.4 }}
      onAnimationComplete={onComplete}
    >
      <DeutschFlowLogo variant="vertical" size={280} animated />
    </motion.div>
  );
}

// ─── Page Loader (replaces spinning circle) ────────────────────────────────
export function DeutschFlowLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <DeutschFlowLogo variant="icon-only" size={100} animated={false} spin />
      {label && <p className="text-sm text-[#64748B]">{label}</p>}
    </div>
  );
}
