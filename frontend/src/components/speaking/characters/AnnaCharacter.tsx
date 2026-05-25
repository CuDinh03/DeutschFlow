"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type AnnaExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: AnnaExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Eyebrows({ expression }: { expression: AnnaExpression }) {
  const c = "#3E2723";
  const sw = 5;
  switch (expression) {
    case "talking":
      return (
        <g>
          <path d="M 88 152 C 98 145 113 143 130 149" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 149 C 175 143 190 145 200 152" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "winking":
      return (
        <g>
          <path d="M 88 155 C 98 149 113 148 130 153" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 153 C 175 148 190 149 200 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <path d="M 88 155 C 98 149 113 148 130 154" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 148 C 175 152 190 156 200 152" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case "laughing":
      return (
        <g>
          <path d="M 88 150 C 98 143 113 141 130 147" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 147 C 175 141 190 143 200 150" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
  }
}

function Eyes({ blinking, expression }: { blinking: boolean; expression: AnnaExpression }) {
  const SKIN = "#FAD6A5";
  const isWinking = expression === "winking";
  const isLaughing = expression === "laughing";

  if (blinking && !isLaughing) {
    return (
      <g>
        <rect x="95"  y="172" width="40" height="5" rx="2.5" fill={SKIN} />
        <rect x="153" y="172" width="40" height="5" rx="2.5" fill={SKIN} />
      </g>
    );
  }

  return (
    <g>
      {isWinking ? (
        <path d="M 95 176 C 105 169 121 169 131 176" fill="none" stroke="#3E2723" strokeWidth="5" strokeLinecap="round" />
      ) : isLaughing ? (
        <path d="M 95 174 C 105 166 121 166 131 174" fill="none" stroke="#3E2723" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="113" cy="176" rx={16} ry={expression === "talking" ? 13 : 11} fill="white" />
          <ellipse cx="115" cy="177" rx="7" ry="7" fill="#4A3B32" />
          <ellipse cx="118" cy="175" rx="2.5" ry="2.5" fill="white" />
          <path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {isLaughing ? (
        <path d="M 157 174 C 167 166 183 166 193 174" fill="none" stroke="#3E2723" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="175" cy="176" rx={16} ry={expression === "talking" ? 13 : 11} fill="white" />
          <ellipse cx="177" cy="177" rx="7" ry="7" fill="#4A3B32" />
          <ellipse cx="180" cy="175" rx="2.5" ry="2.5" fill="white" />
          <path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

function MouthFrame({ frame, expression }: { frame: number; expression: AnnaExpression }) {
  if (expression === "winking") {
    return <path d="M 114 218 C 122 226 132 230 144 230 C 156 230 166 226 174 218" fill="none" stroke="#B83B5E" strokeWidth="3" strokeLinecap="round" />;
  }
  if (expression === "thinking") {
    return <path d="M 118 218 C 126 222 135 224 144 224 C 153 224 162 222 170 218" fill="none" stroke="#B83B5E" strokeWidth="2.5" strokeLinecap="round" />;
  }
  if (expression === "laughing") {
    return (
      <g>
        <path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214" fill="#3B1A1A" />
        <path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214" fill="none" stroke="#B83B5E" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="122" y="214" width="44" height="8" rx="3" fill="white" />
      </g>
    );
  }
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
          <path d="M 118 216 C 126 226 134 230 144 231 C 154 230 162 226 170 216" fill="#F06292" opacity="0.6" />
        </g>
      );
  }
}

export function AnnaCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
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
  const HAIR = "#6B4423";
  const OUTFIT = "#FB923C"; // Orange
  const ACCENT = "#B83B5E"; // Scarf accent
  const POCKET = "#8B5E3C";
  return (
    <svg viewBox="0 0 280 500" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: "100%", height: "100%", display: "block", ...style }}>
      <path d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z" fill={OUTFIT} />
      <path d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z" fill={OUTFIT} />
      <path d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z" fill={OUTFIT} />
      {/* Scarf */}
      <path d="M 110 264 C 116 270 127 280 144 280 C 161 280 172 270 178 264 L 160 320 L 144 330 L 128 320 Z" fill={ACCENT} opacity="0.9" />
      <circle cx="144" cy="322" r="6" fill={POCKET} opacity="0.35" />
      <ellipse cx="50" cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      {expression === "thinking" && (
        <g>
          <path d="M 30 310 C 46 295 70 274 92 268" fill="none" stroke={OUTFIT} strokeWidth="30" strokeLinecap="round" />
          <ellipse cx="92" cy="263" rx="20" ry="15" fill={SKIN} />
          <path d="M 80 252 C 78 258 80 265 84 267" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </g>
      )}

      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      <g transform="rotate(-3 144 310)">
        {/* Hair Back */}
        <ellipse cx="144" cy="160" rx="70" ry="90" fill={HAIR} />
        <ellipse cx="74" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />

        {/* Face */}
        <ellipse cx="144" cy="196" rx="58" ry="64" fill={SKIN} />

        {/* Hair Front */}
        <path d="M 86 170 C 90 120 110 90 144 90 C 178 90 198 120 202 170 C 190 140 170 130 144 130 C 118 130 98 140 86 170 Z" fill={HAIR} />
        <path d="M 144 90 C 130 100 120 120 100 140 C 110 130 120 110 144 100" fill="#8D6E63" opacity="0.6" />

        <Eyebrows expression={expression} />
        <Eyes blinking={blinking} expression={expression} />
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206" fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />
        <MouthFrame frame={isTalking ? mouthFrame : 2} expression={expression} />

        {expression === "laughing" && (
          <g>
            <ellipse cx="92" cy="212" rx="20" ry="10" fill="#FF9080" opacity="0.4" />
            <ellipse cx="196" cy="212" rx="20" ry="10" fill="#FF9080" opacity="0.4" />
          </g>
        )}
      </g>
    </svg>
  );
}
