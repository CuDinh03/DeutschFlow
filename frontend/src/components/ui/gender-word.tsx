import React from "react";
import { cn } from "@/lib/utils";

// Gender configuration for Visual Gender System
const GENDER_CONFIG = {
  der: { 
    bg: "#EFF6FF", 
    text: "#1D4ED8", 
    border: "#BFDBFE", 
    dot: "#3B82F6" 
  },
  die: { 
    bg: "#FFF1F2", 
    text: "#BE123C", 
    border: "#FECDD3", 
    dot: "#F43F5E" 
  },
  das: { 
    bg: "#F0FDF4", 
    text: "#166534", 
    border: "#BBF7D0", 
    dot: "#10B981" 
  },
  plural: { 
    bg: "#F5F3FF", 
    text: "#4C1D95", 
    border: "#DDD6FE", 
    dot: "#A855F7" 
  },
} as const;

type Gender = keyof typeof GENDER_CONFIG;

interface GenderWordProps {
  word: string;
  gender: Gender;
  className?: string;
  showDot?: boolean;
  size?: "sm" | "md" | "lg";
}

export function GenderWord({ 
  word, 
  gender, 
  className, 
  showDot = true, 
  size = "md" 
}: GenderWordProps) {
  const config = GENDER_CONFIG[gender];
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold border",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.dot }}
        />
      )}
      {word}
    </span>
  );
}

export { GENDER_CONFIG };
export type { Gender };