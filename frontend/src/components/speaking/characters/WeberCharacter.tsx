"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type WeberExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: WeberExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: WeberExpression }) {
  const c = "#3E2723";
  const sw = 5;
  return (
    <g>
      <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: WeberExpression }) {
  const SKIN = "#FFE0B2";
  if (blinking) {
    return (
      <g>
        <rect x="95"  y="172" width="40" height="5" rx="2.5" fill={SKIN} />
        <rect x="153" y="172" width="40" height="5" rx="2.5" fill={SKIN} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="113" cy="176" rx={16} ry={expression === "talking" ? 13 : 11} fill="white" />
      <ellipse cx="115" cy="177" rx="7" ry="7" fill="#3E2723" />
      <ellipse cx="118" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
      
      <ellipse cx="175" cy="176" rx={16} ry={expression === "talking" ? 13 : 11} fill="white" />
      <ellipse cx="177" cy="177" rx="7" ry="7" fill="#3E2723" />
      <ellipse cx="180" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <g>
          <ellipse cx="144" cy="222" rx="18" ry="12" fill="#3E2723" />
          <path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#E91E63" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="144" cy="221" rx="12" ry="7" fill="#3E2723" />
          <path d="M 130 217 C 136 213 152 213 158 217" fill="none" stroke="#E91E63" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216" fill="none" stroke="#E91E63" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
  }
}

export function WeberCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
  const [mouthFrame, setMouthFrame] = useState(2);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!isTalking) { setMouthFrame(2); return; }
    const id = setInterval(() => setMouthFrame(f => (f + 1) % 3), 115);
    return () => clearInterval(id);
  }, [isTalking]);

  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
      tid = setTimeout(blink, 3000 + Math.random() * 2000);
    };
    tid = setTimeout(blink, 2200 + Math.random() * 1500);
    return () => clearTimeout(tid);
  }, []);

  const SKIN = "#FFE0B2";
  const SKIN_D = "#FFCC80";
  const HAIR = "#3E2723";
  const SCRUB = "#F48FB1"; // Pink scrub
  const COAT = "#FFFFFF"; // Doctor coat
  const ACCENT = "#0F766E"; // Medical accent

  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      {/* SCRUB INNER */}
      <path d="M 120 280 L 144 330 L 168 280 Z" fill={SCRUB} />

      {/* COAT */}
      <path d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 168,280 L 144,350 L 120,280 Z" fill={COAT} stroke="#CFD8DC" strokeWidth="2" />
      <path d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z" fill={COAT} stroke="#CFD8DC" strokeWidth="2" />
      <path d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z" fill={COAT} stroke="#CFD8DC" strokeWidth="2" />
      
      {/* Coat Collar */}
      <path d="M 120 280 L 110 330 L 144 350" fill="none" stroke="#CFD8DC" strokeWidth="3" />
      <path d="M 168 280 L 178 330 L 144 350" fill="none" stroke="#CFD8DC" strokeWidth="3" />

      {/* Stethoscope */}
      <path d="M 115 300 C 115 350 173 350 173 300" fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" />
      <circle cx="173" cy="355" r="10" fill="#E0E0E0" stroke={ACCENT} strokeWidth="3" />
      <path d="M 173 300 L 173 345" stroke={ACCENT} strokeWidth="6" />
      <circle cx="144" cy="325" r="6" fill={ACCENT} opacity="0.35" />

      <ellipse cx="50" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      <g>
        {/* Hair Back */}
        <ellipse cx="144" cy="150" rx="66" ry="70" fill={HAIR} />
        <ellipse cx="74" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />

        <ellipse cx="144" cy="196" rx="58" ry="64" fill={SKIN} />

        {/* Hair Front */}
        <path d="M 86 170 C 90 120 110 90 144 90 C 178 90 198 120 202 170 C 190 150 170 140 144 140 C 118 140 98 150 86 170 Z" fill={HAIR} />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} />
      </g>
    </svg>
  );
}
