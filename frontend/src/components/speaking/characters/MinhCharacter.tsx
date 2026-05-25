"use client";

import type { CSSProperties } from "react";
import { IllustratedPersonaCharacter, type IllustratedPersonaExpression } from "./IllustratedPersonaCharacter";

export type MinhExpression = IllustratedPersonaExpression;

interface Props {
  expression?: MinhExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

const MINH_VARIANT = {
  skin: "#F0CBA1",
  skinShadow: "#D1A376",
  hair: "#D84315",
  outfit: "#EF4444",
  outfitAccent: "#FFFFFF",
  eyeColor: "#3B2F2F",
  eyebrow: "#9A3412",
  lip: "#A16207",
  hairStyle: "short",
} as const;

export function MinhCharacter({ expression = "neutral", isTalking = false, style, className }: Props) {
  return <IllustratedPersonaCharacter expression={expression} isTalking={isTalking} style={style} className={className} variant={MINH_VARIANT} />;
}
