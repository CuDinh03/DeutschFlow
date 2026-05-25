'use client'

import { useState, useEffect } from "react";

export type LukasExpression = "neutral" | "talking" | "smiling" | "thinking" | "serious";

interface Props {
  expression?: LukasExpression;
  isTalking?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// ── Eyebrows ──────────────────────────────────────────────────────
function Eyebrows({ expression }: { expression: LukasExpression }) {
  const c = "#1A1A2E";
  const sw = 5.5;
  switch (expression) {
    case "smiling":
      return (
        <g>
          <path d="M 100 151 C 109 144 122 143 136 149" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 152 149 C 166 143 179 144 188 151" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <path d="M 100 157 C 109 152 122 151 136 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 152 150 C 166 154 179 158 188 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "serious":
      return (
        <g>
          <path d="M 98 158 C 110 153 122 152 136 158" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" transform="rotate(8 118 155)" />
          <path d="M 152 158 C 166 152 178 153 190 158" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" transform="rotate(-8 171 155)" />
        </g>
      );
    case "talking":
      return (
        <g>
          <path d="M 100 149 C 109 143 122 142 136 148" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 152 148 C 166 142 179 143 188 149" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    default: // neutral
      return (
        <g>
          <path d="M 100 155 C 109 149 122 148 136 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 152 154 C 166 148 179 149 188 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
  }
}

// ── Eyes ──────────────────────────────────────────────────────────
function Eyes({ blinking, expression }: { blinking: boolean; expression: LukasExpression }) {
  const squint = expression === "smiling";
  if (blinking) {
    return (
      <g>
        <rect x="106" y="173" width="36" height="5" rx="2.5" fill="#F5C89A" />
        <rect x="146" y="173" width="36" height="5" rx="2.5" fill="#F5C89A" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="124" cy="176" rx={squint ? 13 : 15} ry={squint ? 8 : 11} fill="white" />
      <ellipse cx="126" cy="177" rx="7" ry={squint ? 5.5 : 7} fill="#1E2030" />
      <ellipse cx="128" cy="175" rx="2.5" ry="2.5" fill="white" />
      <ellipse cx="164" cy="176" rx={squint ? 13 : 15} ry={squint ? 8 : 11} fill="white" />
      <ellipse cx="166" cy="177" rx="7" ry={squint ? 5.5 : 7} fill="#1E2030" />
      <ellipse cx="168" cy="175" rx="2.5" ry="2.5" fill="white" />
    </g>
  );
}

// ── Mouth frames (lip-sync) ───────────────────────────────────────
function MouthFrame({ frame, expression }: { frame: number; expression: LukasExpression }) {
  if (expression === "thinking") {
    return <path d="M 132 217 L 156 217" fill="none" stroke="#A06030" strokeWidth="2.5" strokeLinecap="round" />;
  }
  if (expression === "serious") {
    return <path d="M 128 221 C 134 219 144 218 158 221" fill="none" stroke="#A06030" strokeWidth="2" strokeLinecap="round" />;
  }
  if (expression === "smiling" && frame === 2) {
    return <path d="M 120 212 C 128 222 140 226 156 222 C 164 218 167 212 167 212" fill="none" stroke="#A06030" strokeWidth="2.5" strokeLinecap="round" />;
  }
  switch (frame) {
    case 0: // wide open
      return (
        <g>
          <ellipse cx="144" cy="218" rx="18" ry="13" fill="#1A0800" />
          <ellipse cx="144" cy="213" rx="18" ry="5" fill="#F5C89A" />
        </g>
      );
    case 1: // mid
      return (
        <g>
          <ellipse cx="144" cy="218" rx="13" ry="7" fill="#1A0800" />
          <ellipse cx="144" cy="215" rx="13" ry="3.5" fill="#F5C89A" />
        </g>
      );
    default: // closed neutral
      return <path d="M 128 215 C 134 219 144 221 158 218 C 166 216 168 212 168 212" fill="none" stroke="#A06030" strokeWidth="2.5" strokeLinecap="round" />;
  }
}

// ── Main Component ────────────────────────────────────────────────
export function LukasCharacter({ expression = "neutral", isTalking = false, style, className }: Props) {
  const [mouthFrame, setMouthFrame] = useState(2);
  const [blinking, setBlinking]   = useState(false);

  // Lip-sync
  useEffect(() => {
    if (!isTalking) { setMouthFrame(2); return; }
    const id = setInterval(() => setMouthFrame(f => (f + 1) % 3), 115);
    return () => clearInterval(id);
  }, [isTalking]);

  // Idle blink
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
      tid = setTimeout(blink, 3000 + Math.random() * 2000);
    };
    tid = setTimeout(blink, 2000 + Math.random() * 1500);
    return () => clearTimeout(tid);
  }, []);

  const SKIN  = "#F5C89A";
  const SKIN_D = "#D49060";
  const HAIR  = "#1A1A2E";
  const SHIRT = "#2C3E50";
  const W     = "#FFFFFF";

  return (
    <svg
      viewBox="0 0 280 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
    >
      {/* ── SHIRT BODY ── */}
      <path
        d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 174,261 C 167,273 158,279 144,279 C 130,279 121,273 114,261 Z"
        fill={SHIRT}
      />
      {/* Left arm (hanging) */}
      <path
        d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z"
        fill={SHIRT}
      />
      {/* Right arm (hanging) */}
      <path
        d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z"
        fill={SHIRT}
      />
      {/* Sleeve cuff hints */}
      <path d="M 28 422 C 36 442 66 446 80 437" fill="none" stroke="#1E2E3E" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
      <path d="M 260 422 C 252 442 222 446 208 437" fill="none" stroke="#1E2E3E" strokeWidth="2" opacity="0.4" strokeLinecap="round" />

      {/* ── BINARY PATTERN on chest ── */}
      <text x="100" y="344" fontSize="8" fill="#3D5A75" fontFamily="monospace" letterSpacing="4" opacity="0.75">01 10</text>
      <text x="100" y="358" fontSize="8" fill="#3D5A75" fontFamily="monospace" letterSpacing="4" opacity="0.75">11 00</text>
      <text x="100" y="372" fontSize="8" fill="#3D5A75" fontFamily="monospace" letterSpacing="4" opacity="0.75">10 01</text>

      {/* ── Java / Coffee badge ── */}
      <circle cx="202" cy="348" r="17" fill="#E8760010" />
      <text x="195" y="353" fontSize="13" opacity="0.65">☕</text>

      {/* Pocket */}
      <path d="M 108,396 C 108,390 112,386 118,386 L 170,386 C 176,386 180,390 180,396 L 180,432 L 108,432 Z" fill="#1E2E3E" opacity="0.5" />
      <line x1="144" y1="386" x2="144" y2="432" stroke="#162430" strokeWidth="1.5" opacity="0.4" />

      {/* Hands */}
      <ellipse cx="53"  cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="235" cy="440" rx="18" ry="12" fill={SKIN} />

      {/* ── NECK ── */}
      <rect x="132" y="252" width="24" height="28" rx="7" fill={SKIN} />

      {/* Collar detail */}
      <path d="M 110 264 C 116 259 127 255 144 255 C 161 255 172 259 178 264"
        fill="none" stroke="#263C50" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

      {/* ── EARS ── */}
      <ellipse cx="89"  cy="192" rx="10" ry="14" fill={SKIN} />
      <ellipse cx="199" cy="192" rx="10" ry="14" fill={SKIN} />
      <ellipse cx="89"  cy="193" rx="5.5" ry="8" fill={SKIN_D} opacity="0.38" />
      <ellipse cx="199" cy="193" rx="5.5" ry="8" fill={SKIN_D} opacity="0.38" />

      {/* ── HAIR (behind face) ── */}
      <ellipse cx="144" cy="150" rx="64" ry="60" fill={HAIR} />
      <ellipse cx="90"  cy="174" rx="8"  ry="20" fill={HAIR} />
      <ellipse cx="198" cy="174" rx="8"  ry="20" fill={HAIR} />

      {/* ── FACE ── */}
      <ellipse cx="144" cy="194" rx="58" ry="64" fill={SKIN} />

      {/* ── EYEBROWS ── */}
      <Eyebrows expression={expression} />

      {/* ── EYES ── */}
      <Eyes blinking={blinking} expression={expression} />

      {/* ── GLASSES ── */}
      <rect x="104" y="167" width="38" height="22" rx="7" fill="rgba(196,220,242,0.18)" stroke={HAIR} strokeWidth="2.8" />
      <rect x="146" y="167" width="38" height="22" rx="7" fill="rgba(196,220,242,0.18)" stroke={HAIR} strokeWidth="2.8" />
      <line x1="142" y1="178" x2="146" y2="178" stroke={HAIR} strokeWidth="2.8" strokeLinecap="round" />
      <line x1="104" y1="178" x2="89"  y2="184" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="184" y1="178" x2="199" y2="184" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Lens glare */}
      <line x1="110" y1="171" x2="122" y2="171" stroke={W} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="152" y1="171" x2="164" y2="171" stroke={W} strokeWidth="2" strokeLinecap="round" opacity="0.5" />

      {/* ── NOSE ── */}
      <path d="M 139 202 C 137 208 141 213 144 213 C 147 213 151 208 149 202"
        fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />

      {/* ── EXPRESSION MOUTH ── */}
      <MouthFrame frame={isTalking ? mouthFrame : 2} expression={expression} />

      {/* ── THINKING: hand to chin ── */}
      {expression === "thinking" && (
        <g>
          <path d="M 36 310 C 52 296 74 274 96 268"
            fill="none" stroke={SHIRT} strokeWidth="32" strokeLinecap="round" />
          <ellipse cx="96" cy="263" rx="20" ry="16" fill={SKIN} />
          <path d="M 84 252 C 82 257 84 264 88 266"
            fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
          <path d="M 94 248 C 92 254 94 261 98 263"
            fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        </g>
      )}
    </svg>
  );
}
