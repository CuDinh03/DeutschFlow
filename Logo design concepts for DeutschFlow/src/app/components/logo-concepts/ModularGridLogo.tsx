import { motion } from "motion/react";

export function ModularGridLogo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
    >
      {/* Modular grid system - 5x5 modules */}
      <motion.g>
        {/* Black structural modules */}
        {[
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 },
          { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }
        ].map((pos, i) => (
          <motion.rect
            key={`black-${i}`}
            x={60 + pos.x * 20}
            y={60 + pos.y * 20}
            width="18"
            height="18"
            fill="#000000"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: i * 0.08,
              type: "spring",
              stiffness: 200
            }}
          />
        ))}

        {/* Red modules - forming D curve */}
        {[
          { x: 2, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 4 }
        ].map((pos, i) => (
          <motion.rect
            key={`red-${i}`}
            x={60 + pos.x * 20}
            y={60 + pos.y * 20}
            width="18"
            height="18"
            fill="#DA291C"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: 0.6 + i * 0.08,
              type: "spring",
              stiffness: 200
            }}
          />
        ))}

        {/* Yellow accent modules - breakthrough points */}
        {[
          { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 4 }
        ].map((pos, i) => (
          <motion.rect
            key={`yellow-${i}`}
            x={60 + pos.x * 20}
            y={60 + pos.y * 20}
            width="18"
            height="18"
            fill="#FFCD00"
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: 1, rotate: 180 }}
            transition={{
              delay: 1.2 + i * 0.1,
              type: "spring",
              stiffness: 200
            }}
          />
        ))}

        {/* Grid connection lines */}
        <motion.g stroke="#000000" strokeWidth="1" opacity="0.2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.line
              key={`grid-v-${i}`}
              x1={60 + i * 20}
              y1="60"
              x2={60 + i * 20}
              y2="160"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.5, duration: 0.8 }}
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.line
              key={`grid-h-${i}`}
              x1="60"
              y1={60 + i * 20}
              x2="160"
              y2={60 + i * 20}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.5, duration: 0.8 }}
            />
          ))}
        </motion.g>
      </motion.g>

      {/* System logic arrows - showing modular flow */}
      <motion.path
        d="M 45 110 L 55 110 M 52 107 L 55 110 L 52 113"
        stroke="#DA291C"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2, duration: 0.6 }}
      />

      <motion.path
        d="M 165 110 L 175 110 M 172 107 L 175 110 L 172 113"
        stroke="#FFCD00"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.2, duration: 0.6 }}
      />

      {/* Precision indicator */}
      <motion.circle
        cx="110"
        cy="110"
        r="3"
        fill="#000000"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 2.5, type: "spring" }}
      />

      {/* Outer precision frame */}
      <motion.rect
        x="55"
        y="55"
        width="110"
        height="110"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
        rx="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.3 }}
        transition={{ delay: 2.3, duration: 1 }}
      />
    </svg>
  );
}
