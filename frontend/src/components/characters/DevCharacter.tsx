export function DevCharacter({ className = "" }: { className?: string }) {
  const SKIN   = "#F5C89A";
  const SKIN_D = "#E8A870";  // darker skin for ear inner / nose
  const HAIR   = "#1A1A2E";
  const HOODIE = "#2C2C3A";
  const W      = "#FFFFFF";

  return (
    <svg
      viewBox="0 0 380 480"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* ────── WALL ────── */}
      <rect width="380" height="480" fill="#F4F6F9" />

      {/* subtle wall grid lines */}
      {[80, 160, 240, 320].map((x) => (
        <line key={`vl-${x}`} x1={x} y1="0" x2={x} y2="480"
          stroke="#E8ECF2" strokeWidth="1" />
      ))}
      {[80, 160, 240, 320, 400].map((y) => (
        <line key={`hl-${y}`} x1="0" y1={y} x2="380" y2={y}
          stroke="#E8ECF2" strokeWidth="1" />
      ))}

      {/* ────── WINDOW ────── */}
      {/* Window recess / shadow border */}
      <rect x="33" y="8" width="314" height="210" rx="11" fill="#C5D8EC" />
      {/* Sky */}
      <rect x="36" y="11" width="308" height="204" rx="9" fill="#DDEEFF" />

      {/* Sky gradient overlay */}
      <rect x="36" y="11" width="308" height="100" rx="9" fill="#C5E0F8" opacity="0.3" />

      {/* ── Berlin skyline silhouette ── */}
      {/* Fernsehturm (TV Tower) */}
      <rect x="184" y="36" width="5" height="95" fill="#8FAEC8" opacity="0.32" />
      <circle cx="186" cy="60" r="14" fill="#8FAEC8" opacity="0.32" />
      <rect x="183" y="55" width="7" height="14" fill="#DDEEFF" />

      {/* Left buildings */}
      <rect x="44"  y="148" width="32" height="66" rx="3" fill="#8FAEC8" opacity="0.26" />
      <rect x="80"  y="158" width="24" height="56" rx="2" fill="#8FAEC8" opacity="0.22" />
      <rect x="108" y="140" width="18" height="74" rx="2" fill="#7E9EB8" opacity="0.24" />
      <rect x="130" y="162" width="14" height="52" rx="2" fill="#8FAEC8" opacity="0.2"  />

      {/* Right buildings */}
      <rect x="248" y="156" width="26" height="58" rx="2" fill="#8FAEC8" opacity="0.22" />
      <rect x="278" y="142" width="22" height="72" rx="3" fill="#8FAEC8" opacity="0.26" />
      <rect x="304" y="160" width="30" height="54" rx="3" fill="#7E9EB8" opacity="0.22" />

      {/* Window frame dividers */}
      <rect x="36"  y="113" width="308" height="4" fill={W} opacity="0.85" />
      <rect x="188" y="11"  width="4" height="204" fill={W} opacity="0.85" />
      {/* Window border frame */}
      <rect x="36" y="11" width="308" height="204" rx="9"
        fill="none" stroke="#B0C8DE" strokeWidth="4" />

      {/* ────── FLOOR ────── */}
      <rect x="0" y="402" width="380" height="78" fill="#DDE3EC" />
      <rect x="0" y="400" width="380" height="5"  fill="#C4CEDB" />

      {/* ────── POTTED PLANT (right corner) ────── */}
      <rect x="321" y="367" width="40" height="35" rx="5" fill="#5A6A7E" />
      <rect x="317" y="360" width="48" height="10" rx="4" fill="#445566" />
      {/* Stem */}
      <rect x="339" y="330" width="3"  height="35" fill="#1A5C3A" rx="1.5" />
      {/* Leaves */}
      <ellipse cx="341" cy="336" rx="17" ry="26" fill="#1E6B4A"
        transform="rotate(-14 341 336)" />
      <ellipse cx="348" cy="330" rx="15" ry="22" fill="#27AE60"
        transform="rotate(16 348 330)" />
      <ellipse cx="330" cy="326" rx="12" ry="19" fill="#195A3D"
        transform="rotate(-28 330 326)" />
      <ellipse cx="354" cy="322" rx="10" ry="16" fill="#2ECC71" opacity="0.7"
        transform="rotate(22 354 322)" />

      {/* ────── HOODIE BODY ────── */}
      {/* Main torso */}
      <path
        d="M 144,270 C 120,280 100,310 94,342
           L 84,460
           L 292,460
           L 282,342
           C 276,310 256,280 232,270
           L 214,262
           C 207,274 198,280 188,280
           C 178,280 169,274 162,262
           Z"
        fill={HOODIE}
      />

      {/* Left arm (hanging at side) */}
      <path
        d="M 94,342
           C 82,360 72,390 74,418
           L 89,432
           C 99,441 117,440 122,430
           L 128,412
           C 130,390 128,362 120,342
           Z"
        fill={HOODIE}
      />

      {/* Right arm (reaching forward/right, holding mug) */}
      <path
        d="M 282,342
           C 292,358 300,382 300,408
           L 314,424
           L 330,428
           L 322,442
           C 306,440 290,428 282,414
           C 274,400 268,374 262,352
           C 258,340 264,332 272,334
           Z"
        fill={HOODIE}
      />

      {/* Arm sleeve cuff lines (subtle depth) */}
      <path d="M 86 418 C 96 438 118 442 128 432"
        fill="none" stroke="#1E1E2C" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <path d="M 300 408 C 304 422 318 436 330 428"
        fill="none" stroke="#1E1E2C" strokeWidth="2" opacity="0.35" strokeLinecap="round" />

      {/* Kangaroo pocket */}
      <path
        d="M 154,384 C 154,378 158,374 164,374
           L 212,374 C 218,374 222,378 222,384
           L 222,420 L 154,420 Z"
        fill="#1E1E2A" opacity="0.5"
      />
      {/* Pocket seam */}
      <line x1="188" y1="374" x2="188" y2="420"
        stroke="#181820" strokeWidth="1.5" opacity="0.4" />
      {/* Pocket string loops */}
      <circle cx="177" cy="374" r="3" fill="none" stroke="#444458" strokeWidth="1.5" />
      <circle cx="199" cy="374" r="3" fill="none" stroke="#444458" strokeWidth="1.5" />

      {/* ────── COFFEE MUG ────── */}
      {/* Steam wisps (drawn first, behind mug) */}
      <path d="M 310 392 C 307 383 311 375 308 367"
        fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M 323 389 C 320 379 324 371 321 363"
        fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M 336 392 C 339 383 335 375 338 367"
        fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

      {/* Mug body */}
      <rect x="298" y="398" width="52" height="44" rx="8" fill={W} />
      <rect x="298" y="398" width="52" height="44" rx="8"
        fill="none" stroke="#D1D5DB" strokeWidth="1.5" />
      {/* Coffee surface */}
      <ellipse cx="324" cy="398" rx="26" ry="7" fill="#7B4F2E" />
      {/* Latte foam art */}
      <path d="M 311 396 C 317 392 324 400 331 396"
        fill="none" stroke="#C8956A" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <ellipse cx="324" cy="397" rx="8" ry="3.5" fill="#D4A574" opacity="0.4" />

      {/* Mug handle */}
      <path d="M 350 407 C 371 407 374 420 371 430 C 368 438 352 440 350 437"
        fill="none" stroke={W} strokeWidth="9" strokeLinecap="round" />
      <path d="M 350 407 C 371 407 374 420 371 430 C 368 438 352 440 350 437"
        fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

      {/* Code tag on mug */}
      <text x="306" y="421" fontSize="11" fill="#94A3B8" fontFamily="monospace">{"</>"}</text>
      {/* Mug base shadow */}
      <ellipse cx="324" cy="442" rx="26" ry="4" fill="#CBD5E1" opacity="0.4" />

      {/* ────── HANDS ────── */}
      {/* Left hand */}
      <ellipse cx="102" cy="432" rx="18" ry="12" fill={SKIN} />
      {/* Knuckle hints */}
      <path d="M 91 426 C 89 431 91 436 93 437" fill="none" stroke={SKIN_D} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M 98 423 C 96 429 98 435 100 437" fill="none" stroke={SKIN_D} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />

      {/* Right hand (gripping mug) */}
      <ellipse cx="318" cy="434" rx="15" ry="11" fill={SKIN} />
      {/* Finger curve on mug */}
      <path d="M 308 428 C 305 433 307 440 310 441" fill="none" stroke={SKIN_D} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />

      {/* ────── NECK ────── */}
      <rect x="178" y="254" width="22" height="30" rx="7" fill={SKIN} />

      {/* ────── EARS ────── */}
      <ellipse cx="132" cy="202" rx="10" ry="14" fill={SKIN} />
      <ellipse cx="244" cy="202" rx="10" ry="14" fill={SKIN} />
      {/* Inner ear */}
      <ellipse cx="132" cy="203" rx="5.5" ry="8" fill={SKIN_D} opacity="0.38" />
      <ellipse cx="244" cy="203" rx="5.5" ry="8" fill={SKIN_D} opacity="0.38" />

      {/* ── HAIR (behind face, so face covers bottom) ── */}
      <ellipse cx="188" cy="158" rx="60" ry="58" fill={HAIR} />
      {/* Hair side wisps / texture */}
      <ellipse cx="136" cy="178" rx="7" ry="16" fill={HAIR} />
      <ellipse cx="240" cy="178" rx="7" ry="16" fill={HAIR} />

      {/* ────── FACE ────── */}
      <ellipse cx="188" cy="204" rx="56" ry="62" fill={SKIN} />

      {/* ────── EYEBROWS (arched, natural) ─── */}
      <path d="M 152 174 C 158 169 170 168 180 173"
        fill="none" stroke={HAIR} strokeWidth="5" strokeLinecap="round" />
      <path d="M 196 173 C 206 168 218 169 224 174"
        fill="none" stroke={HAIR} strokeWidth="5" strokeLinecap="round" />

      {/* ────── EYES ────── */}
      {/* Left eye */}
      <ellipse cx="166" cy="190" rx="15" ry="11" fill={W} />
      <ellipse cx="168" cy="191" rx="7"  ry="7"  fill="#22223A" />
      <ellipse cx="171" cy="188" rx="2.5" ry="2.5" fill={W} />
      {/* Right eye */}
      <ellipse cx="210" cy="190" rx="15" ry="11" fill={W} />
      <ellipse cx="212" cy="191" rx="7"  ry="7"  fill="#22223A" />
      <ellipse cx="215" cy="188" rx="2.5" ry="2.5" fill={W} />

      {/* ────── GLASSES ────── */}
      {/* Lens tint */}
      <rect x="146" y="180" width="40" height="24" rx="8"
        fill="rgba(196,220,242,0.18)" />
      <rect x="190" y="180" width="40" height="24" rx="8"
        fill="rgba(196,220,242,0.18)" />
      {/* Lens frames */}
      <rect x="146" y="180" width="40" height="24" rx="8"
        fill="none" stroke={HAIR} strokeWidth="2.8" />
      <rect x="190" y="180" width="40" height="24" rx="8"
        fill="none" stroke={HAIR} strokeWidth="2.8" />
      {/* Nose bridge */}
      <line x1="186" y1="192" x2="190" y2="192"
        stroke={HAIR} strokeWidth="2.8" strokeLinecap="round" />
      {/* Temple arms */}
      <line x1="146" y1="192" x2="132" y2="198"
        stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="230" y1="192" x2="244" y2="198"
        stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Lens glare */}
      <line x1="152" y1="184" x2="162" y2="184"
        stroke={W} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <line x1="196" y1="184" x2="206" y2="184"
        stroke={W} strokeWidth="2" strokeLinecap="round" opacity="0.55" />

      {/* ────── NOSE ────── */}
      <path d="M 183 212 C 181 218 184 224 188 224 C 192 224 195 218 193 212"
        fill="none" stroke={SKIN_D} strokeWidth="2" strokeLinecap="round" />

      {/* ────── MOUTH (calm, composed, slight upturn) ─── */}
      <path d="M 174 238 C 179 242 188 244 202 241 C 209 239 212 235 212 235"
        fill="none" stroke="#B07040" strokeWidth="2.5" strokeLinecap="round" />
      {/* Subtle lip line */}
      <path d="M 181 236 C 185 237 191 237 197 236"
        fill="none" stroke="#C08050" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

      {/* ────── COLLAR DETAIL ────── */}
      {/* Hoodie collar ribbing hint */}
      <path d="M 160 263 C 165 258 176 255 188 255 C 200 255 211 258 216 263"
        fill="none" stroke="#3A3A4A" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

    </svg>
  );
}
