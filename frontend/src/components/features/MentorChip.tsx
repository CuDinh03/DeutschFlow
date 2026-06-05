"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyLearningProfile } from "@/lib/profileApi";
import { getMentorMeta, mentorDisplayName } from "@/lib/mentorMeta";

/**
 * Compact "your mentor" chip for the dashboard. Surfaces the fixed mentor assigned at
 * onboarding (so it's visible beyond the onboarding reveal) and links into Speaking.
 * Self-contained: fetches its own profile and renders nothing until a mentor is known.
 */
export function MentorChip() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyLearningProfile()
      .then((p) => { if (active) setCode(p.assignedPersonaCode); })
      .catch(() => { /* non-blocking */ });
    return () => { active = false; };
  }, []);

  if (!code) return null;
  const meta = getMentorMeta(code);

  return (
    <Link
      href="/speaking"
      className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 hover:border-[#FFCD00] transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-[#FFCD00] flex items-center justify-center text-lg shrink-0">{meta.emoji}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-[#94A3B8] font-semibold">Mentor của bạn</p>
        <p className="text-sm font-bold text-[#0F172A] truncate">
          {mentorDisplayName(code)} <span className="text-xs font-normal text-[#64748B]">· {meta.tagline}</span>
        </p>
      </div>
      <span className="text-[#CBD5E1] text-sm" aria-hidden>→</span>
    </Link>
  );
}
