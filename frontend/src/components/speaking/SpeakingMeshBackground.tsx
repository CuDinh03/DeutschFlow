"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { normalizeSpeakingPersona, type SpeakingPersonaVisualId } from "./personaTheme";

interface Props {
  personaId?: string | null;
  className?: string;
}

export function SpeakingMeshBackground({ personaId, className }: Props) {
  const id = normalizeSpeakingPersona(personaId ?? undefined);

  const layers: { style: CSSProperties; className?: string }[] =
    id === "EMMA"
      ? [
          {
            style: {
              top: "6%",
              left: "8%",
              width: "min(52vw, 280px)",
              height: "min(52vw, 280px)",
              background:
                "radial-gradient(circle at 30% 30%, rgba(251,191,36,0.22) 0%, transparent 65%)",
              filter: "blur(42px)",
            },
          },
          {
            style: {
              top: "38%",
              right: "6%",
              width: "min(58vw, 320px)",
              height: "min(58vw, 320px)",
              background:
                "radial-gradient(circle at 70% 40%, rgba(45,212,191,0.18) 0%, transparent 68%)",
              filter: "blur(48px)",
            },
          },
          {
            style: {
              bottom: "6%",
              left: "22%",
              width: "min(45vw, 240px)",
              height: "min(45vw, 240px)",
              background:
                "radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)",
              filter: "blur(38px)",
            },
          },
        ]
      : id === "LUKAS"
        ? [
            {
              style: {
                top: "8%",
                left: "5%",
                width: "min(55vw, 300px)",
                height: "min(55vw, 300px)",
                background:
                  "radial-gradient(circle at 40% 35%, rgba(56,189,248,0.2) 0%, transparent 68%)",
                filter: "blur(44px)",
              },
            },
            {
              style: {
                top: "44%",
                right: "8%",
                width: "min(60vw, 340px)",
                height: "min(60vw, 340px)",
                background:
                  "radial-gradient(circle at 60% 50%, rgba(100,116,139,0.24) 0%, transparent 70%)",
                filter: "blur(52px)",
              },
            },
            {
              style: {
                bottom: "10%",
                left: "25%",
                width: "min(48vw, 260px)",
                height: "min(48vw, 260px)",
                background:
                  "radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 72%)",
                filter: "blur(36px)",
              },
            },
          ]
        : id === "HANNA"
          ? [
              {
                style: {
                  top: "6%",
                  left: "6%",
                  width: "min(54vw, 300px)",
                  height: "min(54vw, 300px)",
                  background:
                    "radial-gradient(circle at 35% 30%, rgba(45,212,191,0.22) 0%, transparent 68%)",
                  filter: "blur(44px)",
                },
              },
              {
                style: {
                  top: "40%",
                  right: "6%",
                  width: "min(58vw, 330px)",
                  height: "min(58vw, 330px)",
                  background:
                    "radial-gradient(circle at 55% 45%, rgba(16,185,129,0.2) 0%, transparent 70%)",
                  filter: "blur(50px)",
                },
              },
              {
                style: {
                  bottom: "8%",
                  left: "24%",
                  width: "min(46vw, 250px)",
                  height: "min(46vw, 250px)",
                  background:
                    "radial-gradient(circle, rgba(20,184,166,0.14) 0%, transparent 72%)",
                  filter: "blur(38px)",
                },
              },
            ]
          : [
            {
              style: {
                top: "8%",
                left: "4%",
                width: "min(50vw, 280px)",
                height: "min(50vw, 280px)",
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)",
                filter: "blur(40px)",
              },
            },
            {
              style: {
                top: "42%",
                right: "5%",
                width: "min(56vw, 320px)",
                height: "min(56vw, 320px)",
                background:
                  "radial-gradient(circle, rgba(167,139,250,0.16) 0%, transparent 70%)",
                filter: "blur(48px)",
              },
            },
            {
              style: {
                bottom: "8%",
                left: "28%",
                width: "min(44vw, 220px)",
                height: "min(44vw, 220px)",
                background:
                  "radial-gradient(circle, rgba(45,212,191,0.1) 0%, transparent 70%)",
                filter: "blur(36px)",
              },
            },
          ];

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      aria-hidden
    >
      {layers.map((layer, i) => (
        <div key={i} className={cn("absolute rounded-full", layer.className)} style={layer.style} />
      ))}
    </div>
  );
}
