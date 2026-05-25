"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type MaxExpression = "neutral" | "talking" | "smiling" | "thinking" | "serious";

interface Props {
  expression?: MaxExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: MaxExpression }) {
  const c = "#1C1C1C";
  const sw = 6;
  return (
    <g>
      <path d="M 100 155 C 109 149 122 148 136 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 152 154 C 166 148 179 149 188 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

function Eyes({ blinking }: { blinking: boolean }) {
  if (blinking) {
    return (
      <g>
        <rect x="106" y="173" width="36" height="5" rx="2.5" fill="#E0AC69" />
        <rect x="146" y="173" width="36" height="5" rx="2.5" fill="#E0AC69" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="124" cy="176" rx="14" ry="10" fill="white" />
      <ellipse cx="126" cy="177" rx="6" ry="6" fill="#1C1C1C" />
      <ellipse cx="128" cy="175" rx="2" ry="2" fill="white" />
      <ellipse cx="164" cy="176" rx="14" ry="10" fill="white" />
      <ellipse cx="166" cy="177" rx="6" ry="6" fill="#1C1C1C" />
      <ellipse cx="168" cy="175" rx="2" ry="2" fill="white" />
    </g>
  );
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <g>
          <ellipse cx="144" cy="218" rx="16" ry="11" fill="#2D1A11" />
          <ellipse cx="144" cy="213" rx="16" ry="4" fill="#E0AC69" />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="144" cy="218" rx="11" ry="6" fill="#2D1A11" />
          <ellipse cx="144" cy="215" rx="11" ry="3" fill="#E0AC69" />
        </g>
      );
    default:
      return <path d="M 128 215 C 134 219 144 221 158 218 C 166 216 168 212 168 212" fill="none" stroke="#7A5C45" strokeWidth="2.5" strokeLinecap="round" />;
  }
}

export function MaxCharacter({ expression = "neutral", isTalking = false, style, className }: Props) {
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
    tid = setTimeout(blink, 2000 + Math.random() * 1500);
    return () => clearTimeout(tid);
  }, []);

  const SKIN = "#E0AC69";
  const SKIN_D = "#C48A45";
  const HAIR = "#1C1C1C";
  const OVERALLS = "#1D4ED8"; // Blue coveralls
  const TSHIRT = "#374151"; // Dark grey shirt
  const SAFETY = "#FACC15"; // Safety accent
  const POCKET = "#0F172A";
  const TOOL = "#F97316";
  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      {/* T-SHIRT */}
      <path d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 174,261 C 167,273 158,279 144,279 C 130,279 121,273 114,261 Z" fill={TSHIRT} />
      <path d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z" fill={TSHIRT} />
      <path d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z" fill={TSHIRT} />
      
      {/* COVERALLS (Dungarees style) */}
      <path d="M 80 344 L 80 500 L 208 500 L 208 344 C 200 320 180 310 144 310 C 108 310 88 320 80 344 Z" fill={OVERALLS} />
      {/* Straps */}
      <path d="M 100 280 L 80 344" stroke={OVERALLS} strokeWidth="20" />
      <path d="M 188 280 L 208 344" stroke={OVERALLS} strokeWidth="20" />
      {/* Buttons */}
      <circle cx="95" cy="340" r="5" fill={SAFETY} />
      <circle cx="193" cy="340" r="5" fill={SAFETY} />
      {/* Tool pocket */}
      <rect x="176" y="365" width="28" height="34" rx="4" fill={POCKET} opacity="0.45" />
      <path d="M 182 372 L 198 372" stroke={TOOL} strokeWidth="3" strokeLinecap="round" />
      <path d="M 182 380 L 194 388" stroke={TOOL} strokeWidth="3" strokeLinecap="round" />

      <ellipse cx="53" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="235" cy="440" rx="18" ry="12" fill={SKIN} />

      <rect x="132" y="252" width="24" height="28" rx="7" fill={SKIN} />

      <ellipse cx="89" cy="192" rx="10" ry="14" fill={SKIN} />
      <ellipse cx="199" cy="192" rx="10" ry="14" fill={SKIN} />

      <ellipse cx="144" cy="150" rx="55" ry="50" fill={HAIR} />

      <ellipse cx="144" cy="194" rx="58" ry="64" fill={SKIN} />

      {/* Safety glasses resting on head */}
      <path d="M 80 140 C 100 110 188 110 208 140" fill="none" stroke={SAFETY} strokeWidth="8" strokeLinecap="round" />
      <rect x="100" y="115" width="35" height="20" rx="4" fill={SAFETY} opacity="0.6" />
      <rect x="153" y="115" width="35" height="20" rx="4" fill={SAFETY} opacity="0.6" />
      <Eyebrows expression={expression} />
      <Eyes blinking={blinking} />
      <path d="M 139 202 C 137 208 141 213 144 213 C 147 213 151 208 149 202" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
      <MouthFrame frame={isTalking ? mouthFrame : 2} />
    </svg>
  );
}
