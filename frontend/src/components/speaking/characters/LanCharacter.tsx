"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type LanExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: LanExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: LanExpression }) {
  const c = "#3E2723";
  const sw = 5;
  return (
    <g>
      <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: LanExpression }) {
  const SKIN = "#F0CBA1";
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
          <ellipse cx="144" cy="222" rx="18" ry="12" fill="#3B1A1A" />
          <path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#D81B60" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="144" cy="221" rx="12" ry="7" fill="#3B1A1A" />
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

export function LanCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
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

  const SKIN = "#F0CBA1";
  const SKIN_D = "#D1A376";
  const HAIR = "#3E2723"; // Dark Brown
  const SHIRT = "#7C3AED"; // Soft purple
  const ACCENT = "#EAB308";
  const HAIR_TIE = "#C084FC";

  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      {/* SHIRT */}
      <path d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z" fill={SHIRT} />
      <path d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z" fill={SHIRT} />
      <path d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z" fill={SHIRT} />
      {/* Visual accent */}
      <path d="M 112 286 C 126 274 154 274 168 286" fill="none" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      <circle cx="144" cy="306" r="6" fill={ACCENT} />

      <ellipse cx="50" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      <g>
        {/* Hair Back (Long) */}
        <path d="M 60 170 C 60 300 80 400 100 420 L 144 140 Z" fill={HAIR} />
        <path d="M 220 170 C 220 300 200 400 180 420 L 144 140 Z" fill={HAIR} />
        <ellipse cx="144" cy="150" rx="66" ry="70" fill={HAIR} />

        <ellipse cx="74" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />

        <ellipse cx="144" cy="196" rx="58" ry="64" fill={SKIN} />

        {/* Hair Front */}
        <path d="M 86 170 C 90 130 110 100 144 100 C 178 100 198 130 202 170 C 190 140 170 130 144 130 C 118 130 98 140 86 170 Z" fill={HAIR} />
        <circle cx="180" cy="116" r="10" fill={HAIR_TIE} opacity="0.7" />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} />
      </g>
    </svg>
  );
}
