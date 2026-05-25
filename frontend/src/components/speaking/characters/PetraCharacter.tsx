"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type PetraExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: PetraExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: PetraExpression }) {
  const c = "#2D2D2D";
  const sw = 5;
  return (
    <g>
      <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: PetraExpression }) {
  const SKIN = "#F4C88A";
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
      <ellipse cx="115" cy="177" rx="7" ry="7" fill="#2D2D2D" />
      <ellipse cx="118" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" />
      
      <ellipse cx="175" cy="176" rx={15} ry={expression === "talking" ? 12 : 10} fill="white" />
      <ellipse cx="177" cy="177" rx="7" ry="7" fill="#2D2D2D" />
      <ellipse cx="180" cy="175" rx="2.5" ry="2.5" fill="white" />
      <path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function MouthFrame({ frame }: { frame: number }) {
  switch (frame) {
    case 0:
      return (
        <g>
          <ellipse cx="144" cy="222" rx="18" ry="12" fill="#3B1A1A" />
          <path d="M 124 216 C 132 210 156 210 164 216" fill="none" stroke="#B83B5E" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 1:
      return (
        <g>
          <ellipse cx="144" cy="221" rx="12" ry="7" fill="#3B1A1A" />
          <path d="M 130 217 C 136 213 152 213 158 217" fill="none" stroke="#B83B5E" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216" fill="none" stroke="#B83B5E" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
  }
}

export function PetraCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
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

  const SKIN = "#F4C88A";
  const SKIN_D = "#D4A060";
  const HAIR = "#4A4A4A";
  const SHIRT = "#F3F4F6"; 
  const APRON = "#B91C1C"; // Metzger Red
  const ACCENT = "#F8B4C4";
  const STRIPE = "#FDE68A";
  const MEAT = "#7F1D1D";
  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      {/* SHIRT */}
      <path d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z" fill={SHIRT} />
      <path d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z" fill={SHIRT} />
      <path d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z" fill={SHIRT} />
      
      {/* RED APRON */}
      <path d="M 80 344 L 80 500 L 208 500 L 208 344 C 200 310 180 280 144 280 C 108 280 88 310 80 344 Z" fill={APRON} />
      <path d="M 100 285 L 70 344" stroke={APRON} strokeWidth="12" />
      <path d="M 188 285 L 218 344" stroke={APRON} strokeWidth="12" />
      <path d="M 96 374 L 192 374" stroke={STRIPE} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <path d="M 96 396 L 192 396" stroke={STRIPE} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <circle cx="108" cy="430" r="9" fill={MEAT} opacity="0.7" />
      <circle cx="126" cy="442" r="7" fill={MEAT} opacity="0.45" />

      <ellipse cx="50" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      <g>
        {/* Hair Back (Tied up) */}
        <ellipse cx="144" cy="140" rx="60" ry="60" fill={HAIR} />
        <ellipse cx="144" cy="90" rx="25" ry="25" fill={HAIR} /> {/* Bun */}
        
        <ellipse cx="74" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />

        <ellipse cx="144" cy="196" rx="60" ry="66" fill={SKIN} />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} />
      </g>
    </svg>
  );
}
