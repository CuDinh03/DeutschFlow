"use client";

import type { CSSProperties } from "react";
import { IllustratedPersonaCharacter, type IllustratedPersonaExpression } from "./IllustratedPersonaCharacter";

export type SarahExpression = IllustratedPersonaExpression;

interface Props {
  expression?: SarahExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SARAH_VARIANT = {
  skin: "#E0AC69",
  skinShadow: "#C48A45",
  hair: "#1C1C1C",
  outfit: "#475569",
  outfitAccent: "#22C55E",
  eyeColor: "#3F2A1D",
  eyebrow: "#111827",
  lip: "#B45309",
  hairStyle: "side_part",
} as const;

export function SarahCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
  return <IllustratedPersonaCharacter expression={expression} isTalking={isTalking} style={style} className={className} variant={SARAH_VARIANT} />;
}
