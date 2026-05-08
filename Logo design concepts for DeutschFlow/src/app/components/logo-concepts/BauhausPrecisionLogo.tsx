import { motion } from "motion/react";

export function BauhausPrecisionLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="bauhausGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#000000', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#DA291C', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#FFCD00', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* Strict geometric grid background */}
      <motion.g opacity="0.15">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.line
            key={`v-${i}`}
            x1={50 + i * 25}
            y1="50"
            x2={50 + i * 25}
            y2="150"
            stroke="#000000"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.line
            key={`h-${i}`}
            x1="50"
            y1={50 + i * 25}
            x2="150"
            y2={50 + i * 25}
            stroke="#000000"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
          />
        ))}
      </motion.g>

      {/* Sharp angular D - Bauhaus style */}
      <motion.path
        d="M 60 60 L 60 140 L 100 140 L 120 120 L 120 80 L 100 60 Z"
        fill="none"
        stroke="#000000"
        strokeWidth="6"
        strokeLinejoin="miter"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 1, duration: 1.2, ease: "easeInOut" }}
      />

      {/* Red accent triangle - breakthrough */}
      <motion.polygon
        points="100,80 120,100 100,120"
        fill="#DA291C"
        initial={{ scale: 0, x: 20 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ delay: 1.8, type: "spring", stiffness: 200 }}
      />

      {/* Yellow precision square */}
      <motion.rect
        x="65"
        y="95"
        width="10"
        height="10"
        fill="#FFCD00"
        initial={{ scale: 0, rotate: 45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 2, type: "spring" }}
      />

      {/* Black circles - system nodes */}
      {[
        { x: 60, y: 60 },
        { x: 60, y: 140 },
        { x: 120, y: 80 },
        { x: 120, y: 120 }
      ].map((pos, i) => (
        <motion.circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r="4"
          fill="#000000"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.5 + i * 0.1, type: "spring", stiffness: 300 }}
        />
      ))}

      {/* Sharp angular arrow pointing up - breakthrough */}
      <motion.path
        d="M 135 100 L 150 85 L 165 100 M 150 85 L 150 115"
        stroke="#DA291C"
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
      />

      {/* German precision text suggestion */}
      <motion.text
        x="100"
        y="175"
        textAnchor="middle"
        fontSize="8"
        fontFamily="monospace"
        fill="#000000"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 2.5 }}
      >
        PRÄZISION
      </motion.text>
    </svg>
  );
}
