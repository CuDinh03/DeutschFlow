'use client'

import { motion } from "framer-motion";

interface TypingIndicatorProps {
  /** Dot color — should be the persona accent color */
  color: string;
  /** Background of the bubble wrapper */
  bubbleBg: string;
  /** Border color */
  borderColor: string;
}

export function TypingIndicator({ color, bubbleBg, borderColor }: TypingIndicatorProps) {
  return (
    <div
      className="inline-flex rounded-[18px] rounded-bl-[6px]"
      style={{
        background: bubbleBg,
        border: `1px solid ${borderColor}`,
        padding: "12px 16px",
      }}
    >
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.75,
              repeat: Infinity,
              delay: i * 0.16,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}
