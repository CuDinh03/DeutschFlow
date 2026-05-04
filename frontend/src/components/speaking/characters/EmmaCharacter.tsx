"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type EmmaExpression = "idle" | "talking" | "winking" | "thinking" | "laughing";

interface Props {
  expression?: EmmaExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

// ── Eyebrows ──────────────────────────────────────────────────────
function Eyebrows({ expression }: { expression: EmmaExpression }) {
  const c = "#2A1A08";
  const sw = 6;
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
    default: // idle
      return (
        <g>
          <path d="M 88 156 C 98 150 113 149 130 155" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <path d="M 158 155 C 175 149 190 150 200 156" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
  }
}

// ── Eyes ──────────────────────────────────────────────────────────
function Eyes({ blinking, expression }: { blinking: boolean; expression: EmmaExpression }) {
  const SKIN = "#F4C88A";
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
      {/* LEFT EYE */}
      {isWinking ? (
        <path d="M 95 176 C 105 169 121 169 131 176"
          fill="none" stroke="#C47A40" strokeWidth="5" strokeLinecap="round" />
      ) : isLaughing ? (
        <path d="M 95 174 C 105 166 121 166 131 174"
          fill="none" stroke="#2A1A08" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="113" cy="176" rx={17} ry={expression === "talking" ? 14 : 12} fill="white" />
          <ellipse cx="115" cy="177" rx="8" ry="8" fill="#3A1A08" />
          <ellipse cx="118" cy="175" rx="3" ry="3" fill="white" />
          {/* Lash top */}
          <path d="M 96 170 C 106 163 122 163 132 170" fill="none" stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {/* RIGHT EYE */}
      {isLaughing ? (
        <path d="M 157 174 C 167 166 183 166 193 174"
          fill="none" stroke="#2A1A08" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <g>
          <ellipse cx="175" cy="176" rx={17} ry={expression === "talking" ? 14 : 12} fill="white" />
          <ellipse cx="177" cy="177" rx="8" ry="8" fill="#3A1A08" />
          <ellipse cx="180" cy="175" rx="3" ry="3" fill="white" />
          {/* Lash top */}
          <path d="M 156 170 C 166 163 182 163 192 170" fill="none" stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// ── Mouth frames (lip-sync) ───────────────────────────────────────
function MouthFrame({ frame, expression }: { frame: number; expression: EmmaExpression }) {
  if (expression === "winking") {
    return (
      <path d="M 114 218 C 122 226 132 230 144 230 C 156 230 166 226 174 218"
        fill="none" stroke="#D05030" strokeWidth="3" strokeLinecap="round" />
    );
  }
  if (expression === "thinking") {
    return (
      <g>
        <path d="M 118 218 C 126 222 135 224 144 224 C 153 224 162 222 170 218"
          fill="none" stroke="#D05030" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  if (expression === "laughing") {
    return (
      <g>
        <path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214"
          fill="#1A0800" />
        <path d="M 108 214 C 116 224 128 232 144 234 C 160 232 172 224 180 214"
          fill="none" stroke="#D05030" strokeWidth="2.5" strokeLinecap="round" />
        {/* Teeth */}
        <rect x="122" y="214" width="44" height="10" rx="3" fill="white" />
      </g>
    );
  }
  switch (frame) {
    case 0: // wide open
      return (
        <g>
          <ellipse cx="144" cy="222" rx="20" ry="14" fill="#1A0800" />
          <path d="M 124 216 C 132 210 156 210 164 216"
            fill="none" stroke="#D05030" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 1: // mid
      return (
        <g>
          <ellipse cx="144" cy="221" rx="14" ry="8" fill="#1A0800" />
          <path d="M 130 217 C 136 213 152 213 158 217"
            fill="none" stroke="#D05030" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    default: // idle / closed soft smile
      return (
        <g>
          {/* Upper lip curve */}
          <path d="M 118 216 C 126 212 134 210 144 211 C 154 210 162 212 170 216"
            fill="none" stroke="#D05030" strokeWidth="2.5" strokeLinecap="round" />
          {/* Lower lip curve */}
          <path d="M 118 216 C 126 226 134 230 144 231 C 154 230 162 226 170 216"
            fill="#E88060" opacity="0.5" />
        </g>
      );
  }
}

// ── Main Component ────────────────────────────────────────────────
export function EmmaCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
  const [mouthFrame, setMouthFrame] = useState(2);
  const [blinking, setBlinking]   = useState(false);

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

  const SKIN   = "#F4C88A";
  const SKIN_D = "#D4A060";
  const HAIR   = "#D97200";
  const HAIR_L = "#F09020";
  const OUTFIT = "#00A895";
  const W      = "#FFFFFF";

  return (
    <svg
      viewBox="0 0 280 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
    >
      {/* ── OUTFIT BODY ── */}
      <path
        d="M 92,268 C 68,278 48,310 42,344 L 32,500 L 256,500 L 246,344 C 240,310 220,278 196,268 L 178,261 C 171,274 162,280 144,280 C 126,280 117,274 110,261 Z"
        fill={OUTFIT}
      />
      {/* Left arm */}
      <path
        d="M 42,344 C 30,362 20,394 22,424 L 38,438 C 48,447 66,446 70,436 L 76,418 C 78,394 76,366 68,344 Z"
        fill={OUTFIT}
      />
      {/* Right arm */}
      <path
        d="M 246,344 C 258,362 268,394 266,424 L 250,438 C 240,447 222,446 218,436 L 212,418 C 210,394 212,366 220,344 Z"
        fill={OUTFIT}
      />
      {/* Outfit highlight stripe */}
      <path
        d="M 100,280 L 92,500 L 104,500 L 112,285 Z"
        fill="rgba(255,255,255,0.08)"
      />

      {/* Hands */}
      <ellipse cx="50"  cy="440" rx="18" ry="12" fill={SKIN} />
      <ellipse cx="238" cy="440" rx="18" ry="12" fill={SKIN} />

      {/* Thinking: finger near chin */}
      {expression === "thinking" && (
        <g>
          <path d="M 30 310 C 46 295 70 274 92 268"
            fill="none" stroke={OUTFIT} strokeWidth="30" strokeLinecap="round" />
          <ellipse cx="92" cy="263" rx="20" ry="15" fill={SKIN} />
          <path d="M 80 252 C 78 258 80 265 84 267"
            fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </g>
      )}

      {/* ── NECK ── */}
      <rect x="130" y="254" width="28" height="28" rx="7" fill={SKIN} />

      {/* ── HEAD GROUP (rotated 5° to the right) ── */}
      <g transform="rotate(5 144 310)">
        {/* ── HAIR back layer ── */}
        <ellipse cx="144" cy="148" rx="76" ry="80" fill={HAIR} />
        {/* Side volume left */}
        <ellipse cx="72"  cy="198" rx="26" ry="46" fill={HAIR} />
        {/* Side volume right */}
        <ellipse cx="216" cy="198" rx="26" ry="46" fill={HAIR} />
        {/* Long hair strands down */}
        <path d="M 72 220 C 64 258 66 300 76 330 C 84 310 80 272 84 240 Z"
          fill={HAIR} opacity="0.85" />
        <path d="M 216 220 C 224 258 222 300 212 330 C 204 310 208 272 204 240 Z"
          fill={HAIR} opacity="0.85" />

        {/* ── EARS ── */}
        <ellipse cx="74"  cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="214" cy="196" rx="10" ry="14" fill={SKIN} />
        <ellipse cx="74"  cy="197" rx="5.5" ry="8" fill={SKIN_D} opacity="0.35" />
        <ellipse cx="214" cy="197" rx="5.5" ry="8" fill={SKIN_D} opacity="0.35" />

        {/* EARRINGS */}
        <circle cx="72"  cy="210" r="7" fill={OUTFIT} />
        <circle cx="72"  cy="210" r="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <circle cx="216" cy="210" r="7" fill={OUTFIT} />
        <circle cx="216" cy="210" r="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* ── HAIR FRONT (top/forehead area) ── */}
        <path
          d="M 76 192 C 78 128 102 80 144 72 C 186 80 210 128 212 192 C 200 162 186 146 168 142 C 158 140 152 138 144 138 C 136 138 130 140 120 142 C 102 146 88 162 76 192 Z"
          fill={HAIR_L}
        />
        {/* Hair highlight */}
        <ellipse cx="144" cy="106" rx="28" ry="22" fill="#F8A020" opacity="0.35" />
        {/* Wavy fringe */}
        <path d="M 100 166 C 108 155 120 150 132 158 C 136 161 140 164 144 162 C 148 164 152 161 156 158 C 168 150 180 155 188 166"
          fill={HAIR_L} opacity="0.7" />

        {/* ── FACE ── */}
        <ellipse cx="144" cy="196" rx="60" ry="66" fill={SKIN} />

        {/* Cheek blush */}
        <ellipse cx="92"  cy="210" rx="18" ry="10" fill="#FFB0A0" opacity="0.25" />
        <ellipse cx="196" cy="210" rx="18" ry="10" fill="#FFB0A0" opacity="0.25" />

        {/* ── EYEBROWS ── */}
        <Eyebrows expression={expression} />

        {/* ── EYES ── */}
        <Eyes blinking={blinking} expression={expression} />

        {/* ── NOSE ── */}
        <path d="M 139 206 C 137 213 141 218 144 218 C 147 218 151 213 149 206"
          fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />

        {/* ── MOUTH ── */}
        <MouthFrame frame={isTalking ? mouthFrame : 2} expression={expression} />

        {/* Laugh cheeks (laughing expression) */}
        {expression === "laughing" && (
          <g>
            <ellipse cx="92"  cy="212" rx="22" ry="12" fill="#FF9080" opacity="0.35" />
            <ellipse cx="196" cy="212" rx="22" ry="12" fill="#FF9080" opacity="0.35" />
          </g>
        )}

        {/* Creative spark (thinking expression) */}
        {expression === "thinking" && (
          <g opacity="0.7">
            <circle cx="220" cy="130" r="8" fill="#FFCE00" opacity="0.5" />
            <circle cx="230" cy="110" r="5" fill="#FFCE00" opacity="0.35" />
            <path d="M 220 130 L 228 118" stroke="#FFCE00" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <text x="226" y="108" fontSize="12" fill="#FFCE00" opacity="0.7">✦</text>
          </g>
        )}
      </g>
    </svg>
  );
}
