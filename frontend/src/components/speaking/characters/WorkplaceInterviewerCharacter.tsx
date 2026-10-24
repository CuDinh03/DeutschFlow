"use client";

import type { CSSProperties } from "react";
import {
  IllustratedPersonaCharacter,
  type IllustratedPersonaExpression,
  type IllustratedPersonaVariant,
} from "./IllustratedPersonaCharacter";

/**
 * Tám người tuyển dụng theo nơi làm việc (đợt 2c/2d A+B+E), dựng bằng khung nhân vật có tham số
 * như Hannie, Sarah, Thomas — không vẽ tay (owner chốt giữ phong cách phẳng đang có).
 */
const VARIANTS: Record<string, IllustratedPersonaVariant> = {
  HOFFMANN: {
    skin: "#F2C9A0", skinShadow: "#D9A57A", hair: "#3F2A1E", outfit: "#1F2937", outfitAccent: "#F5F5F4",
    eyeColor: "#4B3621", eyebrow: "#3F2A1E", lip: "#B4535E", accessory: "none", hairStyle: "long",
  },
  KRUEGER: {
    skin: "#F5D0B5", skinShadow: "#DDB091", hair: "#B8A88A", outfit: "#F8FAFC", outfitAccent: "#0D9488",
    eyeColor: "#4A6A8A", eyebrow: "#8C7B5E", lip: "#B76E79", accessory: "none", hairStyle: "long",
  },
  BRANDT: {
    skin: "#E8B48C", skinShadow: "#C98F66", hair: "#5A4632", outfit: "#EA580C", outfitAccent: "#FACC15",
    eyeColor: "#4B3621", eyebrow: "#4A3826", lip: "#A0675A", accessory: "none", hairStyle: "short",
  },
  WAGNER: {
    skin: "#F1C7A5", skinShadow: "#D6A27C", hair: "#9CA3AF", outfit: "#1E3A8A", outfitAccent: "#93C5FD",
    eyeColor: "#3B5B7A", eyebrow: "#7C838C", lip: "#A86F62", accessory: "none", hairStyle: "side_part",
  },
  YILMAZ: {
    skin: "#D9A27A", skinShadow: "#B98058", hair: "#1C1917", outfit: "#065F46", outfitAccent: "#FDE047",
    eyeColor: "#3A2618", eyebrow: "#1C1917", lip: "#94584A", accessory: "none", hairStyle: "short",
  },
  SCHULZ: {
    skin: "#F6D2B8", skinShadow: "#DEB094", hair: "#7C2D12", outfit: "#BE185D", outfitAccent: "#FBCFE8",
    eyeColor: "#4F6B3A", eyebrow: "#6B2A12", lip: "#C2415D", accessory: "none", hairStyle: "curly",
  },
  BECKER: {
    skin: "#F3CFAF", skinShadow: "#D9AC8A", hair: "#D6B370", outfit: "#334155", outfitAccent: "#E2E8F0",
    eyeColor: "#3B6E8F", eyebrow: "#A88A52", lip: "#B5606B", accessory: "none", hairStyle: "long",
  },
  RICHTER: {
    skin: "#EDBE98", skinShadow: "#D29C73", hair: "#6B4F3C", outfit: "#4D7C0F", outfitAccent: "#ECFCCB",
    eyeColor: "#5C4033", eyebrow: "#5A4232", lip: "#A26A5C", accessory: "none", hairStyle: "side_part",
  },
};

export function hasWorkplaceInterviewerCharacter(code: string): boolean {
  return code.toUpperCase() in VARIANTS;
}

interface Props {
  code: string;
  expression?: IllustratedPersonaExpression;
  isTalking?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function WorkplaceInterviewerCharacter({ code, expression = "neutral", isTalking = false, style, className }: Props) {
  const variant = VARIANTS[code.toUpperCase()];
  if (!variant) return null;
  return <IllustratedPersonaCharacter expression={expression} isTalking={isTalking} style={style} className={className} variant={variant} />;
}
