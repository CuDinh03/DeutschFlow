"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

/** Matches LukasCharacter expression API for SpeakingCharacterFloat / PersonaAvatar. */
export type KlausExpression = "neutral" | "talking" | "smiling" | "thinking" | "serious";

interface Props {
  expression?: KlausExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

const BURGUNDY = "#7F1D1D";
const BURGUNDY_L = "#991B1B";
const JACKET = "#FAFAF8";
const JACKET_SH = "#E8E4DF";
const SKIN = "#E8B896";
const SKIN_D = "#C4835A";

function EyebrowsKlaus({ expression }: { expression: KlausExpression }) {
  const c = "#3F1212";
  const sw = 5;
  switch (expression) {
    case "smiling":
      return (
        <g>
          <path d="M 102 156 C 112 148 124 146 138 152" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 150 152 C 164 146 176 148 186 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "serious":
      return (
        <g>
          <path d="M 100 162 C 112 156 126 155 140 160" fill="none" stroke={c} strokeWidth={5.5} strokeLinecap="round" />
          <path d="M 148 160 C 162 155 176 156 188 162" fill="none" stroke={c} strokeWidth={5.5} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 102 158 C 111 152 124 151 138 157" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 150 157 C 164 151 177 152 186 158" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
  }
}

function EyesKlaus({ blinking, expression }: { blinking: boolean; expression: KlausExpression }) {
  if (blinking) {
    return (
      <g>
        <rect x="108" y="178" width="34" height="5" rx="2.5" fill={SKIN} />
        <rect x="148" y="178" width="34" height="5" rx="2.5" fill={SKIN} />
      </g>
    );
  }
  const squint = expression === "smiling";
  return (
    <g>
      <ellipse cx="125" cy="180" rx={squint ? 12 : 14} ry={squint ? 7 : 10} fill="white" />
      <ellipse cx="127" cy="181" rx="6" ry={squint ? 5 : 6.5} fill="#1a1a24" />
      <ellipse cx="165" cy="180" rx={squint ? 12 : 14} ry={squint ? 7 : 10} fill="white" />
      <ellipse cx="167" cy="181" rx="6" ry={squint ? 5 : 6.5} fill="#1a1a24" />
    </g>
  );
}

function MouthKlaus({ frame, expression }: { frame: number; expression: KlausExpression }) {
  if (expression === "thinking") {
    return <path d="M 134 224 L 156 224" fill="none" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />;
  }
  if (expression === "serious") {
    return <path d="M 128 228 C 138 224 150 223 162 228" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" />;
  }
  switch (frame) {
    case 0:
      return (
        <g>
          <ellipse cx="145" cy="222" rx="16" ry="12" fill="#2a1212" />
          <ellipse cx="145" cy="217" rx="16" ry="5" fill={SKIN} />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="145" cy="222" rx="12" ry="7" fill="#2a1212" />
          <ellipse cx="145" cy="219" rx="12" ry="4" fill={SKIN} />
        </g>
      );
    default:
      return <path d="M 124 218 C 132 226 142 230 156 228" fill="none" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />;
  }
}

export function KlausCharacter({ expression = "neutral", isTalking = false, style, className }: Props) {
  const [mouthFrame, setMouthFrame] = useState(2);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!isTalking) {
      setMouthFrame(2);
      return;
    }
    const id = setInterval(() => setMouthFrame((f) => (f + 1) % 3), 115);
    return () => clearInterval(id);
  }, [isTalking]);

  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
      tid = setTimeout(blink, 2800 + Math.random() * 2200);
    };
    tid = setTimeout(blink, 1800 + Math.random() * 1400);
    return () => clearTimeout(tid);
  }, []);

  return (
    <svg
      viewBox="0 0 280 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
      aria-hidden
    >
      {/* Chef jacket body */}
      <path
        d="M 88 272 C 64 288 48 322 42 360 L 32 500 L 250 500 L 238 360 C 232 322 216 288 192 272 L 174 266 C 168 274 158 278 144 278 C 130 278 120 274 114 266 Z"
        fill={JACKET}
      />
      <path
        d="M 88 272 C 64 288 48 322 42 360 L 32 500 L 250 500 L 238 360 C 232 322 216 288 192 272"
        fill="none"
        stroke={JACKET_SH}
        strokeWidth="1.5"
        opacity="0.85"
      />
      {/* Double-breast + burgundy buttons */}
      <path
        d="M 144 300 L 144 420 M 118 318 C 118 318 128 308 144 304 M 170 318 C 170 318 160 308 144 304"
        fill="none"
        stroke={BURGUNDY}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.9"
      />
      {[320, 352, 384].map((y) => (
        <circle key={`L-${y}`} cx="128" cy={y} r="5" fill={BURGUNDY} />
      ))}
      {[320, 352, 384].map((y) => (
        <circle key={`R-${y}`} cx="160" cy={y} r="5" fill={BURGUNDY} />
      ))}
      {/* Crossed knives badge */}
      <g opacity="0.9">
        <rect x="118" y="400" width="52" height="36" rx="8" fill={BURGUNDY} opacity="0.12" />
        <path
          d="M 132 420 L 152 408 M 132 408 L 152 420"
          stroke={BURGUNDY_L}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
      {/* Arms */}
      <path d="M 42 360 C 30 384 22 420 26 450 L 38 462 C 50 468 66 462 70 450 L 76 418 C 76 392 72 372 64 352 Z" fill={JACKET} />
      <path d="M 238 360 C 250 384 258 420 254 450 L 242 462 C 230 468 214 462 210 450 L 204 418 C 204 392 208 372 216 352 Z" fill={JACKET} />
      <ellipse cx="48" cy="468" rx="17" ry="11" fill={SKIN} />
      <ellipse cx="234" cy="468" rx="17" ry="11" fill={SKIN} />

      {/* Neck + neckerchief */}
      <rect x="130" y="252" width="28" height="30" rx="8" fill={SKIN} />
      <path d="M 108 268 C 120 262 132 258 144 258 C 156 258 168 262 180 268 L 176 282 C 162 276 150 274 144 274 C 138 274 126 276 112 282 Z" fill={BURGUNDY} />

      {/* Toque (chef hat) — behind face */}
      <path
        d="M 60 188 C 56 120 88 52 144 48 C 200 52 228 112 232 188 C 208 168 178 158 144 160 C 110 158 80 168 60 188 Z"
        fill="#F4F4F2"
      />
      <ellipse cx="144" cy="192" rx="88" ry="26" fill="#EEECE8" stroke={JACKET_SH} strokeWidth="1.5" />
      <path d="M 76 176 C 92 140 112 88 144 72 C 176 88 196 140 212 176" fill="none" stroke="white" strokeWidth="4" opacity="0.45" strokeLinecap="round" />

      {/* Ears */}
      <ellipse cx="86" cy="198" rx="9" ry="13" fill={SKIN} />
      <ellipse cx="202" cy="198" rx="9" ry="13" fill={SKIN} />

      {/* Face */}
      <ellipse cx="144" cy="202" rx="56" ry="62" fill={SKIN} />
      {/* Light mustache */}
      <path
        d="M 118 226 C 128 222 138 224 144 228 C 150 224 160 222 170 226"
        fill="none"
        stroke="#5C3D2E"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />

      <EyebrowsKlaus expression={expression} />
      <EyesKlaus blinking={blinking} expression={expression} />
      <path d="M 138 212 C 136 218 140 222 144 222 C 148 222 152 218 150 212" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
      <MouthKlaus frame={isTalking ? mouthFrame : 2} expression={expression} />
    </svg>
  );
}
