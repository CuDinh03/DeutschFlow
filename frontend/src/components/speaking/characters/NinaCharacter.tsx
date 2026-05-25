"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type NinaExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: NinaExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: NinaExpression }) {
  const c = "#212121";
  const sw = 5;
  return (
    <g>
      <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: NinaExpression }) {
  const SKIN = "#FAD6A5";
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
      <ellipse cx="113" cy="176" rx={15} ry={expression === "talking" ? 12 : 10} fill="white" />
      <ellipse cx="115" cy="177" rx="7" ry="7" fill="#212121" />
      <ellipse cx="118" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#212121" strokeWidth="2.5" strokeLinecap="round" />
      
      <ellipse cx="175" cy="176" rx={15} ry={expression === "talking" ? 12 : 10} fill="white" />
      <ellipse cx="177" cy="177" rx="7" ry="7" fill="#212121" />
      <ellipse cx="180" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#212121" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <g>
          <ellipse cx="144" cy="222" rx="16" ry="11" fill="#3B1A1A" />
          <path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#D81B60" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="144" cy="221" rx="11" ry="6" fill="#3B1A1A" />
          <path d="M 130 217 C 136 213 152 213 158 217" fill="none" stroke="#D81B60" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216" fill="none" stroke="#D81B60" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 118 216 C 126 226 134 230 144 231 C 154 230 162 226 170 216" fill="#F48FB1" opacity="0.6" />
        </g>
      );
  }
}

export function NinaCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
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

  const SKIN = "#FAD6A5";
  const SKIN_D = "#E8BB85";
  const HAIR = "#212121"; // Black hair
  const SHIRT = "#FFFFFF"; // White shirt
  const BLAZER = "#BE123C"; // Deep rose blazer
  const ACCENT = "#F59E0B"; // Warm accent
  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      {/* SHIRT */}
      <path d="M 120 280 L 144 330 L 168 280 Z" fill={SHIRT} />
      {/* Necktie / Scarf */}
      <path d="M 135 290 L 153 290 L 144 320 Z" fill={ACCENT} />
      {/* BLAZER */}
      <path d="M 96,268 C 72,278 52,310 46,344 L 36,500 L 252,500 L 242,344 C 236,310 216,278 192,268 L 168,280 L 144,350 L 120,280 Z" fill={BLAZER} />
      <path d="M 46,344 C 34,362 24,394 26,422 L 41,437 C 51,446 69,445 74,435 L 80,417 C 82,394 80,366 72,344 Z" fill={BLAZER} />
      <path d="M 242,344 C 254,362 264,394 262,422 L 247,437 C 237,446 219,445 214,435 L 208,417 C 206,394 208,366 216,344 Z" fill={BLAZER} />
      
      {/* Blazer Collar */}
      <path d="M 120 280 L 100 330 L 144 350" fill="none" stroke="#AD1457" strokeWidth="3" />
      <path d="M 168 280 L 188 330 L 144 350" fill="none" stroke="#AD1457" strokeWidth="3" />

      <ellipse cx="50" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      <g>
        {/* Hair Back */}
        <ellipse cx="144" cy="150" rx="66" ry="70" fill={HAIR} />
        {/* Neat bun */}
        <ellipse cx="144" cy="95" rx="30" ry="25" fill={HAIR} />

        <ellipse cx="74" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />

        <ellipse cx="144" cy="196" rx="58" ry="64" fill={SKIN} />

        {/* Hair Front */}
        <path d="M 86 170 C 90 130 110 100 144 100 C 178 100 198 130 202 170 C 190 140 170 130 144 130 C 118 130 98 140 86 170 Z" fill={HAIR} />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} />
      </g>
    </svg>
  );
}
