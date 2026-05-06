"use client";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Number of placeholder blocks */
  blocks?: number;
};

/**
 * Glass-style loading placeholders for practice routes (auth / data bootstrap).
 */
export function PracticeGlassSkeleton({ className, blocks = 3 }: Props) {
  return (
    <div
      className={cn(
        "df-glass-subtle w-full max-w-md rounded-[22px] border border-white/40 p-6 shadow-lg shadow-[#00305E]/8",
        className,
      )}
      role="status"
      aria-busy
      aria-label="Loading"
    >
      <div className="mb-4 h-6 w-2/3 animate-pulse rounded-xl bg-slate-200/90" />
      <div className="space-y-3">
        {Array.from({ length: blocks }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-[14px] bg-gradient-to-r from-slate-100/95 via-slate-200/80 to-slate-100/95"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
      <div className="mt-6 h-11 w-full animate-pulse rounded-[14px] bg-[#00305E]/15" />
    </div>
  );
}
