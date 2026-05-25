"use client";

import type { CSSProperties } from "react";
import { IllustratedPersonaCharacter, type IllustratedPersonaExpression } from "./IllustratedPersonaCharacter";

export type ThomasExpression = IllustratedPersonaExpression;

interface Props {
  expression?: ThomasExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

const THOMAS_VARIANT = {
  skin: "#F5C89A",
  skinShadow: "#D49060",
  hair: "#5C4033",
  outfit: "#F8F9FA",
  outfitAccent: "#EAB308",
  eyeColor: "#5C4033",
  eyebrow: "#6B4F3C",
  lip: "#A67C52",
  accessory: "hat",
  accessoryColor: "#FFFFFF",
  hairStyle: "side_part",
} as const;

export function ThomasCharacter({ expression = "neutral", isTalking = false, style, className }: Props) {
  return <IllustratedPersonaCharacter expression={expression} isTalking={isTalking} style={style} className={className} variant={THOMAS_VARIANT} />;
}
