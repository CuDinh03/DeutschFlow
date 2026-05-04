"use client";

/**
 * Floating glow orbs behind the speaking “phone” panel — pixel-aligned with
 * `uidemo/deutschflow_UI_DEMO/src/app/pages/Speaking.tsx`.
 */
export function SpeakingAmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <div
        className="absolute rounded-full"
        style={{
          top: "10%",
          left: "5%",
          width: 320,
          height: 320,
          background: "radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: "50%",
          right: "5%",
          width: 380,
          height: 380,
          background: "radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          bottom: "10%",
          left: "30%",
          width: 260,
          height: 260,
          background: "radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%)",
          filter: "blur(35px)",
        }}
      />
    </div>
  );
}
