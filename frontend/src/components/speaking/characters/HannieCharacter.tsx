"use client";

import type { CSSProperties } from "react";
import { IllustratedPersonaCharacter, type IllustratedPersonaExpression } from "./IllustratedPersonaCharacter";

export type HannieExpression = IllustratedPersonaExpression;

interface Props {
  expression?: HannieExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

const HANNIE_VARIANT = {
  skin: "#FFE0B2",
  skinShadow: "#FFCC80",
  hair: "#FBC02D",
  outfit: "#7C2D12",
  outfitAccent: "#38BDF8",
  eyeColor: "#3B82F6",
  eyebrow: "#8D6E63",
  lip: "#EC4899",
  accessory: "headset",
  accessoryColor: "#111827",
  hairStyle: "curly",
} as const;

export function HannieCharacter({ expression = "idle", isTalking = false, style, className }: Props) {
  return <IllustratedPersonaCharacter expression={expression} isTalking={isTalking} style={style} className={className} variant={HANNIE_VARIANT} />;
}
